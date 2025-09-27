import Phaser from 'phaser';
import { ModuleScene } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';

type AnchorData = {
  id: string;
  地點: string;
};

export default class MapScene extends ModuleScene {
  constructor() {
    super('MapScene');
  }

  create() {
    const { width, height } = this.scale;

    const repo = this.registry.get('repo') as DataRepo | undefined;
    const world = this.registry.get('world') as WorldState | undefined;

    const currentLocation = world?.data?.位置 ?? '未知';
    const flagEntries = Object.entries(world?.data?.旗標 ?? {});
    const flagText = flagEntries.length
      ? flagEntries.map(([key, value]) => `${key}: ${String(value)}`).join('\n')
      : '目前沒有旗標資料';

    this.add
      .text(width / 2, 40, '可去地點', {
        fontSize: '24px',
        color: '#fff'
      })
      .setOrigin(0.5, 0);

    this.add
      .text(32, 96, `當前位置：${currentLocation}\n旗標：\n${flagText}`, {
        fontSize: '18px',
        color: '#fff'
      })
      .setOrigin(0, 0);

    const locationsText = this.add
      .text(32, 192, '載入可去地點中……', {
        fontSize: '20px',
        color: '#fff',
        lineSpacing: 6
      })
      .setOrigin(0, 0);

    if (repo) {
      void this.populateLocations(repo, locationsText);
    } else {
      locationsText.setText('無法取得地點資料（缺少資料倉庫）');
    }

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

  private async populateLocations(repo: DataRepo, label: Phaser.GameObjects.Text) {
    try {
      const anchors = await repo.get<AnchorData[]>('anchors');
      const locationList = anchors.map((anchor) => `・${anchor.地點}`);
      if (locationList.length === 0) {
        label.setText('目前沒有可去地點');
        return;
      }
      label.setText(['可前往的地點：', ...locationList].join('\n'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      label.setText(`讀取地點資料時發生錯誤：${message}`);
    }
  }
}
