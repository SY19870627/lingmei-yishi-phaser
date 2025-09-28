import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { AiOrchestrator } from '@core/AiOrchestrator';
import type { Spirit, WordCard, GhostOption } from '@core/Types';
import type { WorldState } from '@core/WorldState';
import KnotTag from '@ui/KnotTag';
import type { KnotState } from '@ui/KnotTag';
import OptionList from '@ui/OptionList';
import type { OptionListItem } from '@ui/OptionList';
import MiasmaIndicator from '@ui/MiasmaIndicator';
import { GhostDirector } from '@core/GhostDirector';

interface GhostCommResult {
  resolvedKnots?: string[];
  miasma?: string;
  needPerson?: string | null;
}

type ObsessionState = KnotState;

export default class GhostCommScene extends ModuleScene<{ spiritId: string }, GhostCommResult> {
  private repo?: DataRepo;
  private world?: WorldState;
  private aio?: AiOrchestrator;

  private spirit?: Spirit;
  private wordCards: WordCard[] = [];

  private statusText?: Phaser.GameObjects.Text;
  private optionContainer?: Phaser.GameObjects.Container;
  private optionList?: OptionList<GhostOption>;
  private feedbackText?: Phaser.GameObjects.Text;
  private miasmaIndicator?: MiasmaIndicator;

  private obsessionState = new Map<string, ObsessionState>();
  private knotTags = new Map<string, KnotTag>();
  private loadingOptions = false;
  private consecutiveAccusations = 0;
  private lastAccusationKey?: string;
  private concluded = false;
  private bus?: Phaser.Events.EventEmitter;
  private cachedStepKey?: string;

