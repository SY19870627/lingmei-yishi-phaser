import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { NPC } from '@core/Types';
import type { WorldState } from '@core/WorldState';

type Stage = '抗拒' | '猶豫' | '願試' | '承諾';

type MediationResult = { npcId: string; stage: Stage; resolved: string[] };

export default class MediationScene extends ModuleScene<{ npcId: string }, MediationResult> {
  private repo?: DataRepo;
  private world?: WorldState;
  private npc?: NPC;

  private currentStage: Stage = '抗拒';

  private stageText?: Phaser.GameObjects.Text;
  private inputBox?: Phaser.GameObjects.Rectangle;
  private inputText?: Phaser.GameObjects.Text;
  private responseText?: Phaser.GameObjects.Text;
  private commitmentHint?: Phaser.GameObjects.Text;
  private commitmentButton?: Phaser.GameObjects.Text;

  private typing = false;
  private inputValue = '';
  private questCompleted = false;
  private finished = false;

  private readonly stageOrder: Stage[] = ['抗拒', '猶豫', '願試', '承諾'];
  private readonly sincerityKeywords = ['一起', '今晚', '明天', '買', '準備', '擺'];
  private readonly faceSavingKeywords = ['別讓外人知道', '體面', '不出聲'];
  private readonly disparagingKeywords = ['小氣', '笨', '欠'];

  constructor() {
    super('MediationScene');
  }

  async create() {
    const npcId = this.route?.in?.npcId;
    this.repo = this.registry.get('repo') as DataRepo | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;

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
      this.currentStage = '抗拒';

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

    this.commitmentHint = this.add
      .text(width / 2, height / 2 + 220, '供桌還得準備些什麼？', {
        fontSize: '18px',
        color: '#ffd9a8',
        wordWrap: { width: width * 0.6 },
        align: 'center'
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.commitmentButton = this.add
      .text(width / 2, height / 2 + 270, '擺上熱飯', {
        fontSize: '22px',
        color: '#ffebc2'
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.commitmentButton.disableInteractive();

    this.input.on('pointerup', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (!currentlyOver.includes(this.inputBox as Phaser.GameObjects.GameObject)) {
        this.typing = false;
        this.updateInputFocus();
      }
    });

    this.commitmentButton.on('pointerup', () => {
      if (!this.commitmentButton?.visible || !this.commitmentButton.input?.enabled) {
        return;
      }
      this.completeCommitmentTask();
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

    const score = this.evaluateMessage(message);
    const previousStage = this.currentStage;
    this.advanceStage(score);
    const stageChanged = previousStage !== this.currentStage;
    this.showResponse(this.composeReply(score, stageChanged));

    this.inputValue = '';
    this.typing = false;
    this.updateInputFocus();
    this.updateInputText();
    this.updateStageText();
  }

  private evaluateMessage(message: string) {
    const trimmed = message.replace(/\s+/g, '');
    let score = 0;

    score += this.countKeywordHits(trimmed, this.sincerityKeywords);
    score += this.countKeywordHits(message, this.faceSavingKeywords);
    score -= 2 * this.countKeywordHits(trimmed, this.disparagingKeywords);

    return score;
  }

  private countKeywordHits(message: string, keywords: string[]) {
    return keywords.reduce((count, keyword) => {
      if (!keyword) {
        return count;
      }
      const matches = message.split(keyword).length - 1;
      return count + Math.max(0, matches);
    }, 0);
  }

  private advanceStage(score: number) {
    if (score <= 0) {
      return;
    }

    const target = this.stageForScore(score);
    const currentIndex = this.stageOrder.indexOf(this.currentStage);
    const targetIndex = this.stageOrder.indexOf(target);
    if (targetIndex > currentIndex) {
      this.currentStage = target;
      this.updateStageText();
      if (target === '承諾') {
        this.showCommitmentTask();
      }
    }
  }

  private stageForScore(score: number): Stage {
    if (score >= 3) {
      return '承諾';
    }
    if (score === 2) {
      return '願試';
    }
    return '猶豫';
  }

  private composeReply(score: number, stageChanged: boolean) {
    if (score <= 0) {
      return '他皺眉：「別這樣說。」';
    }

    if (!stageChanged) {
      switch (this.currentStage) {
        case '猶豫':
          return '他仍舊猶豫：「再給我點時間。」';
        case '願試':
          return '他沉吟不語，似乎還在盤算。';
        default:
          return '他低頭想了一會兒。';
      }
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

  private showCommitmentTask() {
    if (this.questCompleted) {
      return;
    }

    this.commitmentHint
      ?.setText('他低聲提醒：「得讓供桌飄出熱氣。」')
      .setVisible(true);

    if (this.commitmentButton) {
      this.commitmentButton
        .setVisible(true)
        .setColor('#ffe8b0')
        .setInteractive({ useHandCursor: true })
        .setAlpha(1);
    }
  }

  private completeCommitmentTask() {
    if (this.questCompleted) {
      return;
    }

    this.questCompleted = true;
    this.world?.setFlag('擺上熱飯', true);
    this.commitmentHint?.setText('熱氣升騰，他鬆了口氣。');
    if (this.commitmentButton) {
      this.commitmentButton
        .setText('已擺上熱飯')
        .setColor('#ccc')
        .disableInteractive()
        .setAlpha(0.7);
    }

    this.showResponse('他鄭重其事地答應：「我會照辦。」');
    this.finish();
  }

  private finish() {
    if (this.finished) {
      return;
    }

    if (this.currentStage === '承諾' && !this.questCompleted) {
      this.showCommitmentTask();
      this.showResponse('先確定供桌上有熱飯，再來談結果。');
      return;
    }

    const resolved = this.currentStage === '承諾' ? ['e_offering', 'e_apology'] : [];
    const npcId = this.npc?.id ?? this.route?.in?.npcId ?? '';
    this.finished = true;
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
