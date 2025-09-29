import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';
import IntroScene from './scenes/IntroScene'; // 新增開頭場景
import ShellScene from './scenes/ShellScene';
import MapScene from './scenes/MapScene';
import StoryScene from './scenes/StoryScene';
import GhostCommScene from './scenes/GhostCommScene';
import InventoryScene from './scenes/InventoryScene';
import WordCardsScene from './scenes/WordCardsScene';
import HintsScene from './scenes/HintsScene';
import SettingsScene from './scenes/SettingsScene';
import LoadScene from './scenes/LoadScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#101010',
  scale: { 
    mode: Phaser.Scale.FIT, 
    autoCenter: Phaser.Scale.CENTER_BOTH, 
    width: 1280, 
    height: 720 
  },
  scene: [
    BootScene, 
    TitleScene, 
    IntroScene,  // 加入開頭場景
    ShellScene, 
    MapScene,
    StoryScene, 
    GhostCommScene,
    InventoryScene, 
    WordCardsScene, 
    HintsScene,
    SettingsScene,
    LoadScene
  ]
};

new Phaser.Game(config);