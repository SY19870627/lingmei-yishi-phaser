import Phaser from 'phaser';

export interface CardBoardConfig {
  cardWidth?: number;
  cardHeight?: number;
  cardSpacing?: number;
  boardBackgroundColor?: number;
  boardBackgroundAlpha?: number;
  cardBackgroundColor?: number;
  cardBackgroundAlpha?: number;
  cardHighlightColor?: number;
  titleFontSize?: string;
  tagFontSize?: string;
  descriptionFontSize?: string;
  titleColor?: string;
  tagColor?: string;
  descriptionColor?: string;
  messageColor?: string;
  navigationFontSize?: string;
}

export interface CardBoardItem<T = unknown> {
  id?: string;
  title: string;
  description?: string;
  tags?: string[];
  data: T;
  disabled?: boolean;
}

type Mode = 'cards' | 'message';

interface CardSlot<T> {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  descriptionBaseY: number;
  descriptionWithTagY: number;
  data?: CardBoardItem<T>;
  disabled?: boolean;
}

export default class CardBoard<T = unknown> extends Phaser.Events.EventEmitter {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;

  private readonly config: Required<CardBoardConfig>;

  private readonly slots: CardSlot<T>[] = [];

  private readonly messageText: Phaser.GameObjects.Text;

  private readonly background: Phaser.GameObjects.Rectangle;

  private readonly prevButton: Phaser.GameObjects.Text;

  private readonly nextButton: Phaser.GameObjects.Text;

  private readonly pageIndicator: Phaser.GameObjects.Text;

  private items: CardBoardItem<T>[] = [];

  private pageIndex = 0;

