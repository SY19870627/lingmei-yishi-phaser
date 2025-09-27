import { ModuleScene } from '@core/Router';

export default class ShellScene extends ModuleScene {
  constructor() {
    super('ShellScene');
  }

  create() {
    const { width, height } = this.scale;
    const world = this.registry.get('world');
    const location = world?.data?.位置 ?? '';
    const sha = world?.data?.煞氣 ?? '';
    const yin = world?.data?.陰德 ?? '';

    this.add
      .text(16, 16, `位置：${location}\n煞氣：${sha}\n陰德：${yin}`, {
        fontSize: '16px',
        color: '#fff'
      })
      .setOrigin(0, 0);

    const mapButton = this.add
      .text(width / 2, height / 2, '開啟地圖', {
        fontSize: '24px',
        color: '#aaf'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    mapButton.on('pointerup', () => {
      this.registry.get('router').push('MapScene');
    });
  }
}
