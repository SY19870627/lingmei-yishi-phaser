import { ModuleScene } from '@core/Router';

export default class TitleScene extends ModuleScene {
  
  constructor() {
    super('TitleScene');
  }

  create() {
    const w = this.scale.width,
      h = this.scale.height;
    this.add.text(w / 2, h / 2 - 40, '靈媒：意識流字卡', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    const start = this.add
      .text(w / 2, h / 2 + 10, '開始遊戲', { fontSize: '20px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    start.on('pointerup', () => {
      this.scene.start('ShellScene');
    });
  }
}
