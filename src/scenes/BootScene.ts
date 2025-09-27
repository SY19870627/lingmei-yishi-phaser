import Phaser from 'phaser';
import { Router } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import { SaveManager } from '@core/SaveManager';
import { AiOrchestrator } from '@core/AiOrchestrator';
import { bus } from '@core/EventBus';

export default class BootScene extends Phaser.Scene {
  constructor(){ super('BootScene'); }
  preload(){ /* 可放字型/圖片 */ }
  async create(){
    const router = new Router(this.game);
    const repo   = new DataRepo(async (p)=> (await (await fetch(p))).json());
    const world  = new WorldState();
    const saver  = new SaveManager(world);
    const aio    = new AiOrchestrator();

    this.game.registry.set('router', router);
    this.game.registry.set('repo', repo);
    this.game.registry.set('world', world);
    this.game.registry.set('saver', saver);
    this.game.registry.set('aio', aio);
    this.game.registry.set('bus', bus);

    this.scene.start('TitleScene');
  }
}
