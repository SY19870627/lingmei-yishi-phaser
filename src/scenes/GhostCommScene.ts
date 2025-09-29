import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { AiOrchestrator } from '@core/AiOrchestrator';
import type { Spirit, WordCard, GhostOption, SacredItem } from '@core/Types';
import type { WorldState } from '@core/WorldState';
import KnotTag from '@ui/KnotTag';
import type { KnotState } from '@ui/KnotTag';
import DialogueBox from '@ui/DialogueBox';
import CardBoard from '@ui/CardBoard';
import type { CardBoardItem } from '@ui/CardBoard';
import { GhostDirector } from '@core/GhostDirector';

interface GhostCommResult {
  resolvedKnots?: string[];
  miasma?: string;
  needPerson?: string | null;
}

type ObsessionState = KnotState;

type CardChoiceData =
  | { kind: 'wordcard'; card: WordCard }
  | { kind: 'option'; option: GhostOption }
  | { kind: 'item'; item: SacredItem };

type FooterKey = 'wordcard' | 'item' | 'blank' | 'leave';
type FooterMode = Extract<FooterKey, 'wordcard' | 'item'>;

export default class GhostCommScene extends ModuleScene<{ spiritId: string }, GhostCommResult> {
  private repo?: DataRepo;
  private world?: WorldState;
  private aio?: AiOrchestrator;

  private spirit?: Spirit;
  private wordCards: WordCard[] = [];
  private sacredItems: SacredItem[] = [];
  private inventoryItems: SacredItem[] = [];

  private miasmaText?: Phaser.GameObjects.Text;
  private dialogueBox?: DialogueBox;
  private cardBoard?: CardBoard<CardChoiceData>;
  private boardMode: 'wordcard' | 'option' | 'message' | 'item' = 'wordcard';
  private backButton?: Phaser.GameObjects.Text;

  private obsessionState = new Map<string, ObsessionState>();
  private knotTags = new Map<string, KnotTag>();
  private loadingOptions = false;
  private activeWordCard?: WordCard;
  private wordCardPage = 0;
  private itemPage = 0;
  private consecutiveAccusations = 0;
  private lastAccusationKey?: string;
  private concluded = false;
  private bus?: Phaser.Events.EventEmitter;
  private cachedStepKey?: string;
  private footerButtons?: Record<FooterKey, Phaser.GameObjects.Text>;
  private footerActive?: FooterMode;

  constructor() {
    super('GhostCommScene');
  }

  override init(data: unknown) {
    super.init(data);
    this.resetState();
  }

  async create() {
    const spiritId = this.route?.in?.spiritId;
    this.repo = this.registry.get('repo') as DataRepo | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;
    this.aio = this.registry.get('aio') as AiOrchestrator | undefined;
    this.bus = this.registry.get('bus') as Phaser.Events.EventEmitter | undefined;

    if (!spiritId || !this.repo || !this.world || !this.aio) {
      this.showErrorAndExit('缺少必要資料，無法進行靈體溝通。');
      return;
    }

    try {
      const [spirits, wordcards, items] = await Promise.all([
        this.repo.get<Spirit[]>('spirits'),
        this.repo.get<WordCard[]>('wordcards'),
        this.repo.get<SacredItem[]>('items')
      ]);

      this.spirit = spirits.find((sp) => sp.id === spiritId);
      if (!this.spirit) {
        this.showErrorAndExit('找不到指定靈體。');
        return;
      }

      this.initializeObsessionState();

      this.wordCards = wordcards;
      this.sacredItems = items;
      this.buildInventoryItems();
      this.buildLayout();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showErrorAndExit(`讀取資料時發生錯誤：${message}`);
    }
  }

