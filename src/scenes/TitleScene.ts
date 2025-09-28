import { ModuleScene } from '@core/Router';
import type { Router } from '@core/Router';
import type { SaveSystem } from '@core/Saver';

export default class TitleScene extends ModuleScene {
  constructor() {
    super('TitleScene');
  }

  preload() {
    this.load.image('title-background', 'images/title/base-title-screen-variant.png');
  }

  create() {
  const w = this.scale.width;
  const h = this.scale.height;
  const router = this.registry.get('router') as Router | undefined;
  const saver = this.registry.get('saver') as SaveSystem | undefined;

  const background = this.add.image(w / 2, h / 2, 'title-background');
  const backgroundScale = Math.max(w / background.width, h / background.height);
  background.setScale(backgroundScale);

  // 共用中文字樣式：加上 padding-top 避免被裁切
  const zhBase = {
    fontFamily: 'Noto Sans TC, PingFang TC, "Microsoft JhengHei", sans-serif',
    padding: { top: 6, bottom: 2 },      // 關鍵：上方留白
    // 建議用 6 碼色碼；Phaser 對 8 碼 (#RRGGBBAA) 支援不一
    color: '#443489'
  } as const;

  this.add
    .text(w / 2, h / 2 - 60, '靈媒：意識流字卡', { ...zhBase, fontSize: '36px' })
    .setOrigin(0.5, 0.5);                 // 如還有被吃掉，可試 0.52～0.55

  const start = this.add
    .text(w / 2, h / 2, '開始遊戲', { ...zhBase, fontSize: '22px', color: '#621e1e' })
    .setOrigin(0.5, 0.5)
    .setInteractive({ useHandCursor: true });

  start.on('pointerup', () => this.scene.start('ShellScene'));

  const loadButton = this.add
    .text(w / 2, h / 2 + 60, '讀取存檔', { ...zhBase, fontSize: '22px', color: '#621e1e' })
    .setOrigin(0.5, 0.5)
    .setInteractive({ useHandCursor: true });

  const message = this.add
    .text(w / 2, h / 2 + 120, '', { ...zhBase, fontSize: '18px', color: '#a65f2a' })
    .setOrigin(0.5, 0.5);

  if (!router || !saver) {
    loadButton.setAlpha(0.4).disableInteractive();
    message.setText('目前無法讀取存檔。');
    return;
  }

  loadButton.on('pointerup', async () => {
    try {
      const result = await router.push<void, { slot: number }>('LoadScene');
      const slot = result?.slot ?? 0;
      const loaded = await saver.load(slot);
      if (loaded) this.scene.start('ShellScene');
      else {
        message.setText('存檔不存在或已損毀。');
        this.time.delayedCall(2400, () => message.setText(''));
      }
    } catch { /* 使用者取消 */ }
  });
}
}