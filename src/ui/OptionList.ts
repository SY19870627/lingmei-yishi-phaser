import Phaser from 'phaser';

export interface OptionListItem<T = unknown> {
  id?: string;
  label: string;
  data?: T;
}

export interface OptionListConfig {
  width?: number;
  spacing?: number;
  fontSize?: string;
  align?: 'left' | 'center' | 'right';
  wrapWidth?: number;
  textColor?: string;
  highlightColor?: string;
  disabledColor?: string;
  messageColor?: string;
}

type Mode = 'options' | 'message';

export default class OptionList<T = unknown> extends Phaser.Events.EventEmitter {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;

  private readonly config: Required<OptionListConfig> & { spacing: number; wrapWidth: number };

  private items: OptionListItem<T>[] = [];

  private textObjects: Phaser.GameObjects.Text[] = [];

  private selectedIndex = -1;

  private mode: Mode = 'message';

  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: OptionListConfig = {}) {
    super();
    this.scene = scene;
    this.config = {
      width: config.width ?? 260,
      spacing: config.spacing ?? 42,
      fontSize: config.fontSize ?? '18px',
      align: config.align ?? 'center',
      wrapWidth: config.wrapWidth ?? config.width ?? 260,
      textColor: config.textColor ?? '#aaf',
      highlightColor: config.highlightColor ?? '#fff',
      disabledColor: config.disabledColor ?? '#888',
      messageColor: config.messageColor ?? '#ccc'
    };
    this.container = scene.add.container(x, y);

    scene.input.keyboard?.on('keydown-UP', this.handleCursorUp, this);
    scene.input.keyboard?.on('keydown-DOWN', this.handleCursorDown, this);
    scene.input.keyboard?.on('keydown-ENTER', this.handleConfirmKey, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  setOptions(items: OptionListItem<T>[]) {
    this.mode = 'options';
    this.items = items.slice();
    this.selectedIndex = this.items.length ? Math.min(Math.max(this.selectedIndex, 0), this.items.length - 1) : -1;
    if (this.items.length === 0) {
      this.selectedIndex = -1;
    }
    this.rebuildTexts(this.items.map((item) => ({ content: item.label, interactive: true })), false);
    if (this.items.length) {
      this.setSelectedIndex(this.selectedIndex === -1 ? 0 : this.selectedIndex);
    } else {
      this.updateSelection();
    }
  }

  setMessage(message: string | string[]) {
    const lines = Array.isArray(message) ? message : [message];
    this.mode = 'message';
    this.items = [];
    this.selectedIndex = -1;
    this.rebuildTexts(lines.map((line) => ({ content: line, interactive: false })), true);
  }

  moveSelection(delta: number) {
    if (this.mode !== 'options' || !this.items.length) {
      return;
    }
    const total = this.items.length;
    const current = this.selectedIndex < 0 ? (delta > 0 ? 0 : total - 1) : this.selectedIndex;
    const next = (current + delta + total) % total;
    this.setSelectedIndex(next);
  }

  confirmSelection() {
    if (this.mode !== 'options' || this.selectedIndex < 0) {
      return;
    }
    const item = this.items[this.selectedIndex];
    if (!item) {
      return;
    }
    this.emit('confirm', item, this.selectedIndex);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scene.input.keyboard?.off('keydown-UP', this.handleCursorUp, this);
    this.scene.input.keyboard?.off('keydown-DOWN', this.handleCursorDown, this);
    this.scene.input.keyboard?.off('keydown-ENTER', this.handleConfirmKey, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.clearTexts();
    this.container.destroy(true);
    this.removeAllListeners();
  }

  private rebuildTexts(entries: { content: string; interactive: boolean }[], isMessage: boolean) {
    this.clearTexts();
    const spacing = isMessage ? Math.max(this.config.spacing * 0.7, 26) : this.config.spacing;
    entries.forEach((entry, index) => {
      const text = this.createText(entry.content, index * spacing, isMessage);
      if (entry.interactive) {
        text.setInteractive({ useHandCursor: true });
        text.on('pointerover', () => {
          this.setSelectedIndex(index);
        });
        text.on('pointerup', () => {
          this.setSelectedIndex(index);
          this.confirmSelection();
        });
      }
      this.textObjects.push(text);
    });
    this.updateSelection();
  }

  private createText(content: string, y: number, isMessage: boolean) {
    const originX = this.getOriginX();
    const baseX = this.getBaseX(originX);
    const color = isMessage ? this.config.messageColor : this.config.textColor;
    const text = this.scene.add
      .text(baseX, y, content, {
        fontSize: this.config.fontSize,
        color,
        align: this.config.align,
        wordWrap: { width: this.config.wrapWidth }
      })
      .setOrigin(originX, 0);
    this.container.add(text);
    return text;
  }

  private clearTexts() {
    this.textObjects.forEach((text) => {
      text.removeAllListeners();
      text.destroy();
    });
    this.textObjects = [];
  }

  private getOriginX() {
    switch (this.config.align) {
      case 'left':
        return 0;
      case 'right':
        return 1;
      default:
        return 0.5;
    }
  }

  private getBaseX(originX: number) {
    if (originX === 0.5) {
      return 0;
    }
    if (originX === 1) {
      return this.config.width / 2;
    }
    return -this.config.width / 2;
  }

  private setSelectedIndex(index: number) {
    if (this.mode !== 'options') {
      this.selectedIndex = -1;
      this.updateSelection();
      return;
    }
    if (index < 0 || index >= this.items.length) {
      this.selectedIndex = -1;
      this.updateSelection();
      return;
    }
    if (this.selectedIndex === index) {
      return;
    }
    this.selectedIndex = index;
    this.updateSelection();
    const item = this.items[index];
    if (item) {
      this.emit('change', item, index);
    }
  }

  private updateSelection() {
    if (this.mode !== 'options') {
      this.textObjects.forEach((text) => {
        text.setStyle({ color: this.config.messageColor });
        text.setAlpha(1);
      });
      return;
    }
    this.textObjects.forEach((text, idx) => {
      if (idx === this.selectedIndex) {
        text.setStyle({ color: this.config.highlightColor });
        text.setAlpha(1);
      } else {
        text.setStyle({ color: this.config.textColor });
        text.setAlpha(0.85);
      }
    });
  }

  private handleCursorUp() {
    this.moveSelection(-1);
  }

  private handleCursorDown() {
    this.moveSelection(1);
  }

  private handleConfirmKey() {
    if (!this.scene.input.enabled) {
      return;
    }
    this.confirmSelection();
  }
}
