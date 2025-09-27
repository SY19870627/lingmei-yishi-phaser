import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { WorldState } from '@core/WorldState';
import type { Router } from '@core/Router';

type StoryTextStep = { t: 'TEXT'; who?: string; text: string };
type StoryGiveItemStep = { t: 'GIVE_ITEM'; itemId: string; message?: string };
type StoryUpdateFlagStep = { t: 'UPDATE_FLAG'; flag: string; value: unknown };
type StoryEndStep = { t: 'END' };
type StoryCallGhostCommStep = { t: 'CALL_GHOST_COMM'; spiritId: string };
type StoryStep =
  | StoryTextStep
  | StoryGiveItemStep
  | StoryUpdateFlagStep
  | StoryEndStep
  | StoryCallGhostCommStep
  | { t: string; [key: string]: unknown };

type StoryNode = {
  id: string;
  steps: StoryStep[];
};

type GhostCommResult = { resolvedKnots: string[]; miasma: string };

export default class StoryScene extends ModuleScene<{ storyId: string }, { flagsUpdated: string[] }> {
  private steps: StoryStep[] = [];
  private stepIndex = 0;
  private awaitingInput = false;
  private finished = false;
  private flagsUpdated = new Set<string>();
  private world?: WorldState;
  private repo?: DataRepo;
  private router?: Router;
  private textBox!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;

  constructor() {
    super('StoryScene');
  }

  async create() {
    const { width, height } = this.scale;

    this.textBox = this.add
      .text(width / 2, height / 2 - 40, '', {
        fontSize: '24px',
        color: '#fff',
        align: 'center',
        wordWrap: { width: width - 120 }
      })
      .setOrigin(0.5);

    this.promptText = this.add
      .text(width / 2, height / 2 + 60, '點擊繼續', {
        fontSize: '18px',
        color: '#ccc'
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.input.on('pointerup', () => {
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

    this.repo = this.registry.get('repo') as DataRepo | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;
    this.router = this.registry.get('router') as Router | undefined;

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

  private advance() {
    while (this.stepIndex < this.steps.length) {
      const step = this.steps[this.stepIndex++];
      switch (step.t) {
        case 'TEXT':
          if (this.isTextStep(step)) {
            this.displayText(step);
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
            this.handleCallGhostComm(step);
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
    const lines = step.who ? `${step.who}：${step.text}` : step.text;
    this.textBox.setText(lines);
    this.promptText.setVisible(true);
    this.awaitingInput = true;
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
    if (!this.router || !step.spiritId) {
      this.showToast('無法呼叫靈體溝通。');
      return;
    }

    void this.router
      .push<{ spiritId: string }, GhostCommResult>('GhostCommScene', {
        spiritId: step.spiritId
      })
      .then((result) => {
        const resolvedSummary = result.resolvedKnots.length
          ? `已解結：${result.resolvedKnots.join('、')}`
          : '尚未解結';
        this.showToast(`靈體溝通完成，煞氣：${result.miasma}\n${resolvedSummary}`);
      })
      .catch(() => {
        this.showToast('靈體溝通未完成。');
      })
      .finally(() => {
        this.advance();
      });
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

  private showToast(message: string) {
    const { width, height } = this.scale;
    const toast = this.add
      .text(width - 16, height - 16, message, {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#000000aa',
        padding: { x: 12, y: 6 },
        wordWrap: { width: width / 2 }
      })
      .setOrigin(1, 1);

    this.time.delayedCall(2000, () => {
      toast.destroy();
    });
  }

  private showErrorAndExit(message: string) {
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
    this.done({ flagsUpdated: Array.from(this.flagsUpdated) });
  }
}
