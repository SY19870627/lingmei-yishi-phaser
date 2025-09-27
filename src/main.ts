import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import ShellScene from './scenes/ShellScene';
import MapScene from './scenes/MapScene';
import StoryScene from './scenes/StoryScene';
import GhostCommScene from './scenes/GhostCommScene';
import MediationScene from './scenes/MediationScene';
import InventoryScene from './scenes/InventoryScene';
import WordCardsScene from './scenes/WordCardsScene';
import HintsScene from './scenes/HintsScene';
import LoadScene from './scenes/LoadScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#101010',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
  scene: [
    BootScene, TitleScene, ShellScene, MapScene,
    StoryScene, GhostCommScene, MediationScene,
    InventoryScene, WordCardsScene, HintsScene,
    LoadScene
  ]
};

new Phaser.Game(config);
