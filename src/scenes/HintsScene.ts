import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';

type StringsData = {
  ui?: {
    hints?: string;
  };
};

export default class HintsScene extends ModuleScene<void, void> {
  constructor() {
    super('HintsScene');
  }

  async create() {
    const repo = this.registry.get('repo') as DataRepo | undefined;
    const world = this.registry.get('world') as WorldState | undefined;
    const { width, height } = this.scale;

    let title = '提示';

    if (repo) {
      try {
        const strings = await repo.get<StringsData>('strings');
        title = strings?.ui?.hints ?? title;
      } catch (error) {
        // ignore load errors and keep default title
      }
    }

    this.add.text(width / 2, 48, title, { fontSize: '28px', color: '#fff' }).setOrigin(0.5);

    const flags = world?.data?.旗標 ?? {};
    const entries = Object.entries(flags);

    const directionsText = entries.length
      ? entries
          .map(([key, value]) => `• ${key}：${typeof value === 'string' ? value : JSON.stringify(value)}`)
          .join('\n')
      : '目前沒有可採取的方向。';

    this.add
      .text(width / 2, height / 2, directionsText, {
        fontSize: '20px',
        color: '#fff',
        align: 'center',
        wordWrap: { width: width - 80 }
      })
      .setOrigin(0.5);

    const closeButton = this.add
      .text(width / 2, height - 80, '關閉', { fontSize: '22px', color: '#aaf' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    closeButton.on('pointerup', () => {
      this.done(undefined as void);
    });
  }
}
