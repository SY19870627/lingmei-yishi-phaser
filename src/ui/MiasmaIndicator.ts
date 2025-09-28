import Phaser from 'phaser';
import type { Miasma } from '@core/Types';

export interface MiasmaIndicatorConfig {
  width?: number;
  height?: number;
  label?: string;
  backgroundColor?: number;
  backgroundAlpha?: number;
  fogTint?: number;
  textColor?: string;
  valueFontSize?: string;
}

type MiasmaSetting = {
  alpha: number;
  offset: number;
  duration: number;
};

const SETTINGS: Record<Miasma, MiasmaSetting> = {
  清: { alpha: 0.28, offset: 8, duration: 5200 },
  濁: { alpha: 0.46, offset: 14, duration: 3800 },
  沸: { alpha: 0.68, offset: 22, duration: 2600 }
};

export default class MiasmaIndicator {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;

  private readonly background: Phaser.GameObjects.Rectangle;

  private readonly fog: Phaser.GameObjects.Image;

  private readonly valueText: Phaser.GameObjects.Text;

  private readonly labelText: Phaser.GameObjects.Text;

  private current: Miasma = '清';

  private motionTween?: Phaser.Tweens.Tween;

  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: MiasmaIndicatorConfig = {}) {
    this.scene = scene;
    const width = config.width ?? 200;
    const height = config.height ?? 120;
    const label = config.label ?? '煞氣';
    const backgroundColor = config.backgroundColor ?? 0x000000;
    const backgroundAlpha = config.backgroundAlpha ?? 0.45;
    const textColor = config.textColor ?? '#fff';
    const valueFontSize = config.valueFontSize ?? '28px';

    this.container = scene.add.container(x, y);
    this.container.setSize(width, height);

    this.background = scene.add.rectangle(0, 0, width, height, backgroundColor, backgroundAlpha).setOrigin(0.5);

    this.labelText = scene.add
      .text(0, -height / 2 + 12, label, {
        fontSize: '18px',
        color: textColor
      })
      .setOrigin(0.5, 0);

    MiasmaIndicator.ensureTexture(scene);
    this.fog = scene.add
      .image(0, 8, MiasmaIndicator.TEXTURE_KEY)
      .setDisplaySize(width - 24, height - 48)
      .setAlpha(0)
      .setTint(config.fogTint ?? 0xc7d5ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setOrigin(0.5);

    this.valueText = scene.add
      .text(0, height / 2 - 48, '', {
        fontSize: valueFontSize,
        color: textColor
      })
      .setOrigin(0.5, 0);

    this.container.add([this.background, this.fog, this.labelText, this.valueText]);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  setMiasma(level: Miasma) {
    if (this.current === level && this.motionTween) {
      return;
    }
    this.current = level;
    const setting = SETTINGS[level];
    this.valueText.setText(level);
    this.fog.setAlpha(setting.alpha);
    this.applyMotion(setting);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.motionTween?.stop();
    this.motionTween?.remove();
    this.motionTween = undefined;
    this.container.destroy(true);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  private applyMotion(setting: MiasmaSetting) {
    this.motionTween?.stop();
    this.motionTween?.remove();
    const offset = setting.offset;
    const duration = setting.duration;
    this.fog.setPosition(0, 8);
    this.motionTween = this.scene.tweens.add({
      targets: this.fog,
      x: { from: -offset, to: offset },
      y: { from: 8 + offset * 0.3, to: 8 - offset * 0.3 },
      duration,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  private static ensureTexture(scene: Phaser.Scene) {
    if (scene.textures.exists(MiasmaIndicator.TEXTURE_KEY)) {
      return;
    }
    const size = 256;
    const graphics = scene.add.graphics({ x: 0, y: 0 });
    graphics.setVisible(false);
    const baseAlpha = 0.12;
    graphics.fillStyle(0xffffff, baseAlpha);
    graphics.fillRect(0, 0, size, size);
    graphics.fillStyle(0xffffff, baseAlpha * 1.8);
    graphics.fillCircle(size * 0.3, size * 0.3, size * 0.28);
    graphics.fillCircle(size * 0.7, size * 0.35, size * 0.26);
    graphics.fillCircle(size * 0.52, size * 0.68, size * 0.24);
    graphics.generateTexture(MiasmaIndicator.TEXTURE_KEY, size, size);
    graphics.destroy();
  }

  private static readonly TEXTURE_KEY = 'ui-miasma-fog';
}
