import Phaser from 'phaser';
import { Router } from '@core/Router';
import { DataRepo } from '@core/DataRepo';
import { WorldState } from '@core/WorldState';
import { AiOrchestrator } from '@core/AiOrchestrator';
import { bus } from '@core/EventBus';
import { LocalStorageSaver } from '@core/Saver';
import AutoSave from '@core/AutoSave';
import { DataValidator } from '@core/DataValidator';
import { GameSettings } from '@core/Settings';
import AudioBus from '@core/AudioBus';

/**
 * 遊戲初始化場景，負責載入資料、檢查格式並建立各種核心服務。
 */
export default class BootScene extends Phaser.Scene {
  constructor(){ super('BootScene'); }

  /**
   * 可在此放置共用資源的預載邏輯，目前留空供未來擴充。
   */
  preload(){ /* 可放字型/圖片 */ }

  /**
   * 建立核心物件、驗證資料並準備進入主選單。
   */
  async create(){
    const router = new Router(this.game); // 建立路由管理器，方便切換模組化場景。
    const repo   = new DataRepo(async (p)=> (await (await fetch(p))).json()); // 讀取靜態資料的存取層。
    const validator = new DataValidator(); // JSON Schema 驗證器，確保資料格式正確。

    const datasets = [
      { schema: 'sacred-item' as const, file: 'items', label: 'items.json' },
      { schema: 'wordcard' as const, file: 'wordcards', label: 'wordcards.json' },
      { schema: 'spirit' as const, file: 'spirits', label: 'spirits.json' },
      { schema: 'anchor' as const, file: 'anchors', label: 'anchors.json' },
      { schema: 'map' as const, file: 'maps', label: 'maps.json' },
      { schema: 'story' as const, file: 'stories', label: 'stories.json' },
    ];

    const validationErrors: string[] = [];
    for (const dataset of datasets){
      const data = await repo.get(dataset.file); // 從資料庫讀取每一份檔案。
      const result = validator.validate(dataset.schema, data); // 驗證資料是否符合 Schema。
      if (!result.ok){
        const messages = result.errors ?? ['Unknown validation error'];
        for (const message of messages){
          validationErrors.push(`${dataset.label}: ${message}`); // 將錯誤訊息收集起來供畫面顯示。
        }
      }
    }

    if (validationErrors.length > 0){
      this.showValidationErrors(validationErrors); // 若有錯誤則直接顯示報告並中止流程。
      return;
    }

    const settings = new GameSettings(); // 玩家設定儲存器。
    await settings.load(); // 讀取本機設定。

    const world  = new WorldState(); // 遊戲世界狀態容器。
    settings.applyWorldFlags(world); // 將設定影響的旗標套用到世界狀態。

    const aio    = new AiOrchestrator(settings); // AI 管理器，會根據設定決定是否使用 GPT。
    settings.on('change:offlineMode', () => aio.refreshMode()); // 當離線模式切換時同步更新 AI 模式。

    const saver  = new LocalStorageSaver(world); // 負責寫入與讀取存檔。
    AutoSave.install(bus, saver); // 安裝自動存檔機制。

    this.game.registry.set('router', router);
    this.game.registry.set('repo', repo);
    this.game.registry.set('world', world);
    this.game.registry.set('settings', settings);
    this.game.registry.set('aio', aio);
    this.game.registry.set('bus', bus);
    this.game.registry.set('saver', saver);
    this.game.registry.set('audioBus', new AudioBus(this.sound));

    this.scene.start('TitleScene'); // 一切就緒後切換到標題場景。
  }

  /**
   * 當資料檢查失敗時，在畫面上顯示清單提示開發者修正。
   */
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
