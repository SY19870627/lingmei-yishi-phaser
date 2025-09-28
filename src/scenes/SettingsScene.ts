import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import { GameSettings, MIN_TEXT_SPEED, MAX_TEXT_SPEED } from '@core/Settings';
import type { WorldState } from '@core/WorldState';

export default class SettingsScene extends ModuleScene<void, void> {
  private settings?: GameSettings;
  private world?: WorldState;
  private draggingHandle = false;
  private sliderTrack?: Phaser.GameObjects.Rectangle;
  private sliderHandle?: Phaser.GameObjects.Arc;
  private speedLabel?: Phaser.GameObjects.Text;
  private dragHandler?: (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number) => void;
  private dragEndHandler?: (pointer: Phaser.Input.Pointer) => void;
  private textSpeedListener?: (value: number) => void;
  private softLanguageListener?: (value: boolean) => void;
  private offlineListener?: (value: boolean) => void;

  constructor() {
    super('SettingsScene');
  }

  create() {
    this.settings = this.registry.get('settings') as GameSettings | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;

    if (!this.settings) {
      this.done(undefined as void);
      return;
    }

    const { width, height } = this.scale;

    this.add.text(width / 2, 64, '設定', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    this.add
      .text(width / 2, 110, '調整遊戲體驗偏好。', {
        fontSize: '18px',
        color: '#ccc'
      })
      .setOrigin(0.5);

    this.buildTextSpeedSlider(width / 2, 200);
    this.buildSoftLanguageToggle(width / 2, 320);
    this.buildOfflineToggle(width / 2, 380);

    const closeButton = this.add
      .text(width / 2, height - 80, '返回', { fontSize: '24px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    closeButton.on('pointerup', () => {
      this.done(undefined as void);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  private buildTextSpeedSlider(centerX: number, y: number) {
    if (!this.settings) {
      return;
    }

    this.add.text(centerX - 220, y - 70, '文字速度', { fontSize: '22px', color: '#fff' }).setOrigin(0, 0.5);

    const trackWidth = 360;
    const trackHeight = 4;
    const trackX = centerX - trackWidth / 2;

    this.sliderTrack = this.add
      .rectangle(trackX, y, trackWidth, trackHeight, 0xffffff, 0.3)
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });

    this.sliderHandle = this.add
      .arc(0, y, 12, 0, 360, false, 0xffffff, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.input.setDraggable(this.sliderHandle);

    const speed = this.settings.getTextSpeed();

    this.speedLabel = this.add.text(centerX + trackWidth / 2 + 16, y, '', {
      fontSize: '18px',
      color: '#fff'
    });
    this.speedLabel.setOrigin(0, 0.5);

    const applyPosition = (posX: number, persist = true) => {
      if (!this.settings) {
        return;
      }
      const ratio = Phaser.Math.Clamp((posX - trackX) / trackWidth, 0, 1);
      const speedValue = Math.round(MIN_TEXT_SPEED + (MAX_TEXT_SPEED - MIN_TEXT_SPEED) * ratio);
      this.settings.setTextSpeed(speedValue, persist);
    };

    const updateHandle = (value: number) => {
      if (!this.sliderHandle) {
        return;
      }
      const ratio = (value - MIN_TEXT_SPEED) / (MAX_TEXT_SPEED - MIN_TEXT_SPEED);
      const clamped = Phaser.Math.Clamp(ratio, 0, 1);
      const posX = trackX + clamped * trackWidth;
      this.sliderHandle.setPosition(posX, y);
      this.updateSpeedLabel(value);
    };

    updateHandle(speed);

    this.sliderTrack.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const posX = Phaser.Math.Clamp(pointer.x, trackX, trackX + trackWidth);
      this.sliderHandle?.setPosition(posX, y);
      this.updateSpeedLabel(this.positionToSpeed(posX, trackX, trackWidth));
      applyPosition(posX);
    });

    if (this.sliderHandle) {
      this.sliderHandle.on('pointerdown', () => {
        this.draggingHandle = true;
      });
      this.sliderHandle.on('pointerup', () => {
        if (this.draggingHandle) {
          applyPosition(this.sliderHandle?.x ?? trackX);
        }
        this.draggingHandle = false;
      });
      this.sliderHandle.on('pointerout', () => {
        this.draggingHandle = false;
      });
    }

    this.dragHandler = (_pointer, gameObject, dragX) => {
      if (!this.sliderHandle || gameObject !== this.sliderHandle) {
        return;
      }
      const clamped = Phaser.Math.Clamp(dragX, trackX, trackX + trackWidth);
      this.sliderHandle.setPosition(clamped, y);
      this.updateSpeedLabel(this.positionToSpeed(clamped, trackX, trackWidth));
      applyPosition(clamped, false);
    };

    this.dragEndHandler = (pointer) => {
      if (!this.sliderHandle || !this.draggingHandle) {
        return;
      }
      const clamped = Phaser.Math.Clamp(pointer.x, trackX, trackX + trackWidth);
      this.sliderHandle.setPosition(clamped, y);
      applyPosition(clamped);
      this.draggingHandle = false;
    };

    this.input.on('drag', this.dragHandler);
    this.input.on('dragend', this.dragEndHandler);

    this.textSpeedListener = (value: number) => {
      updateHandle(value);
    };
    this.settings.on('change:textSpeed', this.textSpeedListener);
  }

  private positionToSpeed(posX: number, trackX: number, trackWidth: number): number {
    const ratio = Phaser.Math.Clamp((posX - trackX) / trackWidth, 0, 1);
    return Math.round(MIN_TEXT_SPEED + (MAX_TEXT_SPEED - MIN_TEXT_SPEED) * ratio);
  }

  private updateSpeedLabel(speed: number) {
    if (!this.speedLabel) {
      return;
    }
    const charsPerSecond = 1000 / Math.max(speed, 1);
    this.speedLabel.setText(`每字 ${speed} ms（約 ${charsPerSecond.toFixed(1)} 字/秒）`);
  }

  private buildSoftLanguageToggle(centerX: number, y: number) {
    if (!this.settings) {
      return;
    }

    const label = this.add
      .text(centerX, y, '', { fontSize: '22px', color: '#fff' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const updateText = () => {
      const state = this.settings?.isSoftLanguageEnabled() ? '開' : '關';
      label.setText(`柔化模式：${state}`);
    };

    this.softLanguageListener = () => {
      updateText();
    };
    this.settings.on('change:softenLanguage', this.softLanguageListener);

    label.on('pointerup', () => {
      if (!this.settings) {
        return;
      }
      const next = !this.settings.isSoftLanguageEnabled();
      this.settings.setSoftLanguage(next);
      updateText();
    });

    updateText();
  }

  private buildOfflineToggle(centerX: number, y: number) {
    if (!this.settings) {
      return;
    }

    const label = this.add
      .text(centerX, y, '', { fontSize: '22px', color: '#fff' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const updateText = () => {
      const state = this.settings?.isOfflineMode() ? '開' : '關';
      label.setText(`離線模式：${state}`);
    };

    this.offlineListener = () => {
      updateText();
    };
    this.settings.on('change:offlineMode', this.offlineListener);

    label.on('pointerup', () => {
      if (!this.settings) {
        return;
      }
      const next = !this.settings.isOfflineMode();
      this.settings.setOfflineMode(next);
      if (this.world) {
        this.world.setFlag('offline', next);
      }
      updateText();
    });

    updateText();
  }

  private cleanup() {
    if (this.sliderTrack) {
      this.sliderTrack.removeAllListeners();
    }

    if (this.sliderHandle) {
      this.sliderHandle.removeAllListeners();
    }

    if (this.dragHandler) {
      this.input.off('drag', this.dragHandler);
    }

    if (this.dragEndHandler) {
      this.input.off('dragend', this.dragEndHandler);
    }

    if (this.settings && this.textSpeedListener) {
      this.settings.off('change:textSpeed', this.textSpeedListener);
    }

    if (this.settings && this.softLanguageListener) {
      this.settings.off('change:softenLanguage', this.softLanguageListener);
    }

    if (this.settings && this.offlineListener) {
      this.settings.off('change:offlineMode', this.offlineListener);
    }
  }
}
