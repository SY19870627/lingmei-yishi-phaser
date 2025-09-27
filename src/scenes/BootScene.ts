import Phaser from 'phaser';
import { Router } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import { AiOrchestrator } from '@core/AiOrchestrator';
import { bus } from '@core/EventBus';
import { LocalStorageSaver } from '@core/Saver';
import AutoSave from '@core/AutoSave';
import { DataValidator } from '@core/DataValidator';

export default class BootScene extends Phaser.Scene {
  constructor(){ super('BootScene'); }
  preload(){ /* 可放字型/圖片 */ }
  async create(){
    const router = new Router(this.game);
    const repo   = new DataRepo(async (p)=> (await (await fetch(p))).json());
    const validator = new DataValidator();

    const datasets = [
      { schema: 'sacred-item' as const, file: 'items', label: 'items.json' },
      { schema: 'wordcard' as const, file: 'wordcards', label: 'wordcards.json' },
      { schema: 'npc' as const, file: 'npcs', label: 'npcs.json' },
      { schema: 'spirit' as const, file: 'spirits', label: 'spirits.json' },
      { schema: 'anchor' as const, file: 'anchors', label: 'anchors.json' },
      { schema: 'story' as const, file: 'stories', label: 'stories.json' },
    ];

    const validationErrors: string[] = [];
    for (const dataset of datasets){
      const data = await repo.get(dataset.file);
      const result = validator.validate(dataset.schema, data);
      if (!result.ok){
        const messages = result.errors ?? ['Unknown validation error'];
        for (const message of messages){
          validationErrors.push(`${dataset.label}: ${message}`);
        }
      }
    }

    if (validationErrors.length > 0){
      this.showValidationErrors(validationErrors);
      return;
    }

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

  private showValidationErrors(errors: string[]): void {
    this.cameras.main.setBackgroundColor(0x550000);

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(120, 0, 0, 0.94)';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = 'monospace';
    overlay.style.fontSize = '14px';
    overlay.style.lineHeight = '1.6';
    overlay.style.padding = '24px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.overflowY = 'auto';
    overlay.style.zIndex = '9999';

    const title = document.createElement('h1');
    title.textContent = '資料驗證失敗';
    title.style.marginTop = '0';
    overlay.appendChild(title);

    const hint = document.createElement('p');
    hint.textContent = '請修正以下資料錯誤後重新載入：';
    overlay.appendChild(hint);

    const list = document.createElement('ul');
    list.style.paddingLeft = '24px';
    list.style.whiteSpace = 'pre-wrap';
    for (const error of errors){
      const item = document.createElement('li');
      item.textContent = error;
      list.appendChild(item);
    }
    overlay.appendChild(list);

    document.body.appendChild(overlay);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      overlay.remove();
    });
  }
}
