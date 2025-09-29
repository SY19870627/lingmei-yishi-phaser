import { ModuleScene } from '@core/Router';
import type { Router } from '@core/Router';
import type { SaveSystem } from '@core/Saver';
import type { WorldState } from '@core/WorldState';

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
    const world = this.registry.get('world') as WorldState | undefined;

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
      padding: { top: 6, bottom: 2 },
      color: '#621e1e'
    } as const;

    // 檢查是否為首次遊玩
    const isFirstPlay = !world?.data?.旗標?.['intro_completed'];

    if (isFirstPlay) {
      // 首次遊玩 - 顯示「新的旅程」按鈕
      const newGameButton = this.add
        .text(w / 2, h / 2 + 120, '新的旅程', { ...zhBase, fontSize: '26px', color: '#621e1e' })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      newGameButton.on('pointerover', () => {
        newGameButton.setStyle({ color: '#8b2d2d' }).setScale(1.1);
      });

      newGameButton.on('pointerout', () => {
        newGameButton.setStyle({ color: '#621e1e' }).setScale(1);
      });

      newGameButton.on('pointerup', () => {
        // 播放開頭劇情
        if (router) {
          void router.push('IntroScene').then(() => {
            // 開頭結束後會自動回到 TitleScene
          });
        } else {
          // 如果沒有 router，直接開始遊戲
          this.scene.start('ShellScene');
        }
      });

      // 快速開始（跳過開頭）
      const skipIntroButton = this.add
        .text(w / 2, h / 2 + 170, '跳過開頭', { ...zhBase, fontSize: '18px', color: '#888' })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      skipIntroButton.on('pointerover', () => {
        skipIntroButton.setStyle({ color: '#aaa' });
      });

      skipIntroButton.on('pointerout', () => {
        skipIntroButton.setStyle({ color: '#888' });
      });

      skipIntroButton.on('pointerup', () => {
        // 標記開頭已看過
        if (world) {
          world.setFlag('intro_completed', true);
          world.data.位置 = '港邊醫館後巷';
          world.data.煞氣 = '濁';
          world.grantItem('it_grandma_amulet');
          world.data.字卡 = ['w_wait', 'w_listen', 'w_help'];
        }
        this.scene.start('ShellScene');
      });

    } else {
      // 已經看過開頭 - 顯示正常的開始遊戲按鈕
      const continueButton = this.add
        .text(w / 2, h / 2 + 120, '繼續遊戲', { ...zhBase, fontSize: '22px', color: '#621e1e' })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      continueButton.on('pointerup', () => this.scene.start('ShellScene'));

      // 新遊戲按鈕（會清除存檔）
      const newGameButton = this.add
        .text(w / 2, h / 2 + 170, '新遊戲', { ...zhBase, fontSize: '20px', color: '#621e1e' })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      newGameButton.on('pointerup', () => {
        // 顯示確認對話框
        this.showConfirmDialog(
          '開始新遊戲將會清除目前的進度，確定要繼續嗎？',
          () => {
            // 清除存檔並重新播放開頭
            if (world) {
              // 重置世界狀態
              world.data = {
                位置: "港邊醫館後巷",
                煞氣: "濁",
                陰德: "低",
                物品: [],
                字卡: [],
                旗標: {},
                已安息靈: [],
                對話摘要: [],
                版本: 1
              };
            }
            // 播放開頭劇情
            if (router) {
              void router.push('IntroScene');
            } else {
              this.scene.start('ShellScene');
            }
          }
        );
      });

      // 重看開頭按鈕
      const replayIntroButton = this.add
        .text(w / 2, h / 2 + 220, '重看開頭', { ...zhBase, fontSize: '18px', color: '#888' })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      replayIntroButton.on('pointerup', () => {
        if (router) {
          void router.push('IntroScene');
        }
      });
    }

    // 讀取存檔按鈕（兩種模式都有）
    const loadButton = this.add
      .text(w / 2, h / 2 + (isFirstPlay ? 220 : 270), '讀取存檔', { 
        ...zhBase, 
        fontSize: '22px', 
        color: '#621e1e' 
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    const message = this.add
      .text(w / 2, h / 2 + (isFirstPlay ? 280 : 330), '', { 
        ...zhBase, 
        fontSize: '18px', 
        color: '#a65f2a' 
      })
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

  private showConfirmDialog(message: string, onConfirm: () => void) {
    const { width, height } = this.scale;
    
    // 半透明背景
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive(); // 阻擋點擊
    
    // 對話框背景
    const dialogBox = this.add.rectangle(width / 2, height / 2, 500, 200, 0x2a2a2a, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.5);
    
    // 訊息文字
    const messageText = this.add.text(width / 2, height / 2 - 30, message, {
      fontFamily: 'Noto Sans TC, PingFang TC, "Microsoft JhengHei", sans-serif',
      fontSize: '20px',
      color: '#fff',
      align: 'center',
      wordWrap: { width: 450 },
      padding: { top: 6 }
    }).setOrigin(0.5);
    
    // 確認按鈕
    const confirmButton = this.add.text(width / 2 - 80, height / 2 + 50, '確定', {
      fontFamily: 'Noto Sans TC, PingFang TC, "Microsoft JhengHei", sans-serif',
      fontSize: '20px',
      color: '#aaf',
      padding: { top: 6 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
    
    // 取消按鈕
    const cancelButton = this.add.text(width / 2 + 80, height / 2 + 50, '取消', {
      fontFamily: 'Noto Sans TC, PingFang TC, "Microsoft JhengHei", sans-serif',
      fontSize: '20px',
      color: '#faa',
      padding: { top: 6 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
    
    // 按鈕互動
    confirmButton.on('pointerover', () => confirmButton.setScale(1.1));
    confirmButton.on('pointerout', () => confirmButton.setScale(1));
    confirmButton.on('pointerup', () => {
      // 清理對話框
      overlay.destroy();
      dialogBox.destroy();
      messageText.destroy();
      confirmButton.destroy();
      cancelButton.destroy();
      // 執行確認動作
      onConfirm();
    });
    
    cancelButton.on('pointerover', () => cancelButton.setScale(1.1));
    cancelButton.on('pointerout', () => cancelButton.setScale(1));
    cancelButton.on('pointerup', () => {
      // 只清理對話框
      overlay.destroy();
      dialogBox.destroy();
      messageText.destroy();
      confirmButton.destroy();
      cancelButton.destroy();
    });
  }
}