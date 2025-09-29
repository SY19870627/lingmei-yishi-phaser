import Phaser from 'phaser';
import { ModuleScene, Router } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import { SpawnDirector, type DirectedAnchor } from '@core/SpawnDirector';
import type { Anchor, MapDef, Spirit, StoryNode } from '@core/Types';
import MapArt from '@ui/MapArt';
import { GhostDirector } from '@core/GhostDirector';
import HintsManager from '@core/HintsManager';

type AnchorEntry = { anchor?: DirectedAnchor; text: Phaser.GameObjects.Text };
type StoryEntry = { story?: StoryNode; text: Phaser.GameObjects.Text };

export default class MapScene extends ModuleScene {
  private world?: WorldState;
  private router?: Router;
  private anchors: Anchor[] = [];
  private stories: StoryNode[] = [];
  private spirits: Spirit[] = [];
  private currentLocation = '未知';
  private statusLabel?: Phaser.GameObjects.Text;
  private messageLabel?: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;
  private locationEntries: AnchorEntry[] = [];
  private storyEntries: StoryEntry[] = [];
  private director = new SpawnDirector();
  private accessibleAnchors: DirectedAnchor[] = [];
  private hintIndicator?: Phaser.GameObjects.Container;
  private mapArt?: MapArt;
  private isTransitioning = false;

  constructor() {
    super('MapScene');
  }

  async create() {
    const { width, height } = this.scale;

    this.mapArt = new MapArt(this);

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

    const indicatorDot = this.add.circle(0, 0, 6, 0xff4d4d);
    indicatorDot.setOrigin(0.5);
    const indicatorLabel = this.add.text(12, -8, '有提示', {
      fontSize: '16px',
      color: '#fff'
    });
    indicatorLabel.setOrigin(0, 0);
    this.hintIndicator = this.add.container(width - 140, 72, [indicatorDot, indicatorLabel]);
    this.hintIndicator.setVisible(false);

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
      const [anchors, stories, spirits, maps] = await Promise.all([
        repo.get<Anchor[]>('anchors'),
        repo.get<StoryNode[]>('stories'),
        repo.get<Spirit[]>('spirits'),
        repo.get<MapDef[]>('maps')
      ]);
      this.anchors = anchors;
      this.stories = stories;
      this.spirits = spirits;
      this.mapArt?.setMaps(maps);
      this.refreshMapState();
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

  private renderLocationList(x: number, startY: number) {
    this.locationEntries.forEach(({ text }) => text.destroy());
    this.locationEntries = [];

    this.accessibleAnchors = this.director.listAccessibleAnchors(this.world, this.anchors, this.stories, this.spirits);

    if (this.accessibleAnchors.length === 0) {
      const text = this.add
        .text(x, startY, '目前沒有可去地點', {
          fontSize: '20px',
          color: '#fff'
        })
        .setOrigin(0, 0);
      text.disableInteractive();
      this.locationEntries.push({ text });
      return;
    }

    this.accessibleAnchors.forEach((anchor, index) => {
      const isCurrent = anchor.地點 === this.currentLocation;
      const serviceSpiritId = anchor.meta?.service?.spiritId;
      const ghostState = GhostDirector.getState(serviceSpiritId ?? '', this.world);
      const resolved = ghostState === '安息' || Boolean(anchor.meta?.resolved);
      const displayText = resolved ? '　' : `${isCurrent ? '★' : '・'}${anchor.地點}`;
      const color = resolved ? '#444' : isCurrent ? '#ff0' : '#aaf';
      const text = this.add
        .text(x, startY + index * 32, displayText, {
          fontSize: '20px',
          color
        })
        .setOrigin(0, 0);

      if (!resolved && !isCurrent) {
        text.setInteractive({ useHandCursor: true });
        text.on('pointerup', () => {
          this.handleLocationClick(anchor);
        });
      } else {
        text.disableInteractive();
      }

      this.locationEntries.push({ anchor, text });
    });
  }

  private handleLocationClick(anchor: DirectedAnchor) {
    if (!this.world) {
      this.showMessage('無法更新位置：缺少世界狀態');
      return;
    }

    if (this.isTransitioning) {
      return;
    }

    const destination = anchor.地點;
    if (destination === this.currentLocation) {
      this.showMessage('已在此地');
      return;
    }

    this.beginLocationTransition(destination);
  }

  private beginLocationTransition(destination: string) {
    const world = this.world;
    if (!world) {
      return;
    }

    this.isTransitioning = true;
    this.showMessage('移動中……');

    const camera = this.cameras.main;
    if (!camera) {
      world.data.位置 = destination;
      this.currentLocation = destination;
      this.refreshMapState();
      this.showMessage(`已移動至 ${destination}`);
      this.isTransitioning = false;
      return;
    }

    const duration = 400;

    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      world.data.位置 = destination;
      this.currentLocation = destination;
      this.refreshMapState();
      camera.fadeIn(duration, 0, 0, 0);
    });

    camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.showMessage(`已移動至 ${destination}`);
      this.isTransitioning = false;
    });

    camera.fadeOut(duration, 0, 0, 0);

    this.time.delayedCall(duration * 2 + 100, () => {
      if (!this.isTransitioning) {
        return;
      }
      world.data.位置 = destination;
      this.currentLocation = destination;
      this.refreshMapState();
      this.showMessage(`已移動至 ${destination}`);
      this.isTransitioning = false;
    });
  }

  private renderStoryList() {
    this.storyEntries.forEach(({ text }) => text.destroy());
    this.storyEntries = [];

    const storyStartX = this.scale.width / 2 + 40;
    const storyStartY = 168;

    const currentAnchor = this.anchors.find((anchor) => anchor.地點 === this.currentLocation);
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

    const accessibleAnchor = this.accessibleAnchors.find((anchor) => anchor.id === currentAnchor.id);
    if (!accessibleAnchor) {
      const text = this.add
        .text(storyStartX, storyStartY, '錨點條件未滿足，暫不可進行', {
          fontSize: '18px',
          color: '#fff'
        })
        .setOrigin(0, 0);
      this.storyEntries.push({ text });
      text.disableInteractive();
      return;
    }

    if (accessibleAnchor.meta?.resolved) {
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

    const startableStories = this.director.listStartableStories(this.world, this.stories, currentAnchor.id);

    if (startableStories.length === 0) {
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

    startableStories.forEach((story, index) => {
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

    if (this.isStoryFinished(story)) {
      this.showMessage('劇情已完成');
      this.renderStoryList();
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
    this.renderLocationList(32, 168);
    this.renderStoryList();
    this.updateHintIndicator();
    void this.mapArt?.show(this.getMapIdForLocation(this.currentLocation));
  }

  private getMapIdForLocation(location: string): string | undefined {
    const anchor = this.anchors.find((item) => item.地點 === location);
    return anchor?.mapId;
  }

  private updateStatusLabel() {
    if (!this.statusLabel) {
      return;
    }
    this.statusLabel.setText(`當前位置：${this.currentLocation}`);
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

  private isStoryFinished(story: StoryNode): boolean {
    const flagKey = `story:${story.id}`;
    const flags = this.world?.data?.旗標 ?? {};
    return Boolean(flags[flagKey]);
  }

  private updateHintIndicator() {
    if (!this.hintIndicator) {
      return;
    }

    const hints = HintsManager.gather(this.world, this.spirits, this.anchors, this.stories);
    this.hintIndicator.setVisible(hints.length > 0);
  }
}
