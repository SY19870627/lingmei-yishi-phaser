import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { WorldState } from '@core/WorldState';
import type { Router } from '@core/Router';
import { GhostDirector } from '@core/GhostDirector';
import type { Spirit } from '@core/Types';

type StoryBaseStep = { lineId?: string };
type StoryTextDisplayMode = 'AUTO' | 'CENTER';
type StoryTextStep = StoryBaseStep & {
  t: 'TEXT';
  who?: string;
  text: string;
  display?: StoryTextDisplayMode;
};
type StoryGiveItemStep = StoryBaseStep & { t: 'GIVE_ITEM'; itemId: string; message?: string };
type StoryUpdateFlagStep = StoryBaseStep & { t: 'UPDATE_FLAG'; flag: string; value: unknown };
type StoryScreenEffectStep =
  StoryBaseStep & { t: 'SCREEN_EFFECT'; effectId: string; duration?: number; color?: string };
type StoryEndStep = StoryBaseStep & { t: 'END' };
type StoryCallGhostCommStep = StoryBaseStep & { t: 'CALL_GHOST_COMM'; spiritId: string };
type StoryCallMediationStep = StoryBaseStep & { t: 'CALL_MEDIATION'; npcId: string };
type StoryChoiceOptionBase = { text: string; nextLineId?: string };
type StoryChoiceGotoOption = StoryChoiceOptionBase & { action: 'GOTO_LINE'; targetLineId: string };
type StoryChoiceStartStoryOption = StoryChoiceOptionBase & { action: 'START_STORY'; storyId: string };
type StoryChoiceCallGhostOption = StoryChoiceOptionBase & { action: 'CALL_GHOST_COMM'; spiritId: string };
type StoryChoiceCallMediationOption = StoryChoiceOptionBase & { action: 'CALL_MEDIATION'; npcId: string };
type StoryChoiceEndOption = StoryChoiceOptionBase & { action: 'END' };
type StoryChoiceOption =
  | StoryChoiceGotoOption
  | StoryChoiceStartStoryOption
  | StoryChoiceCallGhostOption
  | StoryChoiceCallMediationOption
  | StoryChoiceEndOption;
type StoryChoiceStep = StoryBaseStep & { t: 'CHOICE'; options: StoryChoiceOption[] };
type StoryStep =
  | StoryTextStep
  | StoryGiveItemStep
  | StoryUpdateFlagStep
  | StoryScreenEffectStep
  | StoryEndStep
  | StoryCallGhostCommStep
  | StoryCallMediationStep
  | StoryChoiceStep
  | { t: string; [key: string]: unknown };

type StoryNode = {
  id: string;
  steps: StoryStep[];
};

type GhostCommResult = { resolvedKnots?: string[]; miasma?: string; needPerson?: string };
type MediationResult = { npcId: string; stage: string; resolved: string[] };

const zhBase = {
  fontFamily: 'Noto Sans TC, PingFang TC, "Microsoft JhengHei", sans-serif',
  padding: { top: 6, bottom: 2 },
  color: '#fff'
} as const;

