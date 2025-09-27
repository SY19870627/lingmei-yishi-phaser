import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import type { SaveSystem, SaveSlotInfo } from '@core/Saver';
import type { WorldState } from '@core/WorldState';

type LoadSceneResult = { slot: number };

type SlotEntry = {
  slot: number;
  statusText: Phaser.GameObjects.Text;
  timeText: Phaser.GameObjects.Text;
  loadButton: Phaser.GameObjects.Text;
  overwriteButton: Phaser.GameObjects.Text;
};

export default class LoadScene extends ModuleScene<void, LoadSceneResult> {
  private saver?: SaveSystem;
  private world?: WorldState;
  private entries: SlotEntry[] = [];
  private feedbackText?: Phaser.GameObjects.Text;

  constructor() {
    super('LoadScene');
  }

  async create() {
    const { width, height } = this.scale;
    this.saver = this.registry.get('saver') as SaveSystem | undefined;
    this.world = this.registry.get('world') as WorldState | undefined;

    this.add
      .text(width / 2, 80, '存檔槽位', {
        fontSize: '32px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);

    this.feedbackText = this.add
      .text(width / 2, height - 60, '', {
        fontSize: '20px',
        color: '#aaf'
      })
      .setOrigin(0.5, 1);

    const closeButton = this.add
      .text(width / 2, height - 20, '返回', {
        fontSize: '22px',
        color: '#aaf'
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });

    closeButton.on('pointerup', () => {
      this.cancel(new Error('cancelled'));
    });

    if (!this.saver) {
      this.showError('缺少存檔管理器，無法讀取。');
      return;
    }

    this.buildSlots(width);
    await this.refreshSlots();
  }

  private buildSlots(width: number) {
    const startY = 160;
    const rowHeight = 140;

    for (let index = 0; index < 3; index += 1) {
      const slot = index;
      const baseY = startY + index * rowHeight;

      this.add
        .text(width / 2 - 360, baseY, `槽 ${slot + 1}`, {
          fontSize: '26px',
          color: '#fff'
        })
        .setOrigin(0, 0);

      const statusText = this.add
        .text(width / 2 - 360, baseY + 48, '', {
          fontSize: '20px',
          color: '#ddd'
        })
        .setOrigin(0, 0);

      const timeText = this.add
        .text(width / 2 - 360, baseY + 82, '', {
          fontSize: '18px',
          color: '#aaa'
        })
        .setOrigin(0, 0);

      const loadButton = this.add
        .text(width / 2 + 280, baseY + 36, '讀取', {
          fontSize: '22px',
          color: '#aaf'
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });

      loadButton.on('pointerup', () => {
        if (!this.saver) {
          return;
        }
        this.done({ slot });
      });

      const overwriteButton = this.add
        .text(width / 2 + 280, baseY + 76, '覆寫', {
          fontSize: '22px',
          color: '#faa'
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });

      overwriteButton.on('pointerup', async () => {
        if (!this.saver || !this.world) {
          return;
        }
        this.world.setFlag('lastSavedAt', Date.now());
        await this.saver.save(slot);
        await this.refreshSlots();
        this.showMessage(`已覆寫 ${slot + 1} 號槽位。`);
      });

      this.entries.push({ slot, statusText, timeText, loadButton, overwriteButton });
    }
  }

  private async refreshSlots() {
    if (!this.saver) {
      return;
    }

    const infos = await Promise.all(
      this.entries.map((entry) => this.saver!.getSlotInfo(entry.slot))
    );

    infos.forEach((info, index) => {
      this.applySlotInfo(this.entries[index], info);
    });
  }

  private applySlotInfo(entry: SlotEntry, info: SaveSlotInfo) {
    entry.statusText.setText(info.exists ? '已有存檔' : '空槽');
    const timestamp = info.lastSavedAt;
    if (info.exists && timestamp) {
      const formatted = new Date(timestamp).toLocaleString('zh-TW', {
        hour12: false
      });
      entry.timeText.setText(`最後更新：${formatted}`);
    } else {
      entry.timeText.setText('最後更新：—');
    }

    if (info.exists) {
      entry.loadButton.setAlpha(1).setInteractive({ useHandCursor: true });
    } else {
      entry.loadButton.setAlpha(0.4).disableInteractive();
    }
  }

  private showMessage(message: string) {
    if (this.feedbackText) {
      this.feedbackText.setText(message);
      this.time.delayedCall(1800, () => {
        this.feedbackText?.setText('');
      });
    }
  }

  private showError(message: string) {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, message, {
        fontSize: '22px',
        color: '#fff'
      })
      .setOrigin(0.5);
  }
}

