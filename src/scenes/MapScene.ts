import { ModuleScene } from '@core/Router';

export default class MapScene extends ModuleScene {
  constructor() {
    super('MapScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, '這裡會列出可去地點與可啟動劇情', {
        fontSize: '20px',
        color: '#fff'
      })
      .setOrigin(0.5);

    const saveMessage = this.add
      .text(16, height - 16, '', {
        fontSize: '16px',
        color: '#fff'
      })
      .setOrigin(0, 1);

    const saveButton = this.add
      .text(width - 16, 16, '存檔', {
        fontSize: '18px',
        color: '#aaf'
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    saveButton.on('pointerup', () => {
      const saver = this.registry.get('saver');
      if (saver && typeof saver.save === 'function') {
        saver.save(0);
      }
      saveMessage.setText('已存檔');
    });
  }
}