export default class StoryScene extends ModuleScene<{ storyId: string }, { flagsUpdated: string[] }> {
  private steps: StoryStep[] = [];
  private stepIndex = 0;
  private awaitingInput = false;
  private awaitingChoice = false;
  private finished = false;
  private flagsUpdated = new Set<string>();
  private world?: WorldState;
  private repo?: DataRepo;
  private router?: Router;
  private textBox!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private dialogueContainer!: Phaser.GameObjects.Container;
  private dialogueText!: Phaser.GameObjects.Text;
  private speakerNameText!: Phaser.GameObjects.Text;
  private centerTextBox!: Phaser.GameObjects.Text;
  private dialogueBoxSize = { width: 0, height: 0 };
  private activeTextObject?: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private skipNextMediationStep = false;
  private storyId?: string;
  private storyLoaded = false;
  private activeSpiritId?: string;
  private spiritsLoaded = false;
  private spiritCache = new Map<string, Spirit>();
  private bus?: Phaser.Events.EventEmitter;
  private lineIndexById = new Map<string, number>();
  private pendingLineJump?: string;
  private typewriterTimer?: Phaser.Time.TimerEvent;
  private typewriterFullText = '';
  private typewriterIndex = 0;
  private typewriterActive = false;
  private screenEffectInProgress = false;
  private screenEffectTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('StoryScene');
  }

  async create() {
    const { width, height } = this.scale;

    this.resetStoryState();

    this.textBox = this.add
      .text(width / 2, height / 2 - 40, '', {
        ...zhBase,
        fontSize: '24px',
        align: 'center',
        wordWrap: { width: width - 120 }
      })
      .setOrigin(0.5);

    this.centerTextBox = this.add
      .text(width / 2, height / 2, '', {
        ...zhBase,
        fontSize: '28px',
        align: 'center',
        wordWrap: { width: width - 160 }
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.promptText = this.add
      .text(width / 2, height / 2 + 60, '點擊繼續', {
        ...zhBase,
        fontSize: '18px',
        color: '#ccc'
      })
      .setOrigin(0.5)
      .setVisible(false);

    const dialogueWidth = Math.max(320, width - 120);
    const dialogueHeight = Math.max(160, height * 0.28);
    const dialogueBackground = this.add
      .rectangle(0, 0, dialogueWidth, dialogueHeight, 0x000000, 0.75)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 0.4);
    this.speakerNameText = this.add
      .text(-dialogueWidth / 2 + 24, -dialogueHeight / 2 + 18, '', {
        ...zhBase,
        fontSize: '20px',
        color: '#ffd54f',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0);
    this.dialogueText = this.add
      .text(-dialogueWidth / 2 + 24, -dialogueHeight / 2 + 56, '', {
        ...zhBase,
        fontSize: '22px',
        wordWrap: { width: dialogueWidth - 48 }
      })
      .setOrigin(0, 0);

    this.dialogueContainer = this.add
      .container(width / 2, height - dialogueHeight / 2 - 40, [
        dialogueBackground,
        this.speakerNameText,
        this.dialogueText
      ])
      .setVisible(false);
    this.dialogueBoxSize = { width: dialogueWidth, height: dialogueHeight };

    this.input.on('pointerup', () => {
      if (this.isTypewriterRunning()) {
        this.completeTypewriter();
        return;
      }

      if (this.awaitingInput) {
        this.awaitingInput = false;
        this.promptText.setVisible(false);
        this.advance();
      }
    });

    const storyId = this.route?.in?.storyId;
    if (!storyId) {
      this.showErrorAndExit('未指定劇情，無法播放。');
      return;
    }

    this.storyId = storyId;

    this.repo = this.registry.get('repo') as DataRepo | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;
    this.router = this.registry.get('router') as Router | undefined;
    this.bus = this.registry.get('bus') as Phaser.Events.EventEmitter | undefined;

    if (!this.repo) {
      this.showErrorAndExit('缺少資料倉庫，無法讀取劇情。');
      return;
    }

    try {
      const stories = await this.repo.get<StoryNode[]>('stories');
      const story = stories.find((node) => node.id === storyId);
      if (!story) {
        this.showErrorAndExit('找不到指定的劇情節點。');
        return;
      }

      this.steps = story.steps ?? [];
      this.indexStoryLines();
      this.storyLoaded = true;
      if (!this.steps.length) {
        this.finishStory();
        return;
      }

      this.advance();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showErrorAndExit(`讀取劇情時發生錯誤：${message}`);
    }
  }

  private resetStoryState() {
    this.steps = [];
    this.stepIndex = 0;
    this.awaitingInput = false;
    this.awaitingChoice = false;
    this.finished = false;
    this.flagsUpdated = new Set<string>();
    this.storyId = undefined;
    this.storyLoaded = false;
    this.skipNextMediationStep = false;
    this.activeSpiritId = undefined;
    this.spiritsLoaded = false;
    this.spiritCache.clear();
    this.pendingLineJump = undefined;
    if (this.choiceTexts.length) {
      this.choiceTexts.forEach((text) => text.destroy());
    }
    this.choiceTexts = [];
    this.lineIndexById.clear();
    this.cancelTypewriter();
    this.typewriterFullText = '';
    this.typewriterIndex = 0;
    this.screenEffectInProgress = false;
    this.clearScreenEffectTimer();
    if (this.dialogueContainer) {
      this.dialogueContainer.setVisible(false);
    }
    if (this.speakerNameText) {
      this.speakerNameText.setText('');
    }
    if (this.dialogueText) {
      this.dialogueText.setText('');
    }
    if (this.centerTextBox) {
      this.centerTextBox.setText('').setVisible(false);
    }
    if (this.textBox) {
      this.textBox.setVisible(true);
    }
  }

  private advance() {
    this.cancelTypewriter();
    if (this.pendingLineJump) {
      const targetLineId = this.pendingLineJump;
      this.pendingLineJump = undefined;
      this.jumpToLine(targetLineId);
    }

    this.clearChoices();
    while (this.stepIndex < this.steps.length) {
      const step = this.steps[this.stepIndex++];
      switch (step.t) {
        case 'TEXT':
          if (this.isTextStep(step)) {
            this.displayText(step);
            return;
          }
          break;
        case 'SCREEN_EFFECT':
          if (this.isScreenEffectStep(step)) {
            this.handleScreenEffect(step);
            return;
          }
          break;
        case 'GIVE_ITEM':
          if (this.isGiveItemStep(step)) {
            this.handleGiveItem(step);
          }
          break;
        case 'UPDATE_FLAG':
          if (this.isUpdateFlagStep(step)) {
            this.handleUpdateFlag(step);
          }
          break;
        case 'CALL_GHOST_COMM':
          if (this.isCallGhostCommStep(step)) {
            const state = GhostDirector.getState(step.spiritId, this.world);
            if (state === '安息' || state === '回聲') {
              this.showToast(state === '安息' ? '靈體已安息，不再呼喚。' : '此處僅餘回聲。');
              continue;
            }
            this.handleCallGhostComm(step);
            return;
          }
          break;
        case 'CALL_MEDIATION':
          if (this.skipNextMediationStep) {
            this.skipNextMediationStep = false;
            continue;
          }
          if (this.isCallMediationStep(step)) {
            this.handleCallMediation(step);
            return;
          }
          break;
        case 'CHOICE':
          if (this.isChoiceStep(step)) {
            this.handleChoice(step);
            return;
          }
          break;
        case 'END':
          this.finishStory();
          return;
        default:
          // 未支援的指令直接略過
          break;
      }
    }

    this.finishStory();
  }

  private displayText(step: StoryTextStep) {
    this.clearChoices();
    const speaker = step.who?.trim();
    this.promptText.setText('點擊繼續').setVisible(false);
    this.awaitingInput = false;

    if (this.getTextDisplayMode(step) === 'CENTER') {
      this.showCenterText(step.text ?? '');
      return;
    }

    if (speaker) {
      this.showDialogueText(speaker, step.text ?? '');
      return;
    }

    this.showNarrationText(step.text ?? '');
  }

  private showNarrationText(text: string) {
    this.textBox.setVisible(true);
    this.dialogueContainer.setVisible(false);
    this.centerTextBox.setVisible(false);
    this.activeTextObject = this.textBox;
    this.textBox.setText('');
    this.promptText.setPosition(this.scale.width / 2, this.scale.height / 2 + 60);
    this.startTypewriter(text, this.textBox);
  }

  private showDialogueText(speaker: string, text: string) {
    this.textBox.setVisible(false);
    this.dialogueContainer.setVisible(true);
    this.centerTextBox.setVisible(false);
    this.speakerNameText.setText(speaker);
    this.dialogueText.setText('');
    this.activeTextObject = this.dialogueText;
    this.promptText.setPosition(
      this.dialogueContainer.x,
      this.dialogueContainer.y + this.dialogueBoxSize.height / 2 + 28
    );
    this.startTypewriter(text, this.dialogueText);
  }

  private showCenterText(text: string) {
    this.textBox.setVisible(false);
    this.dialogueContainer.setVisible(false);
    this.centerTextBox.setVisible(true);
    this.centerTextBox.setText('');
    this.activeTextObject = this.centerTextBox;
    this.promptText.setPosition(this.scale.width / 2, this.scale.height / 2 + 80);
    this.startTypewriter(text, this.centerTextBox);
  }

  private getTextDisplayMode(step: StoryTextStep): StoryTextDisplayMode {
    if (typeof step.display === 'string') {
      const normalized = step.display.trim().toUpperCase();
      if (normalized === 'CENTER') {
        return 'CENTER';
      }
    }
    return 'AUTO';
  }

  private handleGiveItem(step: StoryGiveItemStep) {
    const itemId = step.itemId;
    if (itemId && this.world) {
      this.world.grantItem(itemId);
    }

    const toastMessage = step.message ?? (itemId ? `獲得物品：${itemId}` : '獲得物品');
    this.showToast(toastMessage);
  }

  private handleUpdateFlag(step: StoryUpdateFlagStep) {
    if (!this.world || !step.flag) {
      return;
    }
    this.world.setFlag(step.flag, step.value);
    this.flagsUpdated.add(step.flag);
  }

  private handleCallGhostComm(step: StoryCallGhostCommStep) {
    this.promptText.setVisible(false);
    if (!this.router || !step.spiritId) {
      this.showToast('無法呼叫靈體溝通。');
      return;
    }

    const spiritId = step.spiritId;
    this.activeSpiritId = spiritId;

    void this.router
      .push<{ spiritId: string }, GhostCommResult>('GhostCommScene', {
        spiritId
      })
      .then(async (result) => {
        const resolvedKnots = Array.isArray(result?.resolvedKnots) ? result.resolvedKnots : [];
        const miasma = result?.miasma ?? this.world?.data.煞氣 ?? '未知';
        const resolvedSummary = resolvedKnots.length
          ? `已解結：${resolvedKnots.join('、')}`
          : '尚未解結';
        this.showToast(`靈體溝通完成，煞氣：${miasma}\n${resolvedSummary}`);

        if (result?.needPerson) {
          const needPerson = result.needPerson;
          if (!this.router) {
            this.showToast('缺少路由，無法調解。');
            return;
          }
          this.skipNextMediationStep = true;
          try {
            const mediationResult = await this.router.push<{ npcId: string }, MediationResult>(
              'MediationScene',
              { npcId: needPerson }
            );
            await this.processMediationResult(mediationResult, spiritId);
          } catch (error) {
            console.error(error);
            this.showToast('調解未完成。');
            this.skipNextMediationStep = false;
          }
        }
      })
      .catch(() => {
        this.showToast('靈體溝通未完成。');
      })
      .finally(() => {
        this.advance();
      });
  }

  private handleCallMediation(step: StoryCallMediationStep) {
    this.promptText.setVisible(false);
    if (!this.router || !step.npcId) {
      this.showToast('無法進行調解。');
      return;
    }

    void this.pushMediationScene(step.npcId, this.activeSpiritId)
      .catch(() => {
        this.showToast('調解未完成。');
      })
      .finally(() => {
        this.advance();
      });
  }

  private async pushMediationScene(npcId: string, spiritId?: string) {
    if (!this.router) {
      throw new Error('缺少路由，無法調解');
    }

    const result = await this.router.push<{ npcId: string }, MediationResult>('MediationScene', {
      npcId
    });

    await this.processMediationResult(result, spiritId);
  }

  private async processMediationResult(result: MediationResult, spiritId?: string) {
    const resolved = Array.isArray(result.resolved) ? result.resolved : [];
    const world = this.world;
    if (resolved.length && world) {
      resolved.forEach((obsessionId) => {
        if (!obsessionId) {
          return;
        }
        world.data.旗標[`obsession:${obsessionId}`] = '已解';
      });
    }

    const summary = resolved.length ? `已解決：${resolved.join('、')}` : '仍待努力';
    this.showToast(`調解階段：${result.stage}\n${summary}`);

    await this.updateSpiritResolution(spiritId);
  }

  private async updateSpiritResolution(spiritId?: string) {
    const targetSpiritId = spiritId ?? this.activeSpiritId;
    if (!targetSpiritId) {
      return;
    }

    const world = this.world;
    if (!world) {
      this.activeSpiritId = undefined;
      return;
    }

    const spirit = await this.getSpiritById(targetSpiritId);
    if (!spirit) {
      this.activeSpiritId = undefined;
      return;
    }

    const allResolved = spirit.執念?.length
      ? spirit.執念.every((obsession) => {
          const key = `obsession:${obsession.id}`;
          return world.data.旗標[key] === '已解';
        })
      : false;

    if (allResolved) {
      GhostDirector.markResolved(targetSpiritId, world);
      this.flagsUpdated.add(GhostDirector.getStateFlagKey(targetSpiritId));
    }

    this.activeSpiritId = undefined;
  }

  private async getSpiritById(spiritId: string): Promise<Spirit | undefined> {
    if (!spiritId) {
      return undefined;
    }

    if (this.spiritCache.has(spiritId)) {
      return this.spiritCache.get(spiritId);
    }

    if (!this.repo) {
      return undefined;
    }

    if (!this.spiritsLoaded) {
      try {
        const spirits = await this.repo.get<Spirit[]>('spirits');
        spirits.forEach((spiritEntry) => {
          this.spiritCache.set(spiritEntry.id, spiritEntry);
        });
        this.spiritsLoaded = true;
      } catch (error) {
        console.error('讀取靈體資料失敗', error);
        this.spiritsLoaded = true;
      }
    }

    return this.spiritCache.get(spiritId);
  }

  private isTextStep(step: StoryStep): step is StoryTextStep {
    return step.t === 'TEXT' && typeof (step as Partial<StoryTextStep>).text === 'string';
  }

  private isGiveItemStep(step: StoryStep): step is StoryGiveItemStep {
    return step.t === 'GIVE_ITEM' && typeof (step as Partial<StoryGiveItemStep>).itemId === 'string';
  }

  private isUpdateFlagStep(step: StoryStep): step is StoryUpdateFlagStep {
    return step.t === 'UPDATE_FLAG' && typeof (step as Partial<StoryUpdateFlagStep>).flag === 'string';
  }

  private isCallGhostCommStep(step: StoryStep): step is StoryCallGhostCommStep {
    return step.t === 'CALL_GHOST_COMM' && typeof (step as Partial<StoryCallGhostCommStep>).spiritId === 'string';
  }

  private isCallMediationStep(step: StoryStep): step is StoryCallMediationStep {
    return step.t === 'CALL_MEDIATION' && typeof (step as Partial<StoryCallMediationStep>).npcId === 'string';
  }

  private isScreenEffectStep(step: StoryStep): step is StoryScreenEffectStep {
    return step.t === 'SCREEN_EFFECT' && typeof (step as Partial<StoryScreenEffectStep>).effectId === 'string';
  }

  private isChoiceStep(step: StoryStep): step is StoryChoiceStep {
    if (step.t !== 'CHOICE') {
      return false;
    }
    const options = (step as Partial<StoryChoiceStep>).options;
    return Array.isArray(options) && options.length > 0;
  }

  private handleChoice(step: StoryChoiceStep) {
    this.awaitingInput = false;
    this.awaitingChoice = true;
    this.promptText.setText('選擇一個行動').setVisible(true);
    const { width, height } = this.scale;
    const startY = height / 2 + 20;
    const optionSpacing = 34;

    step.options.forEach((option, index) => {
      const label = `${index + 1}. ${option.text}`;
      const optionText = this.add
        .text(width / 2, startY + index * optionSpacing, label, {
          ...zhBase,
          fontSize: '20px',
          color: '#ddd',
          align: 'center',
          wordWrap: { width: width - 160 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      optionText.on('pointerover', () => {
        optionText.setStyle({ color: '#fff' });
      });
      optionText.on('pointerout', () => {
        optionText.setStyle({ color: '#ddd' });
      });
      optionText.on('pointerup', () => {
        this.selectChoiceOption(option);
      });

      this.choiceTexts.push(optionText);
    });
  }

  private selectChoiceOption(option: StoryChoiceOption) {
    if (!this.awaitingChoice) {
      return;
    }
    this.awaitingChoice = false;
    this.clearChoices();

    switch (option.action) {
      case 'GOTO_LINE': {
        const jumped = this.jumpToLine(option.targetLineId);
        this.advanceAfterChoice(jumped);
        break;
      }
      case 'START_STORY':
        if (!this.router) {
          this.showToast('缺少路由，無法開啟新劇情。');
          this.advanceAfterChoice(false);
          return;
        }
        this.promptText.setVisible(false);
        void this.router.push('StoryScene', { storyId: option.storyId }).catch((error) => {
          console.error(error);
          this.showToast('無法開啟指定劇情。');
        });
        this.finishStory();
        break;
      case 'CALL_GHOST_COMM':
        this.schedulePendingJump(option.nextLineId);
        this.handleCallGhostComm({ t: 'CALL_GHOST_COMM', spiritId: option.spiritId, lineId: option.nextLineId });
        break;
      case 'CALL_MEDIATION':
        this.schedulePendingJump(option.nextLineId);
        this.handleCallMediation({ t: 'CALL_MEDIATION', npcId: option.npcId, lineId: option.nextLineId });
        break;
      case 'END':
        this.finishStory();
        break;
      default:
        this.advanceAfterChoice(false);
        break;
    }
  }

  private advanceAfterChoice(success: boolean) {
    if (!success) {
      this.promptText.setVisible(false);
    }
    this.advance();
  }

  private schedulePendingJump(lineId?: string) {
    this.pendingLineJump = lineId ?? undefined;
  }

  private clearChoices() {
    if (this.choiceTexts.length) {
      this.choiceTexts.forEach((text) => text.destroy());
      this.choiceTexts = [];
    }
    if (this.awaitingChoice) {
      this.awaitingChoice = false;
      this.promptText.setVisible(false);
    }
  }

  private startTypewriter(text: string, target: Phaser.GameObjects.Text) {
    this.cancelTypewriter();
    this.typewriterFullText = text;
    this.typewriterIndex = 0;
    this.typewriterActive = true;
    this.activeTextObject = target;
    target.setText('');

    if (!text || text.length === 0) {
      this.completeTypewriter();
      return;
    }

    const delay = this.getTypewriterDelay();
    const typewriterTarget = target;
    this.typewriterTimer = this.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        this.typewriterIndex++;
        typewriterTarget.setText(this.typewriterFullText.slice(0, this.typewriterIndex));
        if (this.typewriterIndex >= this.typewriterFullText.length) {
          this.completeTypewriter();
        }
      }
    });
  }

  private getTypewriterDelay() {
    return 40;
  }

  private cancelTypewriter() {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove(false);
      this.typewriterTimer = undefined;
    }
    this.typewriterActive = false;
  }

  private isTypewriterRunning() {
    return this.typewriterActive;
  }

  private completeTypewriter() {
    if (!this.typewriterActive) {
      if (!this.awaitingInput) {
        this.awaitingInput = true;
        this.promptText.setText('點擊繼續').setVisible(true);
      }
      return;
    }

    this.cancelTypewriter();
    this.typewriterIndex = this.typewriterFullText.length;
    if (this.activeTextObject) {
      this.activeTextObject.setText(this.typewriterFullText);
    }
    this.awaitingInput = true;
    this.promptText.setText('點擊繼續').setVisible(true);
  }

  private clearScreenEffectTimer() {
    if (this.screenEffectTimer) {
      this.screenEffectTimer.remove(false);
      this.screenEffectTimer = undefined;
    }
  }

  private handleScreenEffect(step: StoryScreenEffectStep) {
    if (this.screenEffectInProgress) {
      return;
    }

    const camera = this.cameras.main;
    if (!camera) {
      this.advance();
      return;
    }

    this.awaitingInput = false;
    this.promptText.setVisible(false);
    this.screenEffectInProgress = true;
    this.clearScreenEffectTimer();

    const duration = Math.max(0, step.duration ?? 600);
    const color = this.parseColor(step.color);
    const effectId = (step.effectId ?? 'FLASH').toString().trim().toUpperCase() || 'FLASH';

    const finishEffect = () => {
      this.screenEffectTimer = undefined;
      this.screenEffectInProgress = false;
      if (this.finished) {
        return;
      }
      this.advance();
    };

    switch (effectId) {
      case 'FLASH':
      case 'FLASH_WHITE':
      case 'FLASH_COLOR':
        camera.flash(duration, color.r, color.g, color.b);
        this.screenEffectTimer = this.time.delayedCall(duration, finishEffect);
        break;
      case 'SHAKE':
        camera.shake(duration, 0.01);
        this.screenEffectTimer = this.time.delayedCall(duration, finishEffect);
        break;
      case 'FADE_OUT':
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          finishEffect();
        });
        camera.fadeOut(duration, color.r, color.g, color.b);
        break;
      case 'FADE_IN':
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
          finishEffect();
        });
        camera.fadeIn(duration, color.r, color.g, color.b);
        break;
      default:
        camera.flash(duration, color.r, color.g, color.b);
        this.screenEffectTimer = this.time.delayedCall(duration, finishEffect);
        break;
    }
  }

  private parseColor(color?: string) {
    if (!color) {
      return { r: 255, g: 255, b: 255 };
    }

    try {
      const converted = Phaser.Display.Color.HexStringToColor(color);
      if (converted) {
        return { r: converted.red, g: converted.green, b: converted.blue };
      }
    } catch (error) {
      console.warn('無法解析顏色值', color, error);
    }

    return { r: 255, g: 255, b: 255 };
  }

  private jumpToLine(lineId: string | undefined): boolean {
    if (!lineId) {
      return false;
    }
    const index = this.lineIndexById.get(lineId);
    if (index === undefined) {
      this.showToast(`找不到段落：${lineId}`);
      return false;
    }
    this.stepIndex = index;
    return true;
  }

  private indexStoryLines() {
    this.lineIndexById.clear();
    this.steps.forEach((step, index) => {
      const lineId = this.getLineId(step);
      if (!lineId) {
        return;
      }
      if (this.lineIndexById.has(lineId)) {
        console.warn(`重複的劇情段落編號：${lineId}`);
      }
      this.lineIndexById.set(lineId, index);
    });
  }

  private getLineId(step: StoryStep): string | undefined {
    return (step as StoryBaseStep)?.lineId;
  }

  private showToast(message: string) {
    const { width, height } = this.scale;
    const toast = this.add
      .text(width - 16, height - 16, message, {
        ...zhBase,
        fontSize: '16px',
        backgroundColor: '#000000aa',
        padding: { ...zhBase.padding, left: 12, right: 12 },
        wordWrap: { width: width / 2 }
      })
      .setOrigin(1, 1);

    this.time.delayedCall(2000, () => {
      toast.destroy();
    });
  }

  private showErrorAndExit(message: string) {
    this.textBox.setVisible(true);
    this.dialogueContainer.setVisible(false);
    this.centerTextBox.setVisible(false);
    this.activeTextObject = this.textBox;
    this.textBox.setText(message);
    this.promptText.setText('點擊返回').setVisible(true);
    const handler = () => {
      this.input.off('pointerup', handler);
      this.finishStory();
    };
    this.input.once('pointerup', handler);
  }

  private finishStory() {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.clearChoices();
    this.cancelTypewriter();
    this.screenEffectInProgress = false;
    this.clearScreenEffectTimer();
    if (this.storyLoaded && this.storyId && this.world) {
      const flagKey = `story:${this.storyId}`;
      this.world.setFlag(flagKey, true);
      this.flagsUpdated.add(flagKey);
    }

    this.bus?.emit('autosave');
    this.done({ flagsUpdated: Array.from(this.flagsUpdated) });
  }
}
