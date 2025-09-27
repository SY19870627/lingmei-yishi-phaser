# Prompts 與 AI 介面

## GhostOption 互動格式
`AiOrchestrator.genGhostOptions` 接收靈體、字卡與當前世界狀態後回傳選項與語氣。

### 輸入範例
```json
{
  "spirit": {
    "id": "spirit_wang_ayi",
    "名": "王阿姨",
    "年代": "民國三十五年前後",
    "場域_anchor": "anchor_zu_cuo_hall",
    "初始狀態": "現身",
    "煞氣": "濁",
    "背景": "婚後長年忍受，過世後丈夫以塑膠供品祭拜。",
    "執念": [
      {"id": "e_offering", "名": "別再用塑膠假食物", "條件": ["關鍵人物:npc_wang_shushu承諾真供品"], "狀態": "未解"},
      {"id": "e_apology", "名": "想聽一聲真心致意", "條件": ["npc_wang_shushu說出道歉並行動"], "狀態": "未解"}
    ]
  },
  "word": {
    "id": "w_offering",
    "字": "供品",
    "標籤": ["指認", "交換"]
  },
  "world": {
    "位置": "王家祖厝廳堂",
    "煞氣": "濁",
    "陰德": "低",
    "同行": [],
    "物品": ["it_wang_beads"],
    "字卡": ["w_name", "w_offering"],
    "旗標": {},
    "已安息靈": [],
    "對話摘要": [],
    "版本": 1
  }
}
```

### 輸出範例
```json
{
  "options": [
    {
      "text": "讓我替你把名冊找正好嗎？",
      "type": "指認",
      "targets": ["e_offering"],
      "requires": [],
      "effect": "鬆動",
      "hint": "碼頭管理處"
    },
    {
      "text": "我帶王嬸的佛珠，她掛念你。",
      "type": "安撫",
      "targets": [],
      "requires": ["it_wang_beads"],
      "effect": "平煞"
    }
  ],
  "tone": "受傷但願談"
}
```

## Mediation 互動格式
`StoryScene` 以 `Router.push('MediationScene', { npcId })` 呼叫調解模組，場景關閉時回傳結果。

### 輸入範例
```json
{
  "npcId": "npc_wang_shushu"
}
```

### 輸出範例
```json
{
  "npcId": "npc_wang_shushu",
  "stage": "承諾",
  "resolved": ["e_offering", "e_apology"]
}
```

`stage` 為 NPC 最終所處的轉折階段，`resolved` 為成功解決的執念 id；`StoryScene` 會據此更新 `WorldState` 旗標與靈體狀態。

## 可重現性
本機 `AiOrchestrator` 會依據 `contextSeed` 產生亂數來源，讓同一輪溝通在重讀存檔後仍能得到一致的選項排序與措辭。`contextSeed` 由下列資訊串接而成：

- `spiritId`
- 當前溝通步驟（`ghost.step:<spiritId>` 旗標記錄的整數）
- 與該靈體相關的旗標快照（`spirit.<id>.state` 以及 `obsession:<id>` 等鍵，以穩定順序 JSON 序列化）

任何影響關鍵旗標的變化都會導致新的種子，使後續輪次的選項變化得以體現；若世界狀態未變，則相同種子將重現同樣的列表與語氣。
