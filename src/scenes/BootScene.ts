import Phaser from 'phaser';
import { Router } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import { AiOrchestrator } from '@core/AiOrchestrator';
import { bus } from '@core/EventBus';
import { LocalStorageSaver } from '@core/Saver';
import AutoSave from '@core/AutoSave';

export default class BootScene extends Phaser.Scene {
  constructor(){ super('BootScene'); }
  preload(){ /* 可放字型/圖片 */ }
  async create(){
    const router = new Router(this.game);
    const repo   = new DataRepo(async (p)=> (await (await fetch(p))).json());
    const world  = new WorldState();
    const aio    = new AiOrchestrator();
    const saver  = new LocalStorageSaver(world);
    AutoSave.install(bus, saver);

    this.game.registry.set('router', router);
    this.game.registry.set('repo', repo);
    this.game.registry.set('world', world);
    this.game.registry.set('aio', aio);
    this.game.registry.set('bus', bus);
    this.game.registry.set('saver', saver);

    this.scene.start('TitleScene');
  }
}