  constructor() {
    super('GhostCommScene');
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
      const [spirits, wordcards] = await Promise.all([
        this.repo.get<Spirit[]>('spirits'),
        this.repo.get<WordCard[]>('wordcards')
      ]);

      this.spirit = spirits.find((sp) => sp.id === spiritId);
      if (!this.spirit) {
        this.showErrorAndExit('找不到指定靈體。');
        return;
      }

      this.initializeObsessionState();

      this.wordCards = wordcards;
      this.buildLayout();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showErrorAndExit(`讀取資料時發生錯誤：${message}`);
    }
  }

  private buildLayout() {
    const { width, height } = this.scale;

    this.add
      .text(32, 32, `與 ${this.spirit?.名 ?? '未知靈體'} 溝通`, {
        fontSize: '26px',
        color: '#fff'
      })
      .setOrigin(0, 0);

    this.statusText = this.add
      .text(32, 96, this.getStatusSummary(), {
        fontSize: '18px',
        color: '#fff',
        lineSpacing: 6,
        wordWrap: { width: width * 0.5 }
      })
      .setOrigin(0, 0);

    const indicatorX = width * 0.52;
    this.miasmaIndicator = new MiasmaIndicator(this, indicatorX, 112, {
      width: 220,
      height: 130
    });
    const currentMiasma = this.world?.data.煞氣 ?? '清';
    this.miasmaIndicator.setMiasma(currentMiasma);

    this.feedbackText = this.add
      .text(32, height - 96, '', {
        fontSize: '18px',
        color: '#aaf',
        wordWrap: { width: width * 0.5 }
      })
      .setOrigin(0, 0);

    const endButton = this.add
      .text(width / 2, height - 32, '結束溝通', {
        fontSize: '22px',
        color: '#aaf'
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });

    endButton.on('pointerup', () => {
      this.finish();
    });

    this.buildObsessionTags();
    this.buildWordCardList(width);
    this.buildOptionsPanel(width, height);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleSceneShutdown, this);
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
      .text(listX, 120, '她的執念', {
        fontSize: '20px',
        color: '#fff'
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

  private buildWordCardList(width: number) {
    const listX = width - 220;
    const listTop = 80;

    this.add
      .text(listX, 32, '可用字卡', {
        fontSize: '22px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);

    const totalRows = Math.max(6, this.wordCards.length);
    const rowHeight = 48;

    for (let index = 0; index < totalRows; index += 1) {
      const card = this.wordCards[index];
      const labelText = card ? card.字 : '（空）';
      const text = this.add
        .text(listX, listTop + index * rowHeight, labelText, {
          fontSize: '20px',
          color: card ? '#aaf' : '#666'
        })
        .setOrigin(0.5, 0)
        .setInteractive(card ? { useHandCursor: true } : undefined);

      if (card) {
        text.on('pointerup', () => {
          this.handleWordCardSelected(card);
        });
      }
    }
  }

  private buildOptionsPanel(width: number, height: number) {
    const panelX = width * 0.6;
    const panelWidth = width * 0.3;

    this.optionContainer = this.add.container(panelX, 140);

    const panelBg = this.add
      .rectangle(0, 0, panelWidth, height - 220, 0x000000, 0.4)
      .setOrigin(0, 0);
    this.optionContainer.add(panelBg);

    const title = this.add
      .text(panelWidth / 2, 12, '溝通選項', {
        fontSize: '20px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);
    this.optionContainer.add(title);

    this.optionList = new OptionList<GhostOption>(this, panelWidth / 2, 72, {
      width: panelWidth - 24,
      wrapWidth: panelWidth - 32,
      align: 'center',
      fontSize: '18px'
    });
    this.optionList.on('confirm', (item: OptionListItem<GhostOption>) => {
      const option = item.data;
      if (option) {
        this.applyOption(option);
      }
    });
    this.optionContainer.add(this.optionList.container);
    this.optionList.setMessage(['請選擇右側字卡']);
  }

  private async handleWordCardSelected(card: WordCard) {
    if (!this.aio || !this.spirit || !this.world || this.loadingOptions) {
      return;
    }
    this.loadingOptions = true;
    this.consecutiveAccusations = 0;
    this.lastAccusationKey = undefined;

    this.setOptionsText(['載入選項中……']);

    try {
      const stepIndex = this.getConversationStep();
      const seed = this.buildSeedString(stepIndex);
      const { options } = await this.aio.genGhostOptions({
        spirit: this.spirit,
        word: card,
        world: this.world.data,
        seed
      });

      if (!options.length) {
        this.setOptionsText(['目前沒有可用選項。']);
      } else {
        this.populateOptions(options.map((option) => ({ card, option })));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setOptionsText([`取得選項失敗：${message}`]);
    } finally {
      this.loadingOptions = false;
    }
  }

  private populateOptions(entries: { card: WordCard; option: GhostOption }[]) {
    if (!this.optionList) {
      return;
    }

    const items = entries.map(({ option }) => ({
      label: this.fitOptionText(String(option.text ?? '選項'), 40),
      data: option
    }));
    this.optionList.setOptions(items);
  }

  private setOptionsText(lines: string[]) {
    this.optionList?.setMessage(lines);
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

    this.miasmaIndicator?.setMiasma(this.world.data.煞氣);

    const summaryParts: string[] = [];
    if (effect) {
      summaryParts.push(`效果：${effect}`);
    }
    if (Array.isArray(option.targets) && option.targets.length) {
      summaryParts.push(`影響執念：${this.describeTargets(option.targets)}`);
    }
    this.feedbackText?.setText(summaryParts.join('\n'));
    this.statusText?.setText(this.getStatusSummary());
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
    this.feedbackText?.setText('她沉默了');
    if (this.input) {
      this.input.enabled = false;
    }
    this.time.delayedCall(400, () => {
      this.finalizeCommunication({ needPerson });
    });
  }

  private getStatusSummary() {
    const miasma = this.world?.data.煞氣 ?? '未知';
    const obsEntries = Array.from(this.obsessionState.entries());
    const obsText = obsEntries.length
      ? obsEntries
          .map(([id, state]) => {
            const name = this.spirit?.執念.find((obs) => obs.id === id)?.名 ?? id;
            return `${name}: ${state}`;
          })
          .join('\n')
      : '尚未撫平任何執念';
    return `目前煞氣：${miasma}\n執念狀態：\n${obsText}`;
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

  private handleSceneShutdown() {
    this.optionList?.destroy();
    this.optionList = undefined;
    this.miasmaIndicator?.destroy();
    this.miasmaIndicator = undefined;
  }
}
