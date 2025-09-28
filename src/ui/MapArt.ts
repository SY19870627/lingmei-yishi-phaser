import Phaser from 'phaser';
import type { MapDef } from '@core/Types';

export default class MapArt {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly maps = new Map<string, MapDef>();
  private currentImage?: Phaser.GameObjects.Image;
  private currentMapId?: string;
  private pendingMapId?: string;

  private readonly handleResize = (gameSize: Phaser.Structs.Size) => {
    this.fitImage(gameSize.width, gameSize.height);
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(-1000);

    scene.scale.on('resize', this.handleResize);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off('resize', this.handleResize);
      this.clear();
      this.container.destroy();
    });
  }

  setMaps(maps: MapDef[]) {
    this.maps.clear();
    maps.forEach((map) => this.maps.set(map.id, map));

    if (this.currentMapId && !this.maps.has(this.currentMapId)) {
      this.clear();
      return;
    }

    if (this.currentMapId) {
      void this.show(this.currentMapId);
    }
  }

  async show(mapId?: string): Promise<void> {
    if (!mapId) {
      this.clear();
      return;
    }

    const map = this.maps.get(mapId);
    if (!map) {
      this.clear();
      return;
    }

    if (this.currentMapId === mapId && this.currentImage) {
      this.currentImage.setVisible(true);
      this.fitImage();
      return;
    }

    const textureKey = this.getTextureKey(map.id);
    this.pendingMapId = mapId;

    if (!this.scene.textures.exists(textureKey)) {
      try {
        await this.loadTexture(textureKey, map.image);
      } catch (error) {
        if (this.pendingMapId === mapId) {
          this.pendingMapId = undefined;
        }
        console.warn(error);
        return;
      }
    }

    if (this.pendingMapId !== mapId) {
      return;
    }

    this.pendingMapId = undefined;
    this.displayTexture(textureKey);
    this.currentMapId = mapId;
  }

  private loadTexture(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = this.scene.load;
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

  private displayTexture(textureKey: string) {
    this.container.removeAll(true);
    const image = this.scene.make.image({ key: textureKey, add: false });
    image.setOrigin(0.5);
    this.container.add(image);
    this.currentImage = image;
    this.fitImage();
  }

  private fitImage(width = this.scene.scale.width, height = this.scene.scale.height) {
    if (!this.currentImage) {
      return;
    }

    const source = this.currentImage.texture.getSourceImage() as HTMLImageElement;
    if (!source) {
      return;
    }

    const scale = Math.max(width / source.width, height / source.height);
    this.currentImage.setScale(scale);
    this.currentImage.setPosition(width / 2, height / 2);
  }

  private clear() {
    this.currentMapId = undefined;
    this.pendingMapId = undefined;
    this.container.removeAll(true);
    this.currentImage = undefined;
  }

  private getTextureKey(id: string) {
    return `map:${id}`;
  }
}
