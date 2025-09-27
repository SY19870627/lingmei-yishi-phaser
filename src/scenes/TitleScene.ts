import { ModuleScene } from '@core/Router';

export default class TitleScene extends ModuleScene<void, { action: 'new' | 'load'; slot?: number }> {
  constructor() {
    super('TitleScene');
  }

  create() {
    const w = this.scale.width,
      h = this.scale.height;
    this.add.text(w / 2, h / 2 - 40, '靈媒：意識流字卡', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    const start = this.add
      .text(w / 2, h / 2 + 10, '開始新遊戲', { fontSize: '20px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive();
    const load = this.add
      .text(w / 2, h / 2 + 50, '讀取進度', { fontSize: '20px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive();

    start.on('pointerup', () => this.done({ action: 'new' }));
    load.on('pointerup', () => this.done({ action: 'load', slot: 0 }));
  }

  protected override done(result: { action: 'new' | 'load'; slot?: number }) {
    super.done(result);
    if (result.action === 'new') {
      this.scene.start('ShellScene');
    }
  }

  shutdown() {
    /* no-op */
  }
}
