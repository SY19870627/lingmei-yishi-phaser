import Phaser from 'phaser';
import { MIN_TEXT_SPEED, type GameSettings } from '@core/Settings';

export interface DialogueBoxConfig {
  width?: number;
  height?: number;
  padding?: number;
  backgroundColor?: number;
  backgroundAlpha?: number;
  fontSize?: string;
  textColor?: string;
  typeSpeed?: number;
}

export default class DialogueBox extends Phaser.Events.EventEmitter {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;

  private readonly background: Phaser.GameObjects.Rectangle;

  private readonly textObject: Phaser.GameObjects.Text;

  private readonly padding: number;

  private typeSpeed: number;

  private typingTimer?: Phaser.Time.TimerEvent;

  private fullText = '';

  private visibleText = '';

  private charIndex = 0;

  private completed = true;

  private destroyed = false;

  private settings?: GameSettings;
  private handleSettingsSpeedChange?: (value: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, config: DialogueBoxConfig = {}) {
    super();
    this.scene = scene;
    const width = config.width ?? 520;
    const height = config.height ?? 160;
    this.padding = config.padding ?? 16;
    this.settings = scene.registry.get('settings') as GameSettings | undefined;
    this.typeSpeed = config.typeSpeed ?? this.settings?.getTextSpeed() ?? 18;

    this.container = scene.add.container(x, y);
    this.container.setSize(width, height);

    this.background = scene.add
      .rectangle(0, 0, width, height, config.backgroundColor ?? 0x000000, config.backgroundAlpha ?? 0.6)
      .setOrigin(0, 0);

    this.textObject = scene.add
      .text(this.padding, this.padding, '', {
        fontSize: config.fontSize ?? '20px',
        color: config.textColor ?? '#fff',
        wordWrap: { width: width - this.padding * 2 }
      })
      .setOrigin(0, 0);

    this.container.add([this.background, this.textObject]);

    scene.input.keyboard?.on('keydown-SPACE', this.handleSkipKey, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);

    if (this.settings) {
      this.handleSettingsSpeedChange = (value: number) => {
        this.setTypeSpeed(value);
      };
      this.settings.on('change:textSpeed', this.handleSettingsSpeedChange);
    }
  }

  setText(text: string) {
    this.fullText = text ?? '';
    this.visibleText = '';
    this.charIndex = 0;
    this.completed = !this.fullText.length;
    this.textObject.setText('');
    this.restartTyping();
    if (this.completed) {
      this.emit('complete', this.fullText);
    } else {
      this.emit('start', this.fullText);
    }
  }

  skip() {
    if (this.completed) {
      return;
    }
    this.visibleText = this.fullText;
    this.charIndex = this.fullText.length;
    this.textObject.setText(this.visibleText);
    this.finishTyping();
  }

  isComplete() {
    return this.completed;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.stopTyping();
    if (this.settings && this.handleSettingsSpeedChange) {
      this.settings.off('change:textSpeed', this.handleSettingsSpeedChange);
      this.handleSettingsSpeedChange = undefined;
    }
    this.scene.input.keyboard?.off('keydown-SPACE', this.handleSkipKey, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.container.destroy(true);
    this.removeAllListeners();
  }

  setTypeSpeed(speed: number, restart = true) {
    const clamped = Math.max(MIN_TEXT_SPEED, Math.round(speed));
    if (clamped === this.typeSpeed) {
      return;
    }
    this.typeSpeed = clamped;
    if (!this.completed && restart) {
      this.restartTyping();
    }
  }

  private restartTyping() {
    this.stopTyping();
    if (!this.fullText.length) {
      this.completed = true;
      return;
    }
    this.completed = false;
    this.typingTimer = this.scene.time.addEvent({
      delay: this.typeSpeed,
      loop: true,
      callback: this.handleTypingStep,
      callbackScope: this
    });
  }

  private stopTyping() {
    if (this.typingTimer) {
      this.typingTimer.remove(false);
      this.typingTimer.destroy();
      this.typingTimer = undefined;
    }
  }

  private handleTypingStep() {
    if (this.charIndex >= this.fullText.length) {
      this.finishTyping();
      return;
    }
    this.visibleText += this.fullText.charAt(this.charIndex);
    this.charIndex += 1;
    this.textObject.setText(this.visibleText);
    if (this.charIndex >= this.fullText.length) {
      this.finishTyping();
    }
  }

  private finishTyping() {
    this.stopTyping();
    if (this.completed) {
      return;
    }
    this.completed = true;
    this.emit('complete', this.fullText);
  }

  private handleSkipKey() {
    if (!this.scene.input.enabled) {
      return;
    }
    this.skip();
  }
}
