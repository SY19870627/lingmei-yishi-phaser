import Phaser from 'phaser';

export interface CardCarouselItem<T = unknown> {
  id?: string;
  label: string;
  data?: T;
}

export interface CardCarouselConfig {
  visibleCount?: number;
  spacing?: number;
  cardWidth?: number;
  cardHeight?: number;
  fontSize?: string;
  wrapWidth?: number;
  textColor?: string;
  highlightColor?: string;
  backgroundColor?: number;
  backgroundAlpha?: number;
  messageColor?: string;
  buttonColor?: string;
}

type Mode = 'items' | 'message';

interface CardElements {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export default class CardCarousel<T = unknown> extends Phaser.Events.EventEmitter {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;

  private readonly config: Required<CardCarouselConfig> & {
    visibleCount: number;
    spacing: number;
    cardWidth: number;
    cardHeight: number;
    wrapWidth: number;
    backgroundAlpha: number;
  };

  private readonly highlightColorNumber: number;

  private readonly cards: CardElements[] = [];

  private navPrev?: Phaser.GameObjects.Text;

  private navNext?: Phaser.GameObjects.Text;

  private messageText?: Phaser.GameObjects.Text;

  private mode: Mode = 'message';

  private items: CardCarouselItem<T>[] = [];

  private windowStart = 0;