  private mode: Mode = 'message';

  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: CardBoardConfig = {}) {
    super();
    this.scene = scene;
    this.config = {
      cardWidth: config.cardWidth ?? 220,
      cardHeight: config.cardHeight ?? 160,
      cardSpacing: config.cardSpacing ?? 48,
      boardBackgroundColor: config.boardBackgroundColor ?? 0x0c0a08,
      boardBackgroundAlpha: config.boardBackgroundAlpha ?? 0.4,
      cardBackgroundColor: config.cardBackgroundColor ?? 0x1f1b16,
      cardBackgroundAlpha: config.cardBackgroundAlpha ?? 0.82,
      cardHighlightColor: config.cardHighlightColor ?? 0x40362d,
      titleFontSize: config.titleFontSize ?? '28px',
      tagFontSize: config.tagFontSize ?? '20px',
      descriptionFontSize: config.descriptionFontSize ?? '18px',
      titleColor: config.titleColor ?? '#f3e3c2',
      tagColor: config.tagColor ?? '#d6c29c',
      descriptionColor: config.descriptionColor ?? '#d5c3a5',
      messageColor: config.messageColor ?? '#e8d9bd',
      navigationFontSize: config.navigationFontSize ?? '36px'
    };

    this.container = scene.add.container(x, y);

    const boardWidth = this.config.cardWidth * 3 + this.config.cardSpacing * 2;
    const boardHeight = this.config.cardHeight + 40;

    this.background = scene.add
      .rectangle(0, 0, boardWidth + 80, boardHeight + 40, this.config.boardBackgroundColor, this.config.boardBackgroundAlpha)
      .setOrigin(0.5, 0.5);

    this.container.add(this.background);

    this.messageText = scene.add
      .text(0, 0, '', {
        fontSize: this.config.descriptionFontSize,
        color: this.config.messageColor,
        align: 'center',
        wordWrap: { width: boardWidth - 40 }
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.container.add(this.messageText);

    const slotSpacing = this.config.cardWidth + this.config.cardSpacing;
    const startX = -slotSpacing;

    for (let index = 0; index < 3; index += 1) {
      const slotX = startX + index * slotSpacing;
      const slot = this.createSlot(slotX, 0);
      this.slots.push(slot);
      this.container.add(slot.container);
    }

    const navOffset = slotSpacing * 1.4;
    this.prevButton = scene.add
      .text(-navOffset, 0, '‹', {
        fontSize: this.config.navigationFontSize,
        color: this.config.titleColor
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    this.nextButton = scene.add
      .text(navOffset, 0, '›', {
        fontSize: this.config.navigationFontSize,
        color: this.config.titleColor
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    this.prevButton.on('pointerup', () => {
      this.movePage(-1);
    });
    this.nextButton.on('pointerup', () => {
      this.movePage(1);
    });

    this.container.add(this.prevButton);
    this.container.add(this.nextButton);

    this.pageIndicator = scene.add
      .text(0, boardHeight / 2, '', {
        fontSize: '18px',
        color: this.config.descriptionColor
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.container.add(this.pageIndicator);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  setItems(items: CardBoardItem<T>[], resetPage = true) {
    this.items = items.slice();
    this.mode = 'cards';
    if (resetPage || this.pageIndex >= this.getPageCount()) {
      this.pageIndex = 0;
    }
    this.refresh();
  }

  setPage(index: number) {
    const clamped = Phaser.Math.Clamp(index, 0, Math.max(this.getPageCount() - 1, 0));
    if (clamped === this.pageIndex) {
      return;
    }
    this.pageIndex = clamped;
    this.refresh();
  }

  getPageIndex() {
    return this.pageIndex;
  }

  getPageCount() {
    if (!this.items.length) {
      return 0;
    }
    return Math.ceil(this.items.length / this.slots.length);
  }

  setMessage(message: string | string[]) {
    const lines = Array.isArray(message) ? message : [message];
    this.mode = 'message';
    this.messageText.setText(lines.join('\n'));
    this.refresh();
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.prevButton.removeAllListeners();
    this.nextButton.removeAllListeners();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.slots.forEach((slot) => {
      slot.container.removeAllListeners();
      slot.container.destroy(true);
    });
    this.prevButton.destroy();
    this.nextButton.destroy();
    this.pageIndicator.destroy();
    this.messageText.destroy();
    this.background.destroy();
    this.container.destroy(true);
    this.removeAllListeners();
  }

  private createSlot(x: number, y: number): CardSlot<T> {
    const {
      cardWidth,
      cardHeight,
      cardBackgroundColor,
      cardBackgroundAlpha,
      titleFontSize,
      tagFontSize,
      descriptionFontSize,
      titleColor,
      tagColor,
      descriptionColor
    } = this.config;

    const container = this.scene.add.container(x, y);
    container.setSize(cardWidth, cardHeight);
    container.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);

    const background = this.scene.add
      .rectangle(0, 0, cardWidth, cardHeight, cardBackgroundColor, cardBackgroundAlpha)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, 0x715c43, 0.9);

    const titleTop = -cardHeight / 2 + 24;
    const title = this.scene.add
      .text(0, titleTop, '', {
        fontSize: titleFontSize,
        color: titleColor,
        align: 'center',
        wordWrap: { width: cardWidth - 32 }
      })
      .setOrigin(0.5, 0);

    const tagTop = titleTop + 44;
    const tag = this.scene.add
      .text(0, tagTop, '', {
        fontSize: tagFontSize,
        color: tagColor,
        align: 'center',
        wordWrap: { width: cardWidth - 36 }
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    const descriptionBaseY = -cardHeight / 2 + 86;
    const descriptionWithTagY = tagTop + 36;

    const description = this.scene.add
      .text(0, descriptionBaseY, '', {
        fontSize: descriptionFontSize,
        color: descriptionColor,
        align: 'center',
        wordWrap: { width: cardWidth - 36 }
      })
      .setOrigin(0.5, 0);

    container.add([background, title, tag, description]);
    container.setVisible(false);

    container.on('pointerover', () => {
      if (container.visible && !container.getData('disabled')) {
        background.setFillStyle(this.config.cardHighlightColor, this.config.cardBackgroundAlpha);
      }
    });
    container.on('pointerout', () => {
      if (container.visible) {
        background.setFillStyle(cardBackgroundColor, cardBackgroundAlpha);
      }
    });
    container.on('pointerup', () => {
      const item = container.getData('item') as CardBoardItem<T> | undefined;
      const disabled = container.getData('disabled');
      if (item && !disabled) {
        this.emit('select', item);
      }
    });

    return {
      container,
      background,
      title,
      tag,
      description,
      descriptionBaseY,
      descriptionWithTagY
    };
  }

  private refresh() {
    if (this.mode === 'message') {
      this.showMessageMode();
    } else {
      this.showCardMode();
    }
  }

  private showMessageMode() {
    this.messageText.setVisible(true);
    this.prevButton.setVisible(false);
    this.nextButton.setVisible(false);
    this.pageIndicator.setVisible(false);
    this.slots.forEach((slot) => {
      slot.container.setVisible(false);
      slot.container.setData('item', undefined);
      slot.container.setData('disabled', true);
      slot.background.setFillStyle(this.config.cardBackgroundColor, this.config.cardBackgroundAlpha);
      slot.tag.setVisible(false);
    });
  }

  private showCardMode() {
    this.messageText.setVisible(false);
    const pageCount = this.getPageCount();
    const hasMultiplePages = pageCount > 1;
    this.prevButton.setVisible(hasMultiplePages);
    this.nextButton.setVisible(hasMultiplePages);
    this.prevButton.setAlpha(this.pageIndex > 0 ? 1 : 0.5);
    this.nextButton.setAlpha(this.pageIndex < pageCount - 1 ? 1 : 0.5);
    this.prevButton.disableInteractive();
    this.nextButton.disableInteractive();
    if (hasMultiplePages) {
      if (this.pageIndex > 0) {
        this.prevButton.setInteractive({ useHandCursor: true });
      }
      if (this.pageIndex < pageCount - 1) {
        this.nextButton.setInteractive({ useHandCursor: true });
      }
    }

    const start = this.pageIndex * this.slots.length;
    const end = start + this.slots.length;
    const slice = this.items.slice(start, end);

    this.slots.forEach((slot, index) => {
      const item = slice[index];
      if (!item) {
        slot.container.setVisible(false);
        slot.container.setData('item', undefined);
        slot.container.setData('disabled', true);
        slot.background.setFillStyle(this.config.cardBackgroundColor, this.config.cardBackgroundAlpha);
        slot.tag.setVisible(false);
        return;
      }

      slot.title.setText(item.title);
      slot.description.setText(item.description ?? '');
      const tags = Array.isArray(item.tags) ? item.tags.filter((tag) => Boolean(tag)) : [];
      if (tags.length) {
        slot.tag.setText(tags.join(' / '));
        slot.tag.setVisible(true);
        slot.description.setY(slot.descriptionWithTagY);
      } else {
        slot.tag.setText('');
        slot.tag.setVisible(false);
        slot.description.setY(slot.descriptionBaseY);
      }
      slot.container.setData('item', item);
      slot.container.setData('disabled', Boolean(item.disabled));
      slot.container.setVisible(true);
      slot.background.setFillStyle(this.config.cardBackgroundColor, this.config.cardBackgroundAlpha);
      if (item.disabled) {
        slot.background.setAlpha(this.config.cardBackgroundAlpha * 0.6);
        slot.title.setAlpha(0.6);
        slot.tag.setAlpha(0.6);
        slot.description.setAlpha(0.6);
      } else {
        slot.background.setAlpha(this.config.cardBackgroundAlpha);
        slot.title.setAlpha(1);
        slot.tag.setAlpha(0.9);
        slot.description.setAlpha(0.9);
      }
    });

    if (pageCount > 0) {
      this.pageIndicator.setVisible(true);
      this.pageIndicator.setText(`${this.pageIndex + 1} / ${pageCount}`);
    } else {
      this.pageIndicator.setVisible(false);
    }

    this.emit('pagechange', this.pageIndex, pageCount);
  }

  private movePage(delta: number) {
    const pageCount = this.getPageCount();
    if (pageCount <= 1) {
      return;
    }
    const next = Phaser.Math.Clamp(this.pageIndex + delta, 0, pageCount - 1);
    if (next === this.pageIndex) {
      return;
    }
    this.pageIndex = next;
    this.refresh();
  }

  getHeight() {
    return this.background.height;
  }
}
