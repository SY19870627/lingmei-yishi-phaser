import { ModuleScene, Router } from '@core/Router';
import { WorldState } from '@core/WorldState';

export default class ShellScene extends ModuleScene {
  constructor() {
    super('ShellScene');
  }

  create() {
    const { width, height } = this.scale;
    const world = this.registry.get('world') as WorldState | undefined;
    const router = this.registry.get('router') as Router;

    const hudText = this.add
      .text(16, 16, '', {
        fontSize: '16px',
        color: '#fff'
      })
      .setOrigin(0, 0);

    const updateHud = () => {
      const location = world?.data?.位置 ?? '';
      const sha = world?.data?.煞氣 ?? '';
      const yin = world?.data?.陰德 ?? '';
      hudText.setText(`位置：${location}\n煞氣：${sha}\n陰德：${yin}`);
    };

    updateHud();

    this.time.addEvent({ delay: 200, loop: true, callback: updateHud });

    const mapButton = this.add
      .text(width / 2, height / 2, '開啟地圖', {
        fontSize: '24px',
        color: '#aaf'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    mapButton.on('pointerup', () => {
      router.push('MapScene');
    });

    const inventoryButton = this.add
      .text(width / 2, height / 2 + 60, '物品', {
        fontSize: '24px',
        color: '#aaf'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const pickedLabel = this.add
      .text(16, height - 16, '選擇的物品：無', {
        fontSize: '16px',
        color: '#fff'
      })
      .setOrigin(0, 1);

    inventoryButton.on('pointerup', async () => {
      const picked = await router.push<string | null>('InventoryScene');
      pickedLabel.setText(`選擇的物品：${picked ?? '無'}`);
    });

    const wordCardsButton = this.add
      .text(width / 2, height / 2 + 120, '字卡', {
        fontSize: '24px',
        color: '#aaf'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    wordCardsButton.on('pointerup', () => {
      router.push('WordCardsScene');
    });

    const hintsButton = this.add
      .text(width / 2, height / 2 + 180, '提示', {
        fontSize: '24px',
        color: '#aaf'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    hintsButton.on('pointerup', () => {
      router.push('HintsScene');
    });
  }
}
