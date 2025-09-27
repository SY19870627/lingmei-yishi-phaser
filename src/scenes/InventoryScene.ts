import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';

type ItemData = {
  id: string;
  '名'?: string;
  '來源'?: string;
  '用途'?: string[];
};

export default class InventoryScene extends ModuleScene<void, string | null> {
  constructor() {
    super('InventoryScene');
  }

  async create() {
    const repo = this.registry.get('repo') as DataRepo | undefined;
    const { width, height } = this.scale;

    this.add.text(width / 2, 48, '物品列表', { fontSize: '28px', color: '#fff' }).setOrigin(0.5);

    let selectedItemId: string | null = null;
    const selectedLabel = this.add
      .text(width / 2, height - 140, '目前選擇：無', { fontSize: '18px', color: '#fff' })
      .setOrigin(0.5);

    const closeButton = this.add
      .text(width / 2, height - 80, '關閉並回傳選到的物品 id（或 null）', {
        fontSize: '20px',
        color: '#aaf'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    closeButton.on('pointerup', () => {
      this.done(selectedItemId ?? null);
    });

    if (!repo) {
      selectedLabel.setText('目前選擇：資料庫不可用');
      closeButton.setStyle({ color: '#faa' });
      return;
    }

    const items = await repo.get<ItemData[]>('items');
    const itemEntries: { id: string; text: Phaser.GameObjects.Text }[] = [];

    const updateSelection = () => {
      itemEntries.forEach(({ id, text }) => {
        text.setStyle({ color: id === selectedItemId ? '#ff0' : '#aaf' });
      });
      selectedLabel.setText(`目前選擇：${selectedItemId ?? '無'}`);
    };

    items.forEach((item, index) => {
      const label = `${item['名'] ?? item.id}`;
      const itemText = this.add
        .text(width / 2, 120 + index * 36, label, { fontSize: '20px', color: '#aaf' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      itemText.on('pointerup', () => {
        selectedItemId = item.id;
        updateSelection();
      });

      itemEntries.push({ id: item.id, text: itemText });
    });

    updateSelection();
  }
}
