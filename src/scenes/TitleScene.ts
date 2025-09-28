import { ModuleScene } from '@core/Router';
import type { Router } from '@core/Router';
import type { SaveSystem } from '@core/Saver';

export default class TitleScene extends ModuleScene {
  constructor() {
    super('TitleScene');
  }

  preload() {
    this.load.image('title-background', 'images/title/base-title-screen-variant.png');
    this.load.image('title-word', 'images/title/base-title-word.png');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const router = this.registry.get('router') as Router | undefined;
    const saver = this.registry.get('saver') as SaveSystem | undefined;

    const background = this.add.image(w / 2, h / 2, 'title-background');
    const backgroundScale = Math.max(w / background.width, h / background.height);
    background.setScale(backgroundScale);

    const titleWord = this.add.image(w / 2, h / 2 - 120, 'title-word').setOrigin(0.5);
    const maxTitleWidth = w * 0.6;
    if (titleWord.displayWidth > maxTitleWidth) {
      titleWord.setScale(maxTitleWidth / titleWord.displayWidth);
    }

  // 共用中文字樣式：加上 padding-top 避免被裁切
  const zhBase = {
    fontFamily: 'Noto Sans TC, PingFang TC, "Microsoft JhengHei", sans-serif',
    padding: { top: 6, bottom: 2 },      // 關鍵：上方留白
    // 建議用 6 碼色碼；Phaser 對 8 碼 (#RRGGBBAA) 支援不一
    color: '#443489'
  } as const;
  
  const start = this.add
    .text(w / 2, h / 2 + 120, '開始遊戲', { ...zhBase, fontSize: '22px', color: '#621e1e' })
    .setOrigin(0.5, 0.5)
    .setInteractive({ useHandCursor: true });

  start.on('pointerup', () => this.scene.start('ShellScene'));

  const loadButton = this.add
    .text(w / 2, h / 2 + 180, '讀取存檔', { ...zhBase, fontSize: '22px', color: '#621e1e' })
    .setOrigin(0.5, 0.5)
    .setInteractive({ useHandCursor: true });

  const message = this.add
    .text(w / 2, h / 2 + 240, '', { ...zhBase, fontSize: '18px', color: '#a65f2a' })
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