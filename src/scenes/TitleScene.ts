import type Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import { SaveManager } from '@core/SaveManager';

export default class TitleScene extends ModuleScene<void, { action: 'new' | 'load'; slot?: number }> {
  private loadMessage?: Phaser.GameObjects.Text;

  constructor() {
    super('TitleScene');
  }

  create() {
    const w = this.scale.width,
      h = this.scale.height;
    const saver = this.registry.get('saver') as SaveManager | undefined;
    this.add.text(w / 2, h / 2 - 40, '靈媒：意識流字卡', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    const start = this.add
      .text(w / 2, h / 2 + 10, '開始新遊戲', { fontSize: '20px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive();
    const load = this.add
      .text(w / 2, h / 2 + 50, '讀取進度', { fontSize: '20px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive();

    this.loadMessage = this.add
      .text(w / 2, h / 2 + 100, '', { fontSize: '18px', color: '#faa' })
      .setOrigin(0.5)
      .setVisible(false);

    start.on('pointerup', () => {
      this.hideLoadMessage();
      this.done({ action: 'new' });
    });
    load.on('pointerup', () => {
      this.hideLoadMessage();
      const slot = 0;
      if (!saver) {
        this.showLoadError('無法取得存檔資料。');
        return;
      }

      try {
        saver.load(slot);
        this.done({ action: 'load', slot });
      } catch (error) {
        const message = error instanceof Error && error.message === 'no save'
          ? '找不到可讀取的存檔。'
          : '讀取存檔時發生錯誤。';
        this.showLoadError(message);
      }
    });
  }

  protected override done(result: { action: 'new' | 'load'; slot?: number }) {
    super.done(result);
    if (result.action === 'new' || result.action === 'load') {
      this.scene.start('ShellScene');
    }
  }

  shutdown() {
    /* no-op */
  }

  private showLoadError(message: string) {
    this.loadMessage?.setText(message).setVisible(true);
  }

  private hideLoadMessage() {
    if (this.loadMessage?.visible) {
      this.loadMessage.setVisible(false);
    }
  }
}
