import Phaser from 'phaser';
import { ModuleScene, Router } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import type { Anchor, StoryNode } from '@core/Types';

type AnchorEntry = { anchor: Anchor; text: Phaser.GameObjects.Text };
type StoryEntry = { story?: StoryNode; text: Phaser.GameObjects.Text };

export default class MapScene extends ModuleScene {
  private world?: WorldState;
  private router?: Router;
  private anchors: Anchor[] = [];
  private stories: StoryNode[] = [];
  private currentLocation = '未知';
  private statusLabel?: Phaser.GameObjects.Text;
  private messageLabel?: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;
  private locationEntries: AnchorEntry[] = [];
  private storyEntries: StoryEntry[] = [];

  constructor() {
    super('MapScene');
  }

  async create() {
    const { width, height } = this.scale;

    const repo = this.registry.get('repo') as DataRepo | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;
    this.router = this.registry.get('router') as Router | undefined;

    this.currentLocation = this.world?.data?.位置 ?? '未知';

    this.add
      .text(width / 2, 24, '地圖', {
        fontSize: '28px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);

    this.statusLabel = this.add
      .text(32, 72, '', {
        fontSize: '18px',
        color: '#fff',
        lineSpacing: 6
      })
      .setOrigin(0, 0);

    this.messageLabel = this.add
      .text(width / 2, height - 24, '', {
        fontSize: '18px',
        color: '#fff'
      })
      .setOrigin(0.5, 1);

    const saveButton = this.add
      .text(width - 16, 16, '存檔', {
        fontSize: '18px',
        color: '#aaf'
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    saveButton.on('pointerup', () => {
      const saver = this.registry.get('saver');
      if (saver && typeof saver.save === 'function') {
        saver.save(0);
      }
      this.showMessage('已存檔');
    });

    const closeButton = this.add
      .text(width - 16, height - 24, '返回', {
        fontSize: '18px',
        color: '#aaf'
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    closeButton.on('pointerup', () => {
      this.done(undefined);
    });

    this.add
      .text(32, 128, '可去地點', {
        fontSize: '20px',
        color: '#fff'
      })
      .setOrigin(0, 0);

    this.add
      .text(width / 2 + 40, 128, '可啟動劇情', {
        fontSize: '20px',
        color: '#fff'
      })
      .setOrigin(0, 0);

    this.updateStatusLabel();

    if (!repo) {
      this.showMessage('無法載入地圖資料：缺少資料倉庫');
      return;
    }

    try {
      const [anchors, stories] = await Promise.all([
        repo.get<Anchor[]>('anchors'),
        repo.get<StoryNode[]>('stories')
      ]);
      this.anchors = anchors;
      this.stories = stories;
      this.buildLocationList(32, 168);
      this.refreshStoryList();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showMessage(`載入資料失敗：${message}`);
    }

    this.events.on(Phaser.Scenes.Events.RESUME, this.handleResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.handleResume, this);
      if (this.messageTimer) {
        this.messageTimer.remove(false);
        this.messageTimer = undefined;
      }
    });
  }

  private buildLocationList(x: number, startY: number) {
    this.locationEntries.forEach(({ text }) => text.destroy());
    this.locationEntries = [];

    if (this.anchors.length === 0) {
      const text = this.add
        .text(x, startY, '目前沒有可去地點', {
          fontSize: '20px',
          color: '#fff'
        })
        .setOrigin(0, 0);
      text.disableInteractive();
      return;
    }

    this.anchors.forEach((anchor, index) => {
      const text = this.add
        .text(x, startY + index * 32, '', {
          fontSize: '20px',
          color: '#aaf'
        })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      text.on('pointerup', () => {
        this.handleLocationClick(anchor);
      });

      this.locationEntries.push({ anchor, text });
    });

    this.updateLocationEntries();
  }

  private updateLocationEntries() {
    this.locationEntries.forEach(({ anchor, text }) => {
      const isCurrent = anchor.地點 === this.currentLocation;
      const cleared = this.isAnchorCleared(anchor);
      const label = cleared ? '（已送行）' : anchor.地點;
      text.setText(`${isCurrent ? '★' : '・'}${label}`);
      if (cleared) {
        text.setStyle({ color: '#777' });
        text.disableInteractive();
        return;
      }

      text.setStyle({ color: isCurrent ? '#ff0' : '#aaf' });
      if (isCurrent) {
        text.disableInteractive();
      } else {
        text.setInteractive({ useHandCursor: true });
      }
    });
  }

  private handleLocationClick(anchor: Anchor) {
    if (!this.world) {
      this.showMessage('無法更新位置：缺少世界狀態');
      return;
    }

    const destination = anchor.地點;
    if (destination === this.currentLocation) {
      this.showMessage('已在此地');
      return;
    }

    if (!this.canEnterLocation(destination)) {
      this.showMessage('同行者不願進入');
      return;
    }

    this.world.data.位置 = destination;
    this.currentLocation = destination;

    this.showMessage(`已移動至 ${destination}`);
    this.updateStatusLabel();
    this.updateLocationEntries();
    this.refreshStoryList();
  }

  private refreshStoryList() {
    this.storyEntries.forEach(({ text }) => text.destroy());
    this.storyEntries = [];

    const storyStartX = this.scale.width / 2 + 40;
    const storyStartY = 168;

    const currentAnchor = this.anchors.find((anchor) => anchor.地點 === this.currentLocation);
    const anchorCleared = currentAnchor ? this.isAnchorCleared(currentAnchor) : false;
    const candidateStories = currentAnchor && !anchorCleared
      ? this.stories.filter((story) => story.anchor === currentAnchor.id)
      : [];

    if (!currentAnchor) {
      const text = this.add
        .text(storyStartX, storyStartY, '尚未定位到錨點', {
          fontSize: '18px',
          color: '#fff'
        })
        .setOrigin(0, 0);
      this.storyEntries.push({ text });
      text.disableInteractive();
      return;
    }

    if (anchorCleared) {
      const text = this.add
        .text(storyStartX, storyStartY, '此處已送行，靜候新緣', {
          fontSize: '18px',
          color: '#fff'
        })
        .setOrigin(0, 0);
      this.storyEntries.push({ text });
      text.disableInteractive();
      return;
    }

    if (candidateStories.length === 0) {
      const text = this.add
        .text(storyStartX, storyStartY, '目前沒有可啟動的劇情', {
          fontSize: '18px',
          color: '#fff'
        })
        .setOrigin(0, 0);
      this.storyEntries.push({ text });
      text.disableInteractive();
      return;
    }

    candidateStories.forEach((story, index) => {
      const text = this.add
        .text(storyStartX, storyStartY + index * 32, `・${story.id}`, {
          fontSize: '20px',
          color: '#aaf'
        })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      text.on('pointerup', () => {
        void this.launchStory(story, text);
      });

      this.storyEntries.push({ story, text });
    });
  }

  private async launchStory(story: StoryNode, text: Phaser.GameObjects.Text) {
    if (!this.router) {
      this.showMessage('無法啟動劇情：缺少路由');
      return;
    }

    text.disableInteractive();
    text.setStyle({ color: '#ff0' });
    this.showMessage('劇情進行中……');

    let completed = false;

    try {
      await this.router.push('StoryScene', { storyId: story.id });
      completed = true;
      this.showMessage('劇情已完成');
    } catch (error) {
      this.showMessage('劇情未完成');
    } finally {
      if (!completed) {
        text.setStyle({ color: '#aaf' });
        text.setInteractive({ useHandCursor: true });
      }
      this.refreshMapState();
    }
  }

  private handleResume() {
    this.refreshMapState();
  }

  private refreshMapState() {
    this.currentLocation = this.world?.data?.位置 ?? this.currentLocation;
    this.updateStatusLabel();
    this.updateLocationEntries();
    this.refreshStoryList();
  }

  private updateStatusLabel() {
    if (!this.statusLabel) {
      return;
    }
    const flagEntries = Object.entries(this.world?.data?.旗標 ?? {});
    const flagText = flagEntries.length
      ? flagEntries.map(([key, value]) => `${key}: ${String(value)}`).join('\n')
      : '目前沒有旗標資料';
    this.statusLabel.setText(`當前位置：${this.currentLocation}\n旗標：\n${flagText}`);
  }

  private showMessage(message: string) {
    if (!this.messageLabel) {
      return;
    }
    this.messageLabel.setText(message);
    if (this.messageTimer) {
      this.messageTimer.remove(false);
    }
    this.messageTimer = this.time.delayedCall(2000, () => {
      if (this.messageLabel) {
        this.messageLabel.setText('');
      }
    });
  }

  private canEnterLocation(locationName: string): boolean {
    // 先用假條件：只有地點名稱包含「廳堂」時視為同行者願意進入。
    return locationName.includes('廳堂');
  }

  private isAnchorCleared(anchor: Anchor): boolean {
    const clearedSpirits = this.world?.data?.已安息靈 ?? [];
    const serviceSpirit = anchor.服務靈;
    return !!serviceSpirit && clearedSpirits.includes(serviceSpirit);
  }
}
