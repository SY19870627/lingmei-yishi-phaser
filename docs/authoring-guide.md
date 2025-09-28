# 內容編輯指引

本文件說明如何在資料檔中新增亡魂（Spirit）、場域錨點（Anchor）與劇情段落（Story），並解釋「唯一性鍵」欄位的規範。所有資料均存放於 `assets/data/*.json` 中，可搭配 `docs/data-schemas.md` 與 `schemas/*.schema.json` 確認欄位需求。

## 新增亡魂（Spirit）
1. 打開 `assets/data/spirits.json`，在陣列末端加入新的物件。
2. 參考下列欄位填寫：
   - `id`：全域唯一的英文蛇形命名（例如 `spirit_port_market_bride`）。
   - `名`：亡魂顯示名稱。
   - `年代`：敘述其生前時空背景，盡量避免與既有亡魂重複。
   - `場域_anchor`：指向對應 Anchor 的 `id`，請先規劃或同時建立錨點。
   - `初始狀態`：`"現身"` 或 `"失我"` 等初始互動狀態。
   - `煞氣`：填入 `"清"｜"濁"｜"沸"` 等已定義的煞氣濃度。
   - `背景`：提供約 1～3 句的故事描述，避免與現有亡魂高度雷同（可用 `npm run lint:data` 檢查）。
   - `執念`：至少一筆物件，每筆需含 `id`、`名`、`條件`（陣列）與 `狀態`（預設 `"未解"`）。條件敘述請與遊戲內互動邏輯對應。
   - `特例`：若有特殊互動規則再填寫，並限制在 schema 定義的欄位。
   - `限制`：設定「唯一性鍵」，詳見下節說明。
3. 新增或調整後，執行 `npm run lint:data` 確認資料通過完整性檢查。

## 新增場域錨點（Anchor）
1. 打開 `assets/data/anchors.json`，加入新的 Anchor 物件。
2. 必填欄位說明：
   - `id`：全域唯一，建議格式如 `anchor_<地點描述>`。
   - `地點`：玩家在地圖或 UI 中看到的名稱。
   - `條件`：陣列，列出開啟此錨點所需的旗標或物品，沒有條件可留空陣列。
   - `服務靈`：指向對應亡魂的 `id`。
3. 可選欄位 `完成後` 可描述場景變化：
   - `裝飾`：完成後的視覺或物品變化敘述。
   - `回聲腳本`：完成後播放的音效或敘事提示。
4. Anchor 建議在新增亡魂時一併建立，確保 `場域_anchor` 與 `服務靈` 互相對應。

## 新增劇情段落（Story）
1. 在 `assets/data/stories.json` 陣列中加入新的劇情節點物件。
2. 填寫欄位：
   - `id`：全域唯一，通常以錨點或亡魂為前綴，例如 `story_port_market_01`。
   - `anchor`：指向觸發劇情的 Anchor `id`。
   - `steps`：依序列出劇情步驟，類型需符合 `schemas/story.schema.json` 的定義：
   - `service`：記錄該劇情對應的亡魂（`spiritId`）與觸發行數（`triggerLine`，從 1 開始計算）。若觸發點是一個 `CHOICE` 選項，請將 `triggerLine` 指向該 `CHOICE` 的 `lineId` 所在行序。
     - `TEXT`：一般敘事，需含 `who`（說話者）與 `text`（內容），並必填唯一的 `lineId` 方便跳轉與服務定位，可選 `updates` 記錄旗標變化描述。
     - `CALL_GHOST_COMM`：啟動亡魂交談，需提供 `spiritId`。
     - `CALL_MEDIATION`：呼叫凡人協調，需提供 `npcId`。
     - `GIVE_ITEM`：給予物品，需提供 `itemId` 與可選的 `message` 提示。
     - `UPDATE_FLAG`：直接修改旗標，需提供 `flag` 與 `value`。
     - `CHOICE`：提供多個分支選項，需給每個選項 `text`（顯示文字）與對應動作：
       - `GOTO_LINE`：跳轉到同劇情中指定的 `targetLineId`。
       - `CALL_GHOST_COMM`／`CALL_MEDIATION`：立即進入亡魂談判或調解，完成後會自動跳至 `nextLineId`（若有設定）。
       - `START_STORY`：串接到另一段劇情，通常會立即結束當前故事。
       - `END`：結束當前劇情流程。
       - `nextLineId` 可搭配任一動作用於指定後續銜接的段落。
     - `END`：結束本段劇情。
3. 確保故事內容與亡魂／錨點設定一致，並檢查 `steps` 中引用的 `itemId`、`spiritId`、`npcId` 已存在於對應資料檔。

## 「唯一性鍵」規範
- 欄位位置：每個亡魂物件的 `限制.唯一性鍵`（`string[]`）。若未指定，系統將預設使用 `id` 判斷是否重複。
- 目的：提供自訂的「實質唯一性」判定，避免不同 `id` 卻描述同一亡魂的情況，例如同名、同年代且位於同一錨點。
- 撰寫方式：
  1. 列出能唯一辨識此亡魂的欄位名稱，如 `"名"`、`"年代"`、`"場域_anchor"`。
  2. 欄位必須存在於該亡魂物件中，且組合後能區分與其他亡魂的設定。
  3. 陣列中欄位不可重複，至少需一個欄位。
- 驗證：執行 `npm run lint:data` 時，`scripts/integrity-check.mjs` 會讀取每筆亡魂資料，按照 `唯一性鍵` 組合檢查是否有重複。若偵測到重複，命令會輸出 🔴 錯誤並列出衝突的 `id` 與鍵值。

## 編輯流程建議
1. 先規劃亡魂故事，確定相關 Anchor 與 Story 節點需求。
2. 依序編輯 `spirits.json`、`anchors.json`、`stories.json`，保持 `id` 與引用一致。
3. 編輯完成後執行 `npm run lint:data`，確定無錯誤（重複唯一性鍵、JSON 格式、背景相似度等）。
4. 若有其他資料檔（如 NPC、物品、字卡）相關引用，也請同步更新，以免在遊戲中出現缺漏。
