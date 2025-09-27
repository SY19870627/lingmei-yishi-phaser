import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { AiOrchestrator } from '@core/AiOrchestrator';
import type { Spirit, WordCard, GhostOption } from '@core/Types';
import type { WorldState } from '@core/WorldState';

interface GhostCommResult {
  resolvedKnots: string[];
  miasma: string;
}

type ObsessionState = '鬆動' | '已解';

export default class GhostCommScene extends ModuleScene<{ spiritId: string }, GhostCommResult> {
  private repo?: DataRepo;
  private world?: WorldState;
  private aio?: AiOrchestrator;

  private spirit?: Spirit;
  private wordCards: WordCard[] = [];

  private statusText?: Phaser.GameObjects.Text;
  private optionContainer?: Phaser.GameObjects.Container;
  private feedbackText?: Phaser.GameObjects.Text;

  private obsessionState = new Map<string, ObsessionState>();
  private loadingOptions = false;

  constructor() {
    super('GhostCommScene');
  }

  async create() {
    const spiritId = this.route?.in?.spiritId;
    this.repo = this.registry.get('repo') as DataRepo | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;
    this.aio = this.registry.get('aio') as AiOrchestrator | undefined;

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

    this.buildWordCardList(width);
    this.buildOptionsPanel(width, height);
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

    const hint = this.add
      .text(panelWidth / 2, 48, '請選擇右側字卡', {
        fontSize: '16px',
        color: '#ccc',
        wordWrap: { width: panelWidth - 24 }
      })
      .setOrigin(0.5, 0);
    hint.setData('type', 'hint');
    this.optionContainer.add(hint);
  }

  private async handleWordCardSelected(card: WordCard) {
    if (!this.aio || !this.spirit || !this.world || this.loadingOptions) {
      return;
    }
    this.loadingOptions = true;

    this.setOptionsText(['載入選項中……']);

    try {
      const { options } = await this.aio.genGhostOptions({
        spirit: this.spirit,
        word: card,
        world: this.world.data
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
    if (!this.optionContainer) {
      return;
    }

    const panelWidth = (this.optionContainer.list[0] as Phaser.GameObjects.Rectangle).width;
    const optionStartY = 48;
    const optionSpacing = 48;

    this.optionContainer.removeAll(true);

    const panelBg = this.add
      .rectangle(0, 0, panelWidth, this.scale.height - 220, 0x000000, 0.4)
      .setOrigin(0, 0);
    this.optionContainer.add(panelBg);

    const title = this.add
      .text(panelWidth / 2, 12, '溝通選項', {
        fontSize: '20px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);
    this.optionContainer.add(title);

    entries.forEach(({ option }, idx) => {
      const display = this.fitOptionText(String(option.text ?? '選項'), 40);
      const optionText = this.add
        .text(panelWidth / 2, optionStartY + idx * optionSpacing, display, {
          fontSize: '18px',
          color: '#aaf',
          wordWrap: { width: panelWidth - 24 },
          align: 'center'
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });

      optionText.on('pointerup', () => {
        this.applyOption(option);
      });

      this.optionContainer?.add(optionText);
    });
  }

  private setOptionsText(lines: string[]) {
    if (!this.optionContainer) {
      return;
    }

    const panelWidth = (this.optionContainer.list[0] as Phaser.GameObjects.Rectangle).width;
    this.optionContainer.removeAll(true);

    const panelBg = this.add
      .rectangle(0, 0, panelWidth, this.scale.height - 220, 0x000000, 0.4)
      .setOrigin(0, 0);
    this.optionContainer.add(panelBg);

    const title = this.add
      .text(panelWidth / 2, 12, '溝通選項', {
        fontSize: '20px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);
    this.optionContainer.add(title);

    lines.forEach((line, idx) => {
      const text = this.add
        .text(panelWidth / 2, 60 + idx * 28, line, {
          fontSize: '16px',
          color: '#ccc',
          wordWrap: { width: panelWidth - 24 },
          align: 'center'
        })
        .setOrigin(0.5, 0);
      this.optionContainer?.add(text);
    });
  }

  private applyOption(option: GhostOption) {
    if (!this.world) {
      return;
    }

    const effect = String(option.effect ?? '');
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
        const current = this.obsessionState.get(id);
        if (current === '已解') {
          return;
        }
        this.obsessionState.set(id, nextState);
      });
    }

    const summaryParts: string[] = [];
    if (effect) {
      summaryParts.push(`效果：${effect}`);
    }
    if (Array.isArray(option.targets) && option.targets.length) {
      summaryParts.push(`影響執念：${option.targets.join('、')}`);
    }
    this.feedbackText?.setText(summaryParts.join('\n'));
    this.statusText?.setText(this.getStatusSummary());
  }

  private getStatusSummary() {
    const miasma = this.world?.data.煞氣 ?? '未知';
    const obsEntries = Array.from(this.obsessionState.entries());
    const obsText = obsEntries.length
      ? obsEntries.map(([id, state]) => `${id}: ${state}`).join('\n')
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
    const resolved = Array.from(this.obsessionState.entries())
      .filter(([, state]) => state === '已解')
      .map(([id]) => id);
    const miasma = this.world?.data.煞氣 ?? '未知';
    this.done({ resolvedKnots: resolved, miasma });
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
      this.done({ resolvedKnots: [], miasma: this.world?.data.煞氣 ?? '未知' });
    });
  }
}
