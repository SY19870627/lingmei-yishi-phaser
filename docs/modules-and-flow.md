# 模組與流程時序

## 流程 A：祖厝劇情主線
1. **BootScene → TitleScene**：
   - `BootScene` 建立共用實例（Router / DataRepo / WorldState / AiOrchestrator / EventBus），並放入 `registry`。
   - 呼叫 `scene.start('TitleScene')`，玩家看到標題畫面。
2. **TitleScene → ShellScene**：
   - 玩家點擊「開始遊戲」後以 `scene.start('ShellScene')` 切換主控台。
3. **ShellScene → MapScene**：
   - `ShellScene` 讀取 `registry` 中的 `WorldState`，HUD 持續顯示位置／煞氣。
   - 玩家點擊「開啟地圖」，`Router.push('MapScene')` 啟動地圖模組並等待 Promise。
4. **MapScene 初始化**：
   - 從 `DataRepo` 載入 `anchors.json`、`stories.json`，並從 `WorldState` 取得目前位置與旗標。
   - 渲染可去地點與可啟動劇情。
5. **選擇故事 → StoryScene**：
   - 玩家選取 `story_wang_01`，`MapScene` 透過 `Router.push('StoryScene', { storyId })` 啟動故事流程。
   - 按鈕停用等待故事 Promise 完成。
6. **StoryScene 執行步驟**：
   - 依 `steps` 逐一處理：
     1. `TEXT`：逐字顯示旁白與亡魂台詞，玩家可點擊跳過剩餘文字後進入下一句。
     2. `SCREEN_EFFECT`：透過 `screenEffects` 對照表觸發淡入、淡出或震動等畫面特效，支援自訂時長與覆蓋色。
     3. `CHOICE`：顯示多個互動選項，可跳轉段落、啟動新劇情或直接呼叫亡魂交談／調解。
     4. `CALL_GHOST_COMM`：以 `Router.push('GhostCommScene', { spiritId })` 呼叫溝通模組，暫停後續步驟直至 Promise resolve。
     5. `CALL_MEDIATION`：若 `GhostCommScene` 回傳 `needPerson` 或故事腳本含 `CALL_MEDIATION`，以 `Router.push('MediationScene', { npcId })` 啟動調解。
     6. `END`：全部步驟完成後呼叫 `done({ flagsUpdated })`，回傳更新的旗標陣列。
7. **GhostCommScene 運行**：
   - 讀取 `spirits.json`、`wordcards.json`、`npcs.json`，建立介面。
   - 玩家挑選字卡時，呼叫 `AiOrchestrator.genGhostOptions({ spirit, word, world })` 取得選項。
   - 若有同行者，也可點選同伴，呼叫 `AiOrchestrator.genCompanionOptions({ spirit, companionId, companionName, world })` 取得對話選項。
   - 套用選項後透過 `done({ resolvedKnots, miasma, needPerson })` 回傳資訊。
8. **MediationScene 運行**：
   - 讀取 `npcs.json`，依 NPC 自訂 `轉折階段` 建立階段流程。
   - 玩家輸入句子，`evaluateMessage` 解析關鍵字，並更新 `currentStage`。
   - 結束時 `done({ npcId, stage, resolved })`，將解決的執念回傳故事。
9. **StoryScene 收尾**：
   - 根據調解結果呼叫 `WorldState.setFlag`，並在特定條件下更新 `已安息靈`。
   - 顯示 Toast 通知後返回 MapScene。
10. **MapScene → ShellScene**：
    - 接收故事回傳的旗標，重新整理可啟動劇情列表與提示。
    - 離開地圖與返回 ShellScene 時會使用黑場淡出／淡入過場，保持場景切換的連續感。
    - 玩家關閉地圖，`MapScene.done()`，Promise resolve 後控制權回到 `ShellScene`，完成一輪主線時序。

## 流程 B：資訊／資源輔助迴圈
1. **ShellScene → InventoryScene**：
   - 玩家點擊「物品」，以 `Router.push('InventoryScene')` 進入清單。
   - `InventoryScene` 透過 `DataRepo.get('items')` 載入物品資料，提供點擊選擇。
   - 點擊「關閉並回傳」時執行 `done(selectedItemId ?? null)`，Promise resolve 後 `ShellScene` 更新 HUD。
2. **ShellScene → WordCardsScene**：
   - 玩家點擊「字卡」，以 `Router.push('WordCardsScene')` 打開。
   - 場景載入 `wordcards.json`，顯示標籤與備註；無回傳值但結束時觸發 Promise resolve，回到 `ShellScene`。
3. **ShellScene → HintsScene**：
   - 玩家點擊「提示」，啟動 `HintsScene` 顯示 `WorldState.data.旗標`。
   - 閱讀完畢關閉，回到 `ShellScene`。
4. **跨模組資料互動**：
   - `InventoryScene` 選取的物品 id、`GhostCommScene` 產生的需求、`HintsScene` 展示的旗標皆寫入 `WorldState`。
   - 玩家可重複循環以上模組，蒐集資訊 → 回到地圖／劇情 → 再次調整物品與提示，支援主線決策。

## 資料上線流程
1. 本地更新資料後執行 `npm run lint:data` 確認無紅燈。
2. 驗證通過再送出 Pull Request，並附上檢查結果。