  private selectedIndex = -1;

  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: CardCarouselConfig = {}) {
    super();
    this.scene = scene;
    const cardWidth = config.cardWidth ?? 220;
    const cardHeight = config.cardHeight ?? 260;
    this.config = {
      visibleCount: Math.max(1, config.visibleCount ?? 3),
      spacing: config.spacing ?? 32,
      cardWidth,
      cardHeight,
      fontSize: config.fontSize ?? '20px',
      wrapWidth: config.wrapWidth ?? cardWidth - 48,
      textColor: config.textColor ?? '#f4e4c4',
      highlightColor: config.highlightColor ?? '#fff',
      backgroundColor: config.backgroundColor ?? 0x201a17,
      backgroundAlpha: config.backgroundAlpha ?? 0.6,
      messageColor: config.messageColor ?? '#ccc',
      buttonColor: config.buttonColor ?? '#aaf'
    };
    this.container = scene.add.container(x, y);
    this.highlightColorNumber = Phaser.Display.Color.HexStringToColor(this.config.highlightColor).color;

    this.createCards();
    this.createNavigation();

    scene.input.keyboard?.on('keydown-LEFT', this.handleLeft, this);
    scene.input.keyboard?.on('keydown-RIGHT', this.handleRight, this);
    scene.input.keyboard?.on('keydown-A', this.handleLeft, this);
    scene.input.keyboard?.on('keydown-D', this.handleRight, this);
    scene.input.keyboard?.on('keydown-ENTER', this.handleConfirm, this);
    scene.input.keyboard?.on('keydown-SPACE', this.handleConfirm, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  setItems(items: CardCarouselItem<T>[]) {
    this.mode = 'items';
    this.items = items.slice();
    if (!this.items.length) {
      this.selectedIndex = -1;
      this.windowStart = 0;
      this.updateCards();
      return;
    }
    if (this.selectedIndex < 0 || this.selectedIndex >= this.items.length) {
      this.selectedIndex = 0;
    }
    this.ensureSelectedVisible();
    this.updateCards();
  }

  setMessage(message: string | string[]) {
    const lines = Array.isArray(message) ? message : [message];
    this.mode = 'message';
    this.items = [];
    this.selectedIndex = -1;
    this.windowStart = 0;
    if (!this.messageText) {
      this.messageText = this.scene.add
        .text(0, 0, '', {
          fontSize: this.config.fontSize,
          color: this.config.messageColor,
          align: 'center',
          wordWrap: { width: this.getTotalWidth() }
        })
        .setOrigin(0.5, 0.5);
      this.container.add(this.messageText);
    }
    this.messageText.setText(lines.join('\n'));
    this.updateCards();
  }

  moveSelection(delta: number) {
    if (this.mode !== 'items' || !this.items.length) {
      return;
    }
    const total = this.items.length;
    this.selectedIndex = ((this.selectedIndex + delta) % total + total) % total;
    this.ensureSelectedVisible();
    this.updateCards();
  }

  confirmSelection() {
    if (this.mode !== 'items' || this.selectedIndex < 0) {
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
    this.scene.input.keyboard?.off('keydown-LEFT', this.handleLeft, this);
    this.scene.input.keyboard?.off('keydown-RIGHT', this.handleRight, this);
    this.scene.input.keyboard?.off('keydown-A', this.handleLeft, this);
    this.scene.input.keyboard?.off('keydown-D', this.handleRight, this);
    this.scene.input.keyboard?.off('keydown-ENTER', this.handleConfirm, this);
    this.scene.input.keyboard?.off('keydown-SPACE', this.handleConfirm, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.cards.forEach((card) => {
      card.container.removeAllListeners();
      card.container.destroy(true);
    });
    this.navPrev?.destroy();
    this.navNext?.destroy();
    this.messageText?.destroy();
    this.container.destroy(true);
    this.removeAllListeners();
  }

  private createCards() {
    const totalWidth = this.getTotalWidth();
    for (let index = 0; index < this.config.visibleCount; index += 1) {
      const slotX = -totalWidth / 2 + (this.config.cardWidth / 2) + index * (this.config.cardWidth + this.config.spacing);
      const cardContainer = this.scene.add.container(slotX, 0);
      cardContainer.setSize(this.config.cardWidth, this.config.cardHeight);
      const background = this.scene.add
        .rectangle(0, 0, this.config.cardWidth, this.config.cardHeight, this.config.backgroundColor, this.config.backgroundAlpha)
        .setOrigin(0.5, 0.5);
      const border = this.scene.add.rectangle(0, 0, this.config.cardWidth, this.config.cardHeight);
      border.setOrigin(0.5, 0.5);
      border.setFillStyle(0, 0);
      border.setStrokeStyle(2, this.highlightColorNumber, 0.45);
      const text = this.scene.add
        .text(0, 0, '', {
          fontSize: this.config.fontSize,
          color: this.config.textColor,
          align: 'center',
          wordWrap: { width: this.config.wrapWidth }
        })
        .setOrigin(0.5, 0.5);
      cardContainer.add([background, border, text]);
      cardContainer.setInteractive({ useHandCursor: true });
      cardContainer.on('pointerover', () => {
        const idx = cardContainer.getData('index');
        if (typeof idx === 'number') {
          this.setSelectedIndex(idx);
        }
      });
      cardContainer.on('pointerup', () => {
        const idx = cardContainer.getData('index');
        if (typeof idx === 'number') {
          this.setSelectedIndex(idx);
          this.confirmSelection();
        }
      });
      cardContainer.on('pointerout', () => {
        this.updateCards();
      });
      this.container.add(cardContainer);
      this.cards.push({ container: cardContainer, background, border, text });
    }
    this.updateCards();
  }

  private createNavigation() {
    const totalWidth = this.getTotalWidth();
    const offset = totalWidth / 2 + 36;
    this.navPrev = this.scene.add
      .text(-offset, 0, '◀', {
        fontSize: '32px',
        color: this.config.buttonColor
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    this.navPrev.on('pointerup', () => {
      this.scrollWindow(-1);
    });
    this.container.add(this.navPrev);

    this.navNext = this.scene.add
      .text(offset, 0, '▶', {
        fontSize: '32px',
        color: this.config.buttonColor
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    this.navNext.on('pointerup', () => {
      this.scrollWindow(1);
    });
    this.container.add(this.navNext);
    this.updateNavigation();
  }

  private handleLeft() {
    if (this.mode !== 'items' || !this.items.length) {
      return;
    }
    if (this.items.length > 1) {
      this.moveSelection(-1);
    }
  }

  private handleRight() {
    if (this.mode !== 'items' || !this.items.length) {
      return;
    }
    if (this.items.length > 1) {
      this.moveSelection(1);
    }
  }

  private handleConfirm() {
    this.confirmSelection();
  }

  private updateCards() {
    if (this.mode !== 'items') {
      this.cards.forEach((card) => {
        card.container.setVisible(false);
        card.container.disableInteractive();
      });
      this.messageText?.setVisible(true);
      this.updateNavigation();
      return;
    }

    this.messageText?.setVisible(false);
    const total = this.items.length;
    const maxStart = Math.max(0, total - this.config.visibleCount);
    this.windowStart = Phaser.Math.Clamp(this.windowStart, 0, maxStart);

    this.cards.forEach((card, slot) => {
      const globalIndex = this.windowStart + slot;
      const item = this.items[globalIndex];
      if (!item) {
        card.container.setVisible(false);
        card.container.disableInteractive();
        return;
      }
      card.container.setVisible(true);
      card.container.setAlpha(globalIndex === this.selectedIndex ? 1 : 0.9);
      card.text.setText(item.label);
      card.border.setStrokeStyle(
        globalIndex === this.selectedIndex ? 3 : 2,
        this.highlightColorNumber,
        globalIndex === this.selectedIndex ? 0.9 : 0.5
      );
      card.container.setData('index', globalIndex);
      card.container.setInteractive({ useHandCursor: true });
    });

    this.updateNavigation();
  }

  private updateNavigation() {
    if (!this.navPrev || !this.navNext) {
      return;
    }
    const showNav = this.mode === 'items' && this.items.length > this.config.visibleCount;
    this.navPrev.setVisible(showNav);
    this.navNext.setVisible(showNav);
    if (!showNav) {
      return;
    }
    const maxStart = Math.max(0, this.items.length - this.config.visibleCount);
    const canScrollLeft = this.windowStart > 0;
    const canScrollRight = this.windowStart < maxStart;
    this.navPrev.setAlpha(canScrollLeft ? 1 : 0.3);
    this.navPrev.disableInteractive();
    if (canScrollLeft) {
      this.navPrev.setInteractive({ useHandCursor: true });
    }
    this.navNext.setAlpha(canScrollRight ? 1 : 0.3);
    this.navNext.disableInteractive();
    if (canScrollRight) {
      this.navNext.setInteractive({ useHandCursor: true });
    }
  }

  private scrollWindow(delta: number) {
    if (this.mode !== 'items' || !this.items.length) {
      return;
    }
    const maxStart = Math.max(0, this.items.length - this.config.visibleCount);
    const nextStart = Phaser.Math.Clamp(this.windowStart + delta, 0, maxStart);
    if (nextStart === this.windowStart) {
      return;
    }
    this.windowStart = nextStart;
    if (this.selectedIndex < this.windowStart) {
      this.setSelectedIndex(this.windowStart);
    } else if (this.selectedIndex >= this.windowStart + this.config.visibleCount) {
      this.setSelectedIndex(this.windowStart + this.config.visibleCount - 1);
    } else {
      this.updateCards();
    }
  }

  private ensureSelectedVisible() {
    if (this.selectedIndex < 0) {
      this.windowStart = 0;
      return;
    }
    if (this.selectedIndex < this.windowStart) {
      this.windowStart = this.selectedIndex;
    } else if (this.selectedIndex >= this.windowStart + this.config.visibleCount) {
      this.windowStart = this.selectedIndex - this.config.visibleCount + 1;
    }
  }

  private setSelectedIndex(index: number) {
    if (this.mode !== 'items') {
      return;
    }
    if (index < 0 || index >= this.items.length) {
      return;
    }
    if (this.selectedIndex === index) {
      return;
    }
    this.selectedIndex = index;
    this.ensureSelectedVisible();
    this.updateCards();
    const item = this.items[index];
    if (item) {
      this.emit('change', item, index);
    }
  }

  private getTotalWidth() {
    return this.config.cardWidth * this.config.visibleCount + this.config.spacing * (this.config.visibleCount - 1);
  }
}