  private resetState() {
    this.spirit = undefined;
    this.wordCards = [];
    this.sacredItems = [];
    this.inventoryItems = [];
    this.miasmaText = undefined;
    this.dialogueBox = undefined;
    this.cardBoard = undefined;
    this.boardMode = 'wordcard';
    this.backButton = undefined;
    this.obsessionState.clear();
    this.knotTags.clear();
    this.loadingOptions = false;
    this.consecutiveAccusations = 0;
    this.lastAccusationKey = undefined;
    this.concluded = false;
    this.cachedStepKey = undefined;
    this.activeWordCard = undefined;
    this.wordCardPage = 0;
    this.itemPage = 0;
    this.footerButtons = undefined;
    this.footerActive = undefined;
    if (this.input) {
      this.input.enabled = true;
    }
  }

  private buildLayout() {
    const { width, height } = this.scale;

    this.buildHeader();

    this.dialogueBox = new DialogueBox(this, width / 2 - 340, height - 220, {
      width: 680,
      height: 190,
      backgroundColor: 0x0b0906,
      backgroundAlpha: 0.78,
      fontSize: '20px',
      textColor: '#f3e3c2'
    });
    this.dialogueBox.setText('請選擇卡牌與靈體交涉。');

    const dialogueTop = this.dialogueBox.container.y;

    this.cardBoard = new CardBoard<CardChoiceData>(this, width / 2, dialogueTop - 120, {
      cardWidth: 220,
      cardHeight: 148,
      cardSpacing: 52,
      titleFontSize: '30px',
      tagFontSize: '20px',
      descriptionFontSize: '18px'
    });
    const boardHeight = this.cardBoard.getHeight();
    this.cardBoard.container.setY(dialogueTop - boardHeight / 2);
    this.cardBoard.on('select', this.handleCardBoardSelection, this);
    this.cardBoard.on('pagechange', (pageIndex: number) => {
      if (this.boardMode === 'wordcard') {
        this.wordCardPage = pageIndex;
      } else if (this.boardMode === 'item') {
        this.itemPage = pageIndex;
      }
    });

    const backButtonY = dialogueTop - 12;

    this.backButton = this.add
      .text(width / 2, backButtonY, '返回選牌', {
        fontSize: '20px',
        color: '#f3e3c2'
      })
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.backButton.on('pointerup', () => {
      this.showWordCardChoices(false);
      this.dialogueBox?.setText('請選擇卡牌與靈體交涉。');
    });

    this.buildFooter();
    const closeButton = this.add
      .text(width - 36, 32, '✕', {
        fontSize: '32px',
        color: '#f3e3c2'
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeButton.on('pointerup', () => {
      this.finish();
    });

    this.buildObsessionTags();
    this.showWordCardChoices(true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleSceneShutdown, this);
  }

  private buildHeader() {
    const name = this.spirit?.名 ?? '未知靈體';
    const miasma = this.world?.data.煞氣 ?? '未知';

    this.add
      .text(32, 36, name, {
        fontSize: '34px',
        color: '#f3e3c2',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0);

    this.miasmaText = this.add
      .text(32, 88, `煞氣：${miasma}`, {
        fontSize: '22px',
        color: '#e4cfa4'
      })
      .setOrigin(0, 0);
  }

  private buildInventoryItems() {
    const carried = this.world?.data.物品 ?? [];
    const available = carried
      .map((id) => this.sacredItems.find((item) => item.id === id))
      .filter((item): item is SacredItem => Boolean(item));
    this.inventoryItems = available;
  }

  private buildFooter() {
    const { width, height } = this.scale;
    const baseY = height - 24;
    const spacing = 140;
    const entries: {
      key: FooterKey;
      text: string;
      interactive: boolean;
      handler?: () => void;
    }[] = [
      {
        key: 'wordcard',
        text: '天語',
        interactive: true,
        handler: () => {
          if (!this.concluded) {
            this.showWordCardChoices(false);
          }
        }
      },
      {
        key: 'item',
        text: '物品',
        interactive: true,
        handler: () => {
          if (!this.concluded) {
            this.showItemChoices(false);
          }
        }
      },
      {
        key: 'blank',
        text: '空白',
        interactive: false
      },
      {
        key: 'leave',
        text: '離開',
        interactive: true,
        handler: () => {
          if (!this.concluded) {
            this.finish();
          }
        }
      }
    ];

    const startX = width / 2 - ((entries.length - 1) * spacing) / 2;
    const buttons = {} as Record<FooterKey, Phaser.GameObjects.Text>;

    entries.forEach((entry, index) => {
      const x = startX + index * spacing;
      const text = this.add
        .text(x, baseY, entry.text, {
          fontSize: '20px',
          color: '#a89678'
        })
        .setOrigin(0.5, 1);

      if (entry.interactive && entry.handler) {
        text.setInteractive({ useHandCursor: true })
          .on('pointerup', entry.handler)
          .on('pointerover', () => {
            if (this.footerActive !== entry.key && !this.concluded) {
              text.setColor('#d8c7a0');
            }
          })
          .on('pointerout', () => {
            if (this.footerActive !== entry.key) {
              text.setColor('#a89678');
            }
          });
      }

      buttons[entry.key] = text;
    });

    this.footerButtons = buttons;
    this.updateFooterColors();
  }

  private setFooterActive(mode: FooterMode) {
    this.footerActive = mode;
    this.updateFooterColors();
  }

  private updateFooterColors() {
    if (!this.footerButtons) {
      return;
    }
    const activeColor = '#f3e3c2';
    const inactiveColor = '#a89678';
    const hoverColor = '#d8c7a0';

    const setColor = (text: Phaser.GameObjects.Text, key: FooterKey) => {
      if (this.footerActive === key) {
        text.setColor(activeColor);
      } else if (text.input && text.input.enabled) {
        text.setColor(inactiveColor);
      } else {
        text.setColor(hoverColor);
      }
    };

    setColor(this.footerButtons.wordcard, 'wordcard');
    setColor(this.footerButtons.item, 'item');
    this.footerButtons.blank.setColor(inactiveColor);
    this.footerButtons.leave.setColor(inactiveColor);
  }

  private showWordCardChoices(resetPage: boolean) {
    if (!this.cardBoard) {
      return;
    }

    this.setFooterActive('wordcard');

    if (!this.wordCards.length) {
      this.boardMode = 'message';
      this.showBoardMessage('目前沒有可用的字卡。');
      return;
    }

    const items: CardBoardItem<CardChoiceData>[] = this.wordCards.map((card, index) => {
      const tags = Array.isArray(card.標籤) ? card.標籤.slice() : [];
      const notes = card.備註 ? String(card.備註) : '';
      return {
        id: card.id ?? `card-${index}`,
        title: card.字 ?? card.id ?? `卡牌 ${index + 1}`,
        description: notes,
        tags,
        tagLabel: '標籤：',
        descriptionLabel: '備註：',
        data: { kind: 'wordcard', card }
      };
    });

    this.boardMode = 'wordcard';
    this.cardBoard.setItems(items, resetPage);
    if (resetPage) {
      this.wordCardPage = 0;
    }
    if (!resetPage) {
      this.cardBoard.setPage(this.wordCardPage);
    }
    this.backButton?.setVisible(false);
    this.activeWordCard = undefined;
    this.loadingOptions = false;
  }

  private showItemChoices(resetPage: boolean) {
    if (!this.cardBoard) {
      return;
    }

    this.setFooterActive('item');

    if (!this.inventoryItems.length) {
      this.boardMode = 'message';
      this.showBoardMessage('你身上沒有可以出示的物品。');
      return;
    }

    const items: CardBoardItem<CardChoiceData>[] = this.inventoryItems.map((item, index) => {
      const descriptionParts: string[] = [];
      if (item.來源) {
        descriptionParts.push(`來源：${item.來源}`);
      }
      if (Array.isArray(item.用途) && item.用途.length) {
        descriptionParts.push(`用途：${item.用途.join('、')}`);
      }
      if (item.鉤子) {
        descriptionParts.push(item.鉤子);
      }
      return {
        id: item.id ?? `item-${index}`,
        title: item.名 ?? item.id ?? `物品 ${index + 1}`,
        description: descriptionParts.join('\n'),
        data: { kind: 'item', item }
      };
    });

    this.boardMode = 'item';
    this.cardBoard.setItems(items, resetPage);
    if (resetPage) {
      this.itemPage = 0;
    }
    if (!resetPage) {
      this.cardBoard.setPage(this.itemPage);
    }
    this.backButton?.setVisible(false);
    this.loadingOptions = false;
  }

  private showBoardMessage(message: string | string[], showBackButton = false) {
    if (!this.cardBoard) {
      return;
    }
    this.cardBoard.setMessage(message);
    this.boardMode = 'message';
    this.backButton?.setVisible(showBackButton);
  }

  private handleCardBoardSelection(item: CardBoardItem<CardChoiceData>) {
    const data = item.data;
    if (!data) {
      return;
    }
    if (data.kind === 'wordcard') {
      this.handleWordCardSelected(data.card);
    } else if (data.kind === 'option') {
      this.applyOption(data.option);
    } else if (data.kind === 'item') {
      this.presentItem(data.item);
    }
  }

  private presentItem(item: SacredItem) {
    const name = item.名 ?? item.id ?? '未知物品';
    const lines = [`你拿出「${name}」。`];
    if (item.鉤子) {
      lines.push(item.鉤子);
    }
    this.dialogueBox?.setText(lines.join('\n'));
  }

  private buildOptionDescription(option: GhostOption) {
    const parts: string[] = [];
    if (option.effect) {
      parts.push(`效果：${option.effect}`);
    }
    if (option.type) {
      parts.push(`類型：${option.type}`);
    }
    return parts.join('\n');
  }

  private initializeObsessionState() {
    if (!this.spirit) {
      return;
    }

    const worldFlags = this.world?.data.旗標 ?? {};
    this.spirit.執念?.forEach((obsession) => {
      const flagState = worldFlags[`obsession:${obsession.id}`];
      const initialState = (flagState as ObsessionState) || obsession.狀態 || '未解';
      const normalized: ObsessionState = initialState === '已解' ? '已解' : initialState === '鬆動' ? '鬆動' : '未解';
      this.obsessionState.set(obsession.id, normalized);
    });
  }

  private buildObsessionTags() {
    if (!this.spirit) {
      return;
    }

    const listX = 32;
    const listTop = 150;
    const spacing = 52;

    this.add
      .text(listX, 128, '她的執念', {
        fontSize: '22px',
        color: '#f3e3c2'
      })
      .setOrigin(0, 0);

    this.spirit.執念.forEach((obsession, index) => {
      const state = this.obsessionState.get(obsession.id) ?? '未解';
      const tag = new KnotTag(this, listX, listTop + index * spacing, {
        text: obsession.名 ?? obsession.id,
        state
      });
      this.knotTags.set(obsession.id, tag);
    });
  }

  private async handleWordCardSelected(card: WordCard) {
    if (!this.aio || !this.spirit || !this.world || this.loadingOptions) {
      return;
    }
    this.loadingOptions = true;
    this.consecutiveAccusations = 0;
    this.lastAccusationKey = undefined;
    this.activeWordCard = card;
    this.boardMode = 'message';
    this.showBoardMessage('載入選項中……', true);
    this.dialogueBox?.setText(`你試著以「${card.字}」為開端。`);

    try {
      const stepIndex = this.getConversationStep();
      const seed = this.buildSeedString(stepIndex);
      const { options } = await this.aio.genGhostOptions({
        spirit: this.spirit,
        word: card,
        world: this.world.data,
        seed
      });

      if (this.activeWordCard !== card) {
        return;
      }
      this.populateOptions(options.map((option) => ({ card, option })));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.activeWordCard === card) {
        this.showBoardMessage(`取得選項失敗：${message}`, true);
        this.dialogueBox?.setText('她似乎沒有回應。');
      }
    } finally {
      this.loadingOptions = false;
    }
  }

  private populateOptions(entries: { card: WordCard; option: GhostOption }[]) {
    if (!this.cardBoard) {
      return;
    }

    if (!entries.length) {
      this.boardMode = 'message';
      this.showBoardMessage('目前沒有可用選項。', true);
      this.dialogueBox?.setText('她對這個話題沒有回應。');
      return;
    }

    const items: CardBoardItem<CardChoiceData>[] = entries.map(({ card, option }, index) => ({
      id: `${card.id ?? 'card'}-${index}`,
      title: this.fitOptionText(String(option.text ?? '選項'), 36),
      description: this.buildOptionDescription(option),
      data: { kind: 'option', option }
    }));

    this.boardMode = 'option';
    this.cardBoard.setItems(items, true);
    this.backButton?.setVisible(true);
    this.dialogueBox?.setText('選擇要說的話。');
  }

  private applyOption(option: GhostOption) {
    if (!this.world || this.concluded) {
      return;
    }

    this.advanceConversationStep();

    const effect = String(option.effect ?? '');
    const optionType = String(option.type ?? '');

    if (optionType === '指認') {
      const key = this.buildTargetKey(option.targets);
      if (key) {
        if (this.lastAccusationKey === key) {
          this.consecutiveAccusations += 1;
        } else {
          this.consecutiveAccusations = 1;
          this.lastAccusationKey = key;
        }
        if (this.consecutiveAccusations >= 2) {
          this.triggerRefusal();
          return;
        }
      } else {
        this.consecutiveAccusations = 1;
        this.lastAccusationKey = undefined;
      }
    } else {
      this.consecutiveAccusations = 0;
      this.lastAccusationKey = undefined;
    }

    if (effect === '平煞') {
      const current = this.world.data.煞氣;
      if (current === '沸') {
        this.world.data.煞氣 = '濁';
      } else if (current === '濁') {
        this.world.data.煞氣 = '清';
      }
    } else if (effect === '鬆動' || effect === '解結') {
      const targets: string[] = Array.isArray(option.targets) ? option.targets : [];
      targets.forEach((id) => {
        if (!id) {
          return;
        }
        const nextState: ObsessionState = effect === '解結' ? '已解' : '鬆動';
        const current = this.obsessionState.get(id) ?? '未解';
        if (current === '已解') {
          return;
        }
        this.obsessionState.set(id, nextState);
        const tag = this.knotTags.get(id);
        if (tag) {
          if (effect === '解結') {
            tag.setState('已解');
          } else {
            tag.setState('鬆動');
          }
        }
      });

      if (effect === '解結' && this.areAllKnotsResolved()) {
        this.finalizeCommunication();
        return;
      }
    }

    this.updateMiasmaText();

    const summaryParts: string[] = [];
    if (effect) {
      summaryParts.push(`效果：${effect}`);
    }
    if (Array.isArray(option.targets) && option.targets.length) {
      summaryParts.push(`影響執念：${this.describeTargets(option.targets)}`);
    }
    const summary = summaryParts.length ? summaryParts.join('\n') : '她靜靜地看著你。';
    this.dialogueBox?.setText(summary);
    this.showWordCardChoices(false);
  }

  private getConversationStep(): number {
    const key = this.getStepFlagKey();
    if (!key || !this.world) {
      return 0;
    }
    const value = this.world.data.旗標?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    return 0;
  }

  private advanceConversationStep() {
    const key = this.getStepFlagKey();
    if (!key || !this.world) {
      return;
    }
    const current = this.getConversationStep();
    this.world.setFlag(key, current + 1);
  }

  private getStepFlagKey(): string | undefined {
    if (this.cachedStepKey) {
      return this.cachedStepKey;
    }
    const id = this.spirit?.id;
    if (!id) {
      return undefined;
    }
    this.cachedStepKey = `ghost.step:${id}`;
    return this.cachedStepKey;
  }

  private buildSeedString(stepIndex: number): string {
    const spiritId = this.spirit?.id ?? '';
    const snapshot = this.buildKeyFlagSnapshot();
    const sortedKeys = Object.keys(snapshot).sort();
    const ordered: Record<string, unknown> = {};
    sortedKeys.forEach((key) => {
      ordered[key] = snapshot[key];
    });
    const flagsJson = JSON.stringify(ordered);
    return `${spiritId}|${stepIndex}|${flagsJson}`;
  }

  private buildKeyFlagSnapshot(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (!this.world || !this.spirit) {
      return result;
    }

    const flags = this.world.data.旗標 ?? {};
    const keys = [
      GhostDirector.getStateFlagKey(this.spirit.id),
      ...((this.spirit.執念 ?? []).map((obs) => `obsession:${obs.id}`)),
      this.getStepFlagKey()
    ].filter((key): key is string => Boolean(key));

    keys.forEach((key) => {
      if (key in flags) {
        result[key] = flags[key];
      }
    });

    return result;
  }

  private triggerRefusal() {
    const needPerson = this.spirit?.特例?.關鍵人物 ?? null;
    this.dialogueBox?.setText('她沉默了。');
    this.showBoardMessage('她沉默了。', true);
    if (this.input) {
      this.input.enabled = false;
    }
    this.time.delayedCall(400, () => {
      this.finalizeCommunication({ needPerson });
    });
  }

  private fitOptionText(text: string, maxLength: number) {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 1)}…`;
  }

  private finish() {
    this.finalizeCommunication();
  }

  private finalizeCommunication(overrides: Partial<GhostCommResult> = {}) {
    if (this.concluded) {
      return;
    }
    this.concluded = true;
    if (this.input) {
      this.input.enabled = false;
    }

    const resolved = Array.from(this.obsessionState.entries())
      .filter(([, state]) => state === '已解')
      .map(([id]) => id);
    const miasma = this.world?.data.煞氣 ?? '未知';
    const result: GhostCommResult = {
      resolvedKnots: overrides.resolvedKnots ?? resolved,
      miasma: overrides.miasma ?? miasma
    };

    if ('needPerson' in overrides) {
      result.needPerson = overrides.needPerson ?? null;
    }

    this.bus?.emit('autosave');
    this.done(result);
  }

  private showErrorAndExit(message: string) {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, message, {
        fontSize: '20px',
        color: '#fff',
        wordWrap: { width: width - 80 },
        align: 'center'
      })
      .setOrigin(0.5);

    this.time.delayedCall(1200, () => {
      this.finalizeCommunication();
    });
  }

  private areAllKnotsResolved() {
    if (!this.obsessionState.size) {
      return false;
    }
    for (const state of this.obsessionState.values()) {
      if (state !== '已解') {
        return false;
      }
    }
    return true;
  }

  private buildTargetKey(targets: unknown) {
    if (!Array.isArray(targets) || !targets.length) {
      return '';
    }
    return [...targets].sort().join('|');
  }

  private describeTargets(targets: unknown) {
    if (!Array.isArray(targets) || !targets.length) {
      return '無';
    }
    return targets
      .map((id) => {
        if (typeof id !== 'string') {
          return String(id ?? '未知');
        }
        return this.spirit?.執念.find((obs) => obs.id === id)?.名 ?? id;
      })
      .join('、');
  }

  private updateMiasmaText() {
    if (!this.miasmaText) {
      return;
    }
    const miasma = this.world?.data.煞氣 ?? '未知';
    this.miasmaText.setText(`煞氣：${miasma}`);
  }

  private handleSceneShutdown() {
    this.cardBoard?.destroy();
    this.cardBoard = undefined;
    this.dialogueBox?.destroy();
    this.dialogueBox = undefined;
  }
}
