import type Phaser from 'phaser';
import type { SaveSystem } from './Saver';
import type { WorldState } from './WorldState';

export class AutoSave {
  static install(bus: Phaser.Events.EventEmitter, saver: SaveSystem) {
    const listener = async () => {
      try {
        const world: WorldState | undefined = saver.getWorld();
        if (world) {
          world.setFlag('lastSavedAt', Date.now());
        }
        await saver.save(0);
      } catch (error) {
        console.error('自動存檔失敗', error);
      }
    };

    bus.on('autosave', listener);
  }
}

export default AutoSave;
