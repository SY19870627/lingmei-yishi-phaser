import Phaser from 'phaser';
import { ModuleScene, Router } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import type { Anchor, MapDef } from '@core/Types';
import MiasmaIndicator from '@ui/MiasmaIndicator';

export default class ShellScene extends ModuleScene {
  private world?: WorldState;
  private router?: Router;
  private anchors: Anchor[] = [];
  private maps = new Map<string, MapDef>();
  private lastLocation?: string;
  private currentMapId?: string;
  private pendingMapId?: string;
  private mapThumbContainer?: Phaser.GameObjects.Container;
  private mapThumbImage?: Phaser.GameObjects.Image;
  private mapThumbOverlay?: Phaser.GameObjects.Graphics;

  private readonly handleResize = (gameSize: Phaser.Structs.Size) => {
    this.positionThumbnail(gameSize.width);
  };

  private readonly handleResume = () => {
    const newLocation = this.world?.data?.位置;
    const locationChanged = newLocation !== this.lastLocation;
    this.lastLocation = newLocation;
    void this.updateMapThumbnail(locationChanged);
  };

  constructor() {
    super('ShellScene');
  }

  preload() {
    this.load.image('shell-background', 'images/title/base-title-screen-variant_02.png');
  }

  create() {
    const { width, height } = this.scale;
    const world = (this.world = this.registry.get('world') as WorldState | undefined);
    this.router = this.registry.get('router') as Router | undefined;
    const repo = this.registry.get('repo') as DataRepo | undefined;

    const background = this.add.image(width / 2, height / 2, 'shell-background');
    const backgroundScale = Math.max(width / background.width, height / background.height);
    background.setScale(backgroundScale);

    this.lastLocation = world?.data?.位置;

    this.scale.on('resize', this.handleResize);
    this.events.on(Phaser.Scenes.Events.RESUME, this.handleResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize);
      this.events.off(Phaser.Scenes.Events.RESUME, this.handleResume);
      this.destroyThumbnail();
    });

    const hudText = this.add
      .text(60, 16, '', {
        fontSize: '16px',
        color: '#fff'
      })
      .setOrigin(0, 0);

    const miasmaIndicator = new MiasmaIndicator(this, width - 180, 100, {
      width: 240,
      height: 140
    });
    miasmaIndicator.setMiasma(world?.data?.煞氣 ?? '清');

    const updateHud = () => {
      const location = this.world?.data?.位置 ?? '';
      const sha = this.world?.data?.煞氣 ?? '';
      const yin = this.world?.data?.陰德 ?? '';
      hudText.setText(`位置：${location}\n煞氣：${sha}\n陰德：${yin}`);
      miasmaIndicator.setMiasma(this.world?.data?.煞氣 ?? '清');
    };

    updateHud();

    this.time.addEvent({ delay: 200, loop: true, callback: updateHud });

    const mapButton = this.add
      .text(width / 2, height / 2, '開啟地圖', {
        fontSize: '24px',
        color: '#621e1eff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    mapButton.on('pointerup', () => {
      this.router?.push('MapScene');
    });

    const inventoryButton = this.add
      .text(width / 2, height / 2 + 60, '物品', {
        fontSize: '24px',
        color: '#621e1eff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const pickedLabel = this.add
      .text(16, height - 16, '選擇的物品：無', {
        fontSize: '16px',
        color: '#621e1eff'
      })
      .setOrigin(0, 1);

    inventoryButton.on('pointerup', async () => {
      if (!this.router) {
        return;
      }
      const picked = await this.router.push<string | null>('InventoryScene');
      pickedLabel.setText(`選擇的物品：${picked ?? '無'}`);
    });

    const wordCardsButton = this.add
      .text(width / 2, height / 2 + 120, '字卡', {
        fontSize: '24px',
        color: '#621e1eff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    wordCardsButton.on('pointerup', () => {
      this.router?.push('WordCardsScene');
    });

    const hintsButton = this.add
      .text(width / 2, height / 2 + 180, '提示', {
        fontSize: '24px',
        color: '#621e1eff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    hintsButton.on('pointerup', () => {
      this.router?.push('HintsScene');
    });

    const settingsButton = this.add
      .text(width / 2, height / 2 + 240, '設定', {
        fontSize: '24px',
        color: '#621e1eff'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    settingsButton.on('pointerup', () => {
      this.router?.push('SettingsScene');
    });

    void this.prepareThumbnail(repo);
  }

  private async prepareThumbnail(repo: DataRepo | undefined) {
    if (!repo) {
      await this.updateMapThumbnail(true);
      return;
    }

    try {
      const [anchors, maps] = await Promise.all([
        repo.get<Anchor[]>('anchors'),
        repo.get<MapDef[]>('maps')
      ]);
      this.anchors = anchors;
      this.maps.clear();
      maps.forEach((map) => this.maps.set(map.id, map));
    } catch (error) {
      console.warn('Failed to load map metadata', error);
    }

    await this.updateMapThumbnail(true);
  }

  private async updateMapThumbnail(forceReload = false) {
    const location = this.world?.data?.位置;
    if (!location) {
      this.clearThumbnail();
      return;
    }

    const anchor = this.findAnchorByLocation(location);
    if (!anchor?.mapId) {
      this.clearThumbnail();
      return;
    }

    const mapDef = this.maps.get(anchor.mapId);
    if (!mapDef) {
      this.clearThumbnail();
      return;
    }

    const textureKey = this.getTextureKey(mapDef.id);
    if (!forceReload && this.currentMapId === mapDef.id && this.mapThumbImage) {
      this.updateCompletionMark(anchor);
      return;
    }

    this.pendingMapId = mapDef.id;

    if (!this.textures.exists(textureKey)) {
      try {
        await this.loadTexture(textureKey, mapDef.image);
      } catch (error) {
        if (this.pendingMapId === mapDef.id) {
          this.pendingMapId = undefined;
        }
        console.warn(error);
        return;
      }
    }

    if (this.pendingMapId !== mapDef.id) {
      return;
    }

    this.pendingMapId = undefined;
    this.displayThumbnail(textureKey);
    this.currentMapId = mapDef.id;
    this.updateCompletionMark(anchor);
  }

  private displayThumbnail(textureKey: string) {
    const container = this.ensureThumbnailContainer();

    let image = this.mapThumbImage;
    if (!image) {
      image = this.add.image(0, 0, textureKey).setOrigin(0, 0);
      container.add(image);
      this.mapThumbImage = image;
    } else {
      image.setTexture(textureKey);
    }

    image.setDisplaySize(160, 90);
    image.setVisible(true);

    container.setVisible(true);
    if (this.mapThumbOverlay) {
      container.bringToTop(this.mapThumbOverlay);
    }
  }

  private clearThumbnail() {
    this.mapThumbImage?.setVisible(false);
    this.mapThumbOverlay?.clear();
    this.mapThumbOverlay?.setVisible(false);
    this.mapThumbContainer?.setVisible(false);
    this.currentMapId = undefined;
    this.pendingMapId = undefined;
  }

  private updateCompletionMark(anchor?: Anchor) {
    const overlay = this.ensureCompletionOverlay();
    overlay.clear();

    if (!anchor) {
      overlay.setVisible(false);
      return;
    }

    const resolved = this.isAnchorResolved(anchor);
    if (!resolved) {
      overlay.setVisible(false);
      return;
    }

    overlay.setVisible(true);
    if (this.mapThumbContainer && overlay.parentContainer === this.mapThumbContainer) {
      this.mapThumbContainer.bringToTop(overlay);
    }

    overlay.fillStyle(0x000000, 0.65);
    overlay.fillCircle(160 - 12, 90 - 12, 12);
    overlay.lineStyle(2, 0xffffff, 1);
    overlay.strokeCircle(160 - 12, 90 - 12, 12);
    overlay.lineStyle(3, 0x6cf57c, 1);
    overlay.beginPath();
    overlay.moveTo(160 - 20, 90 - 14);
    overlay.lineTo(160 - 15, 90 - 8);
    overlay.lineTo(160 - 6, 90 - 18);
    overlay.strokePath();
  }

  private ensureThumbnailContainer(): Phaser.GameObjects.Container {
    if (!this.mapThumbContainer) {
      const container = this.add.container(0, 0);
      const background = this.add
        .rectangle(0, 0, 160, 90, 0x000000, 0.35)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.4);
      container.add(background);
      container.setSize(160, 90);
      container.setDepth(1000);
      container.setVisible(false);
      this.mapThumbContainer = container;
      this.positionThumbnail(this.scale.width);
    }

    return this.mapThumbContainer;
  }

  private ensureCompletionOverlay(): Phaser.GameObjects.Graphics {
    if (!this.mapThumbOverlay) {
      const container = this.ensureThumbnailContainer();
      this.mapThumbOverlay = this.add.graphics({ x: 0, y: 0 });
      this.mapThumbOverlay.setVisible(false);
      container.add(this.mapThumbOverlay);
    }
    return this.mapThumbOverlay;
  }

  private positionThumbnail(width: number) {
    if (!this.mapThumbContainer) {
      return;
    }

    const margin = 24;
    this.mapThumbContainer.setPosition(width - 160 - margin, margin);
  }

  private destroyThumbnail() {
    this.mapThumbImage?.destroy();
    this.mapThumbOverlay?.destroy();
    this.mapThumbContainer?.destroy();
    this.mapThumbImage = undefined;
    this.mapThumbOverlay = undefined;
    this.mapThumbContainer = undefined;
    this.currentMapId = undefined;
    this.pendingMapId = undefined;
  }

  private findAnchorByLocation(location: string | undefined): Anchor | undefined {
    if (!location) {
      return undefined;
    }

    return this.anchors.find((anchor) => anchor.地點 === location);
  }

  private isAnchorResolved(anchor: Anchor): boolean {
    const spiritId = anchor.服務靈;
    const resolvedList = this.world?.data?.已安息靈 ?? [];
    return resolvedList.includes(spiritId);
  }

  private getTextureKey(id: string) {
    return `map:${id}`;
  }

  private loadTexture(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = this.load;
      const cleanup = () => {
        loader.off(Phaser.Loader.Events.COMPLETE, onComplete);
        loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      };
      const onComplete = () => {
        cleanup();
        resolve();
      };
      const onError = (file: Phaser.Loader.File) => {
        if (file.key !== key) {
          return;
        }
        cleanup();
        reject(new Error(`Map texture failed to load: ${url}`));
      };

      loader.once(Phaser.Loader.Events.COMPLETE, onComplete);
      loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      loader.image(key, url);
      loader.start();
    });
  }
}
