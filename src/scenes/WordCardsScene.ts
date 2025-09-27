import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import type { WordCard } from '@core/Types';

export default class WordCardsScene extends ModuleScene<void, void> {
  constructor() {
    super('WordCardsScene');
  }

  async create() {
    const repo = this.registry.get('repo') as DataRepo | undefined;
    const { width, height } = this.scale;

    this.add.text(width / 2, 48, '字卡', { fontSize: '28px', color: '#fff' }).setOrigin(0.5);

    const noteLabel = this.add
      .text(width / 2, height - 180, '點選字卡以檢視備註', {
        fontSize: '18px',
        color: '#fff',
        align: 'center',
        wordWrap: { width: width - 80 }
      })
      .setOrigin(0.5, 0);

    const closeButton = this.add
      .text(width / 2, height - 80, '關閉', { fontSize: '22px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    closeButton.on('pointerup', () => {
      this.done(undefined as void);
    });

    if (!repo) {
      noteLabel.setText('資料庫不可用');
      closeButton.setStyle({ color: '#faa' });
      return;
    }

    const cards = await repo.get<WordCard[]>('wordcards');
    const entries: { id: string; text: Phaser.GameObjects.Text; card: WordCard }[] = [];
    let selectedId: string | null = null;

    const updateSelection = () => {
      entries.forEach(({ id, text, card }) => {
        const tags = (card['標籤'] ?? []).join('、');
        const displayLabel = tags ? `${card['字']}（${tags}）` : card['字'];
        text.setText(displayLabel);
        text.setStyle({ color: id === selectedId ? '#ff0' : '#aaf' });
        if (id === selectedId) {
          const note = card['備註']?.trim();
          const noteText = note && note.length > 0 ? note : '尚無備註。';
          const title = tags ? `${card['字']}（${tags}）` : card['字'];
          noteLabel.setText(`${title}\n${noteText}`.trim());
        }
      });

      if (!selectedId) {
        noteLabel.setText('點選字卡以檢視備註');
      }
    };

    cards.forEach((card, index) => {
      const tags = (card['標籤'] ?? []).join('、');
      const label = tags ? `${card['字']}（${tags}）` : card['字'];
      const text = this.add
        .text(width / 2, 120 + index * 36, label, { fontSize: '20px', color: '#aaf' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      text.on('pointerup', () => {
        selectedId = card.id;
        updateSelection();
      });

      entries.push({ id: card.id, text, card });
    });

    updateSelection();
  }
}
