# 架構概覽

## 場景與共享資源關係
- `BootScene`
  - 建立 `Router`、`DataRepo`、`WorldState`、`AiOrchestrator`、`EventBus`，並放入 `registry`。
  - 啟動 `TitleScene` 做為入口。
- `TitleScene`
  - 新遊戲：直接切換到 `ShellScene`。
- `ShellScene`
  - 以 `Router` push 方式開啟 `MapScene`、`InventoryScene`、`WordCardsScene`、`HintsScene`。
  - 以畫面 HUD 顯示 `WorldState` 中的位置／煞氣／陰德。
- `MapScene`
  - 從 `DataRepo` 載入 `anchors.json` 與 `stories.json`。
  - 讓玩家選擇錨點 → `StoryScene` → 完成後更新列表。
- `StoryScene`
  - 讀取指定劇情節點並依 `steps` 執行。
  - 透過 `Router` push 呼叫 `GhostCommScene`，等待 Promise resolve 再繼續。
  - 直接操作 `WorldState` 更新旗標與物品。
- `GhostCommScene`
  - 從 `DataRepo` 讀取靈體與字卡。
  - 呼叫 `AiOrchestrator.genGhostOptions` 取得溝通選項。
  - 完成後回傳解結、煞氣變化與是否需要旁人協助。
- 其他模組（Inventory / WordCards / Hints）
  - 皆由 `ShellScene` 或其他場景以 `Router.push` 開啟並回傳結果。

## Router push/pop 解說
- `Router.push(sceneKey, input)`：
  - 將場景 key 推入堆疊並以 `scene.run` 啟動場景。
  - 傳入的 `input` 會被包裝成 `RouteCtx`，包含 `in`、`resolve`、`reject`。
  - 新場景可呼叫 `this.done(result)` 來觸發 `resolve`，或 `this.cancel(error)` 觸發 `reject`。
- `Router.pop()`：
  - 從堆疊移除最後一個場景並停止它。
  - 雖目前主要以 `ModuleScene.done` 自行收尾，但 `pop` 可用於系統性關閉場景。 

此 push/pop 模式讓每個場景像「子流程」，能以 Promise 等待完成並取得回傳值，便於組合多層互動與資料寫入。 