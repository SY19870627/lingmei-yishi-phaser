import { ModuleScene } from '@core/Router';
import type { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import HintsManager, { type HintEntry } from '@core/HintsManager';
import type { Anchor, Spirit, StoryNode } from '@core/Types';

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
    let anchors: Anchor[] = [];
    let spirits: Spirit[] = [];
    let stories: StoryNode[] = [];

    if (repo) {
      try {
        const [strings, anchorData, spiritData, storyData] = await Promise.all([
          repo.get<StringsData>('strings'),
          repo.get<Anchor[]>('anchors'),
          repo.get<Spirit[]>('spirits')
        ]);
        title = strings?.ui?.hints ?? title;
        anchors = Array.isArray(anchorData) ? anchorData : [];
        spirits = Array.isArray(spiritData) ? spiritData : [];
        stories = Array.isArray(storyData) ? storyData : [];
      } catch (error) {
        // ignore load errors and keep default data fallbacks
      }
    }

    this.add.text(width / 2, 48, title, { fontSize: '28px', color: '#fff' }).setOrigin(0.5);

    const hints = HintsManager.gather(world, spirits, anchors, stories);
    const directionsText = hints.length ? this.composeHintList(hints) : '目前沒有可採取的方向。';

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

  private composeHintList(hints: HintEntry[]): string {
    return hints
      .map((hint) => `• [${hint.kind}] ${hint.text}`)
      .join('\n');
  }
}
