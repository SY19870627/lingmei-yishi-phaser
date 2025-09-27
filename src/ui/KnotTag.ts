import Phaser from 'phaser';

export type KnotState = '未解' | '鬆動' | '已解';

export interface KnotTagConfig {
  text: string;
  state?: KnotState;
  width?: number;
  height?: number;
}

export default class KnotTag {
  readonly container: Phaser.GameObjects.Container;

  private readonly bg: Phaser.GameObjects.Rectangle;

  private readonly label: Phaser.GameObjects.Text;

  private currentState: KnotState;

  private burned = false;

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, config: KnotTagConfig) {
    this.scene = scene;
    const width = config.width ?? 180;
    const height = config.height ?? 40;
    this.currentState = config.state ?? '未解';

    this.container = scene.add.container(x, y);
    this.container.setSize(width, height);

    this.bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0, 0.5);
    this.label = scene.add
      .text(width / 2, 0, config.text, {
        fontSize: '18px',
        color: '#fff',
        align: 'center',
        wordWrap: { width: width - 24 }
      })
      .setOrigin(0.5, 0.5);

    this.container.add([this.bg, this.label]);

    this.updateVisuals();
  }

  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
  }

  getState() {
    return this.currentState;
  }

  setState(state: KnotState) {
    if (this.currentState === state) {
      return;
    }
    this.currentState = state;
    this.updateVisuals();
    if (state === '已解') {
      this.playBurnAnimation();
    }
  }

  private updateVisuals() {
    switch (this.currentState) {
      case '未解':
        this.bg.setFillStyle(0x362a2a, 0.8);
        this.label.setColor('#f6e6c8');
        this.container.setAlpha(1);
        this.container.setScale(1);
        break;
      case '鬆動':
        this.bg.setFillStyle(0x4d3b1f, 0.85);
        this.label.setColor('#ffe8a6');
        this.container.setAlpha(1);
        this.container.setScale(1);
        break;
      case '已解':
        this.bg.setFillStyle(0x1f3329, 0.9);
        this.label.setColor('#c5f4d5');
        break;
      default:
        break;
    }
  }

  private playBurnAnimation() {
    if (this.burned) {
      return;
    }
    this.burned = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.7,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
      }
    });
  }
}
