import Phaser from 'phaser';

export interface OptionCarouselItem<T = unknown> {
  id?: string;
  label: string;
  data?: T;
}

export interface OptionCarouselConfig {
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
  visibleCount?: number;
  fontSize?: string;
  textColor?: string;
  highlightColor?: string;
  backgroundColor?: number;
  backgroundAlpha?: number;
  messageFontSize?: string;
}

type Mode = 'options' | 'message';

type CardView = {
  index: number;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export default class OptionCarousel<T = unknown> extends Phaser.Events.EventEmitter {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;

  private readonly config: Required<OptionCarouselConfig>;

  private readonly cardsContainer: Phaser.GameObjects.Container;

  private readonly messageText: Phaser.GameObjects.Text;

  private readonly leftButton: Phaser.GameObjects.Text;

  private readonly rightButton: Phaser.GameObjects.Text;

  private items: OptionCarouselItem<T>[] = [];

  private cardViews: CardView[] = [];

  private selectedIndex = -1;

  private viewStart = 0;

  private mode: Mode = 'message';

  private destroyed = false;

  private readonly highlightColorNumber: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: OptionCarouselConfig = {}) {
    super();
    this.scene = scene;
    this.config = {
      cardWidth: config.cardWidth ?? 200,
      cardHeight: config.cardHeight ?? 240,
      gap: config.gap ?? 36,
      visibleCount: config.visibleCount ?? 3,
      fontSize: config.fontSize ?? '22px',
      textColor: config.textColor ?? '#dcd1bd',
      highlightColor: config.highlightColor ?? '#fff1c2',
      backgroundColor: config.backgroundColor ?? 0x000000,
      backgroundAlpha: config.backgroundAlpha ?? 0.45,
      messageFontSize: config.messageFontSize ?? '20px'
    };

    this.highlightColorNumber = Phaser.Display.Color.ValueToColor(this.config.highlightColor).color;

    this.container = scene.add.container(x, y);

    const backdropWidth =
      this.config.visibleCount * this.config.cardWidth + (this.config.visibleCount - 1) * this.config.gap + 48;
    const backdropHeight = this.config.cardHeight + 48;
    const backdrop = scene.add
      .rectangle(0, 0, backdropWidth, backdropHeight, this.config.backgroundColor, this.config.backgroundAlpha)
      .setOrigin(0.5);

    this.cardsContainer = scene.add.container(0, 0);

    this.messageText = scene.add
      .text(0, 0, '', {
        fontSize: this.config.messageFontSize,
        color: this.config.textColor,
        wordWrap: { width: backdropWidth - 80 },
        align: 'center'
      })
      .setOrigin(0.5);

    this.leftButton = scene.add
      .text(-backdropWidth / 2 + 12, 0, '◀', {
        fontSize: '32px',
        color: this.config.textColor
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });

    this.rightButton = scene.add
      .text(backdropWidth / 2 - 12, 0, '▶', {
        fontSize: '32px',
        color: this.config.textColor
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });

    this.leftButton.on('pointerup', () => {
      this.shiftView(-1);
    });
    this.rightButton.on('pointerup', () => {
      this.shiftView(1);
    });

    this.container.add([backdrop, this.cardsContainer, this.messageText, this.leftButton, this.rightButton]);

    scene.input.keyboard?.on('keydown-LEFT', this.handleCursorLeft, this);
    scene.input.keyboard?.on('keydown-RIGHT', this.handleCursorRight, this);
    scene.input.keyboard?.on('keydown-UP', this.handleCursorLeft, this);
    scene.input.keyboard?.on('keydown-DOWN', this.handleCursorRight, this);
    scene.input.keyboard?.on('keydown-ENTER', this.handleConfirmKey, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);

    this.setMessage(['暫無可用選項']);
  }

  setOptions(items: OptionCarouselItem<T>[]) {
    this.mode = 'options';
    this.items = items.slice();
    this.viewStart = 0;
    this.selectedIndex = this.items.length ? Math.max(Math.min(this.selectedIndex, this.items.length - 1), 0) : -1;
    if (this.items.length && this.selectedIndex < 0) {
      this.selectedIndex = 0;
    }
    this.refreshView();
  }

  setMessage(message: string | string[]) {
    const lines = Array.isArray(message) ? message : [message];
    this.mode = 'message';
    this.items = [];
    this.selectedIndex = -1;
    this.viewStart = 0;
    this.clearCards();
    this.cardsContainer.setVisible(false);
    this.leftButton.setVisible(false);
    this.rightButton.setVisible(false);
    this.messageText.setVisible(true);
    this.messageText.setText(lines.join('\n'));
  }

  moveSelection(delta: number) {
    if (this.mode !== 'options' || !this.items.length) {
      return;
    }
    const total = this.items.length;
    const current = this.selectedIndex < 0 ? 0 : this.selectedIndex;
    const next = (current + delta + total) % total;
    this.setSelectedIndex(next, true);
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
    this.scene.input.keyboard?.off('keydown-LEFT', this.handleCursorLeft, this);
    this.scene.input.keyboard?.off('keydown-RIGHT', this.handleCursorRight, this);
    this.scene.input.keyboard?.off('keydown-UP', this.handleCursorLeft, this);
    this.scene.input.keyboard?.off('keydown-DOWN', this.handleCursorRight, this);
    this.scene.input.keyboard?.off('keydown-ENTER', this.handleConfirmKey, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.clearCards();
    this.container.destroy(true);
    this.removeAllListeners();
  }

  private refreshView() {
    this.clearCards();
    if (!this.items.length) {
      this.cardsContainer.setVisible(false);
      this.leftButton.setVisible(false);
      this.rightButton.setVisible(false);
      this.messageText.setVisible(true);
      this.messageText.setText('');
      return;
    }

    this.mode = 'options';
    this.cardsContainer.setVisible(true);
    this.messageText.setVisible(false);

    const end = Math.min(this.viewStart + this.config.visibleCount, this.items.length);
    const visible = this.items.slice(this.viewStart, end);
    const span = this.config.cardWidth + this.config.gap;
    const offsetBase = (visible.length - 1) * span * 0.5;

    visible.forEach((item, localIndex) => {
      const globalIndex = this.viewStart + localIndex;
      const x = localIndex * span - offsetBase;
      const card = this.createCard(item, globalIndex);
      card.container.setPosition(x, 0);
      this.cardsContainer.add(card.container);
      this.cardViews.push(card);
    });

    this.updateSelectionVisuals();
    this.updateNavButtons();
  }

  private shiftView(delta: number) {
    if (this.mode !== 'options' || !this.items.length) {
      return;
    }
    const maxStart = Math.max(0, this.items.length - this.config.visibleCount);
    const nextStart = Phaser.Math.Clamp(this.viewStart + delta, 0, maxStart);
    if (nextStart === this.viewStart) {
      return;
    }
    this.viewStart = nextStart;
    if (this.selectedIndex < this.viewStart) {
      this.selectedIndex = this.viewStart;
    } else if (this.selectedIndex >= this.viewStart + this.config.visibleCount) {
      this.selectedIndex = this.viewStart + this.config.visibleCount - 1;
    }
    this.refreshView();
  }

  private setSelectedIndex(index: number, ensureVisible: boolean) {
    if (this.mode !== 'options') {
      this.selectedIndex = -1;
      this.updateSelectionVisuals();
      return;
    }
    if (index < 0 || index >= this.items.length) {
      return;
    }
    this.selectedIndex = index;
    if (ensureVisible) {
      if (this.selectedIndex < this.viewStart) {
        this.viewStart = this.selectedIndex;
        this.refreshView();
        return;
      }
      if (this.selectedIndex >= this.viewStart + this.config.visibleCount) {
        this.viewStart = this.selectedIndex - this.config.visibleCount + 1;
        this.refreshView();
        return;
      }
    }
    this.updateSelectionVisuals();
  }

  private updateSelectionVisuals() {
    this.cardViews.forEach((view) => {
      const selected = view.index === this.selectedIndex;
      view.border.setVisible(selected);
      view.label.setColor(selected ? this.config.highlightColor : this.config.textColor);
      view.container.setScale(selected ? 1.04 : 1);
      view.background.setFillStyle(this.config.backgroundColor, selected ? this.config.backgroundAlpha + 0.1 : this.config.backgroundAlpha);
    });
  }

  private updateNavButtons() {
    const hasOverflow = this.items.length > this.config.visibleCount;
    this.leftButton.setVisible(hasOverflow && this.viewStart > 0);
    this.rightButton.setVisible(hasOverflow && this.viewStart + this.config.visibleCount < this.items.length);
  }

  private createCard(item: OptionCarouselItem<T>, index: number): CardView {
    const container = this.scene.add.container(0, 0);
    container.setSize(this.config.cardWidth, this.config.cardHeight);

    const background = this.scene.add
      .rectangle(0, 0, this.config.cardWidth, this.config.cardHeight, this.config.backgroundColor, this.config.backgroundAlpha)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x7d7560, 0.8);

    const border = this.scene.add
      .rectangle(0, 0, this.config.cardWidth + 12, this.config.cardHeight + 12)
      .setOrigin(0.5)
      .setStrokeStyle(3, this.highlightColorNumber, 1)
      .setVisible(false);

    const label = this.scene.add
      .text(0, 0, item.label, {
        fontSize: this.config.fontSize,
        color: this.config.textColor,
        wordWrap: { width: this.config.cardWidth - 40 },
        align: 'center'
      })
      .setOrigin(0.5);

    container.add([background, border, label]);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => {
      this.setSelectedIndex(index, true);
    });
    container.on('pointerout', () => {
      this.updateSelectionVisuals();
    });
    container.on('pointerup', () => {
      this.setSelectedIndex(index, true);
      this.confirmSelection();
    });

    return { index, container, background, border, label };
  }

  private clearCards() {
    this.cardViews.forEach((view) => {
      view.container.removeAllListeners();
      view.container.destroy(true);
    });
    this.cardViews = [];
  }

  private handleCursorLeft() {
    this.moveSelection(-1);
  }

  private handleCursorRight() {
    this.moveSelection(1);
  }

  private handleConfirmKey() {
    if (!this.scene.input.enabled) {
      return;
    }
    this.confirmSelection();
  }
}
