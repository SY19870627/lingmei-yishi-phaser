# 模組流程

## 流程 A：地圖探索與劇情互動
1. **ShellScene** 顯示世界狀態。玩家點擊「開啟地圖」。
2. `router.push('MapScene')` 開啟 **MapScene**，讀取 `anchors.json` 與 `stories.json`，根據當前 `WorldState.data.位置` 標示地點。
3. 玩家挑選地點：
   - 若目的地與現有位置不同且 `canEnterLocation()` 通過，更新 `WorldState.data.位置`，刷新可用劇情。
4. 玩家點擊可啟動的劇情節點，MapScene 以 `await router.push('StoryScene', { storyId })` 呼叫 **StoryScene**。
5. **StoryScene** 依序處理故事步驟：
   - `TEXT`：顯示旁白或角色台詞，等待點擊繼續。
   - `GIVE_ITEM`：調用 `world.grantItem()`，顯示取得提示。
   - `UPDATE_FLAG`：透過 `world.setFlag()` 記錄旗標並加入 `flagsUpdated`。
   - `CALL_GHOST_COMM`：使用 `router.push('GhostCommScene')` 進入靈體溝通。
6. **GhostCommScene**：
   - 讀取 `spirits.json` 與 `wordcards.json`，顯示字卡列表。
   - 玩家點選字卡後，呼叫 `AiOrchestrator.genGhostOptions()` 取得選項。
   - 玩家執行選項後以 `this.done({ resolvedKnots, miasma, needPerson })` 返回 StoryScene。
7. StoryScene 根據靈體結果：
   - 顯示回饋訊息。
   - 若 `needPerson` 存在，設定 `skipNextMediationStep = true` 並立即 `await runMediation(needPerson)`。
8. `runMediation()` 透過 `router.push('MediationScene', { npcId })` 進入 **MediationScene**。
9. **MediationScene**：
   - 讀取 `npcs.json`，顯示調解階段與輸入區。
   - 玩家輸入說服語，系統根據關鍵字升階並紀錄 `resolved` 陣列。
   - 結束時 `this.done({ npcId, stage, resolved })` 回傳。
10. StoryScene 依 `resolved` 更新 `world.data.旗標` 與 `已安息靈`，顯示提示並回到劇情流程。
11. 劇情遇到 `END` 或步驟耗盡時呼叫 `this.done({ flagsUpdated })`，MapScene 收到後恢復互動並顯示訊息。
12. 玩家可關閉 MapScene 返回 ShellScene，流程 A 完成。

## 流程 B：支援模組查詢與回傳
1. 玩家於 **ShellScene** 任意時刻選擇：
   - `router.push('InventoryScene')`
   - `router.push('WordCardsScene')`
   - `router.push('HintsScene')`
2. **InventoryScene**：
   - 透過 `DataRepo.get('items')` 取得物品列表。
   - 玩家選中某項後按「關閉並回傳…」，以 `this.done(selectedItemId ?? null)` 返回 ShellScene，ShellScene 更新選擇標籤。
3. **WordCardsScene**：
   - 讀取 `wordcards.json`，以清單呈現字卡與標籤。
   - 點擊字卡時在底部顯示備註，按「關閉」後 `this.done()` 返回 ShellScene。
4. **HintsScene**：
   - 讀取 `strings.json` 取得標題，並從 `WorldState.data.旗標` 列出可行方向。
   - 使用者閱讀後按「關閉」，Scene 以 `this.done()` 結束。
5. 所有支援模組都不改變 Router 堆疊順序，完成後回到 ShellScene 的主迴圈，允許玩家再次開啟地圖或其他模組。
