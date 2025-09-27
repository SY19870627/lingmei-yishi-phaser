# 架構概覽

## 場景關係圖（文字）
- **BootScene** → 建立 Router、資料倉庫、世界狀態、儲存管理與 AI，接著 `start(TitleScene)`。
- **TitleScene** → 新遊戲：`start(ShellScene)`；讀檔：保留為日後擴充。
- **ShellScene** → 透過註冊的 Router `push()` 以下模組：Map / Inventory / WordCards / Hints。
- **MapScene** → `push(StoryScene)` 播放劇情；劇情結束後由 StoryScene `done()` 返回。
- **StoryScene** → 依據步驟呼叫：
  - `push(GhostCommScene)` 進行靈體溝通。
  - `push(MediationScene)` 進行 NPC 調解（可能由靈體溝通回傳的 needPerson 觸發）。
  劇情完成時 `done({ flagsUpdated })` 以便上層更新。
- **GhostCommScene** → 讀取資料後由 AI 回傳溝通選項，結束時回傳解結結果與調解需求。
- **MediationScene** → 根據玩家輸入更新 NPC 階段並回傳已解決的執念。
- **InventoryScene** / **WordCardsScene** / **HintsScene** → 各自載入資料並在 `done()` 後回到 ShellScene。

## Router push/pop 解說

- `Router.push(sceneKey, input)`：
  - 將 `sceneKey` 推入堆疊並 `run` 對應 Scene。
  - Scene 會在 `init()` 時取得 `RouteCtx`（含 `in`、`resolve`、`reject`）。
  - 子 Scene 呼叫 `this.done(result)` 以 `resolve` Promise，或 `this.cancel(error)` 以 `reject`。
- `Router.pop()`：
  - 由需要主動結束的模組呼叫，會停止堆疊頂端 Scene。
- `ModuleScene`：提供 `done()` / `cancel()` 包裝，確保在完成或取消時關閉自身 Scene。
- 因為 push 傳回 Promise，父場景可以使用 `await router.push(...)` 在流程上串接結果（例如 StoryScene 依靈體溝通結果決定是否啟動 MediationScene）。

## 其他核心元件

- **DataRepo**：集中管理 `/assets/data/*.json` 的載入與快取。
- **WorldState**：保存位置、煞氣、旗標、已安息靈等狀態並提供更新方法。
- **SaveManager**：包裝世界資料的存讀，對應 `localStorage` 槽位。
- **AiOrchestrator**：提供 `genGhostOptions`，未來可串接實際 AI 服務。
