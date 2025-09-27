import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { NPC } from '@core/Types';

type Stage = '抗拒' | '猶豫' | '願試' | '承諾';

type MediationResult = { npcId: string; stage: Stage; resolved: string[] };

export default class MediationScene extends ModuleScene<{ npcId: string }, MediationResult> {
  private repo?: DataRepo;
  private npc?: NPC;

  private stageFlow: Stage[] = ['抗拒', '猶豫', '願試', '承諾'];
  private currentStage: Stage = '抗拒';

  private stageText?: Phaser.GameObjects.Text;
  private inputBox?: Phaser.GameObjects.Rectangle;
  private inputText?: Phaser.GameObjects.Text;
  private responseText?: Phaser.GameObjects.Text;

  private typing = false;
  private inputValue = '';

  private readonly negativeKeywords = ['笨', '小氣', '吝嗇', '討厭'];
  private readonly actionKeywords = ['今晚', '明天', '買', '一起', '準備', '安排', '試試'];
  private readonly trustKeywords = ['不讓外人知道', '給你面子', '保密', '替你擋'];

  constructor() {
    super('MediationScene');
  }

  async create() {
    const npcId = this.route?.in?.npcId;
    this.repo = this.registry.get('repo') as DataRepo | undefined;

    if (!npcId || !this.repo) {
      this.showErrorAndExit('缺少必要資料，無法進行調解。', npcId ?? '');
      return;
    }

    try {
      const npcs = await this.repo.get<NPC[]>('npcs');
      this.npc = npcs.find((entry) => entry.id === npcId);
      if (!this.npc) {
        this.showErrorAndExit('找不到指定 NPC。', npcId);
        return;
      }

      if (Array.isArray(this.npc.轉折階段) && this.npc.轉折階段.length) {
        const filtered = this.npc.轉折階段.filter((stage): stage is Stage =>
          stage === '抗拒' || stage === '猶豫' || stage === '願試' || stage === '承諾'
        );
        if (filtered.length) {
          this.stageFlow = filtered;
        }
      }
      this.currentStage = this.stageFlow[0] ?? '抗拒';

      this.buildLayout();
      this.registerKeyboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showErrorAndExit(`讀取資料時發生錯誤：${message}`, npcId);
    }
  }

  private buildLayout() {
    const { width, height } = this.scale;
    const npcName = this.npc?.稱呼 ?? '對方';

    this.add
      .text(width / 2, 48, `協調 ${npcName}`, {
        fontSize: '28px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);

    this.stageText = this.add
      .text(32, 32, '', {
        fontSize: '20px',
        color: '#fff'
      })
      .setOrigin(0, 0);
    this.updateStageText();

    this.add
      .text(width / 2, height / 2 - 80, '請輸入說服的話語', {
        fontSize: '20px',
        color: '#ccc'
      })
      .setOrigin(0.5, 0.5);

    this.inputBox = this.add
      .rectangle(width / 2, height / 2, width * 0.5, 64, 0xffffff, 0.08)
      .setStrokeStyle(2, 0xaaddff, 0.6)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.inputBox.on('pointerup', () => {
      this.typing = true;
      this.updateInputFocus();
    });

    this.inputText = this.add
      .text(width / 2, height / 2, '（點此輸入）', {
        fontSize: '20px',
        color: '#fff',
        wordWrap: { width: width * 0.45 }
      })
      .setOrigin(0.5, 0.5);

    const sendButton = this.add
      .text(width / 2 + width * 0.25 - 60, height / 2 + 90, '送出', {
        fontSize: '22px',
        color: '#aaf'
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    sendButton.on('pointerup', () => {
      this.submitInput();
    });

    const endButton = this.add
      .text(width / 2, height - 40, '結束', {
        fontSize: '22px',
        color: '#aaf'
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });

    endButton.on('pointerup', () => {
      this.finish();
    });

    this.responseText = this.add
      .text(width / 2, height / 2 + 160, '', {
        fontSize: '20px',
        color: '#aaf',
        wordWrap: { width: width * 0.6 },
        align: 'center'
      })
      .setOrigin(0.5, 0);

    this.input.on('pointerup', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (!currentlyOver.includes(this.inputBox as Phaser.GameObjects.GameObject)) {
        this.typing = false;
        this.updateInputFocus();
      }
    });
  }

  private registerKeyboard() {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on('keydown', this.handleKeyInput, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', this.handleKeyInput, this);
    });
  }

  private handleKeyInput(event: KeyboardEvent) {
    if (!this.typing) {
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.inputValue = this.inputValue.slice(0, -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.submitInput();
      return;
    } else if (event.key.length === 1) {
      if (this.inputValue.length < 80) {
        this.inputValue += event.key;
      }
    }

    this.updateInputText();
  }

  private updateInputText() {
    if (!this.inputText) {
      return;
    }
    const content = this.inputValue.trim().length ? this.inputValue : '（點此輸入）';
    this.inputText.setText(content);
  }

  private updateInputFocus() {
    if (!this.inputBox) {
      return;
    }
    const alpha = this.typing ? 1 : 0.6;
    this.inputBox.setStrokeStyle(2, 0xaaddff, alpha);
    this.updateInputText();
  }

  private submitInput() {
    const message = this.inputValue.trim();
    if (!message) {
      this.showResponse('先說點什麼吧。');
      return;
    }

    const delta = this.evaluateMessage(message);
    const applied = this.applyStageDelta(delta);
    this.showResponse(this.composeReply(applied));

    this.inputValue = '';
    this.typing = false;
    this.updateStageText();
    this.updateInputFocus();
  }

  private evaluateMessage(message: string) {
    const normalized = message.replace(/\s+/g, '');
    if (this.negativeKeywords.some((word) => normalized.includes(word))) {
      return 0;
    }

    const hasAction = this.actionKeywords.some((word) => message.includes(word));
    if (!hasAction) {
      return 0;
    }

    let delta = 1;
    if (this.trustKeywords.some((word) => message.includes(word))) {
      delta += 1;
    }
    return delta;
  }

  private applyStageDelta(delta: number) {
    if (delta <= 0) {
      return 0;
    }
    const currentIndex = this.stageFlow.indexOf(this.currentStage);
    const newIndex = Math.min(this.stageFlow.length - 1, currentIndex + delta);
    const applied = Math.max(0, newIndex - currentIndex);
    this.currentStage = this.stageFlow[newIndex] ?? this.currentStage;
    return applied;
  }

  private composeReply(applied: number) {
    if (applied === 0) {
      return '他皺眉：「別這樣說。」';
    }

    switch (this.currentStage) {
      case '猶豫':
        return '他語氣放軟：「好吧，我再想想。」';
      case '願試':
        return '他點頭：「嗯，我可以試試看。」';
      case '承諾':
        return '他鄭重地說：「好，我會做到。」';
      default:
        return '他神色依舊，沒有太大反應。';
    }
  }

  private showResponse(text: string) {
    this.responseText?.setText(text);
  }

  private updateStageText() {
    this.stageText?.setText(`目前階段：${this.currentStage}`);
  }

  private finish() {
    const resolved = this.currentStage === '承諾' ? ['e_offering', 'e_apology'] : [];
    const npcId = this.npc?.id ?? this.route?.in?.npcId ?? '';
    this.done({ npcId, stage: this.currentStage, resolved });
  }

  private showErrorAndExit(message: string, npcId: string) {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, message, {
        fontSize: '20px',
        color: '#fff',
        wordWrap: { width: width - 120 },
        align: 'center'
      })
      .setOrigin(0.5, 0.5);

    this.time.delayedCall(1200, () => {
      this.done({ npcId, stage: this.currentStage, resolved: [] });
    });
  }
}
