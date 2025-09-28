export type Miasma = "清"|"濁"|"沸";
export interface SacredItem { id:string; 名:string; 來源:string; 用途:("安撫"|"請託"|"作證"|"喚醒"|"儀式")[]; 鉤子?:string; }
export interface WordCard { id:string; 字:string; 標籤:("安撫"|"提問"|"交換"|"儀式"|"指認")[]; 備註?:string; }
export interface Obsession { id:string; 名:string; 條件:string[]; 狀態:"未解"|"鬆動"|"已解"; }
export interface Spirit {
  id:string; 名:string; 年代:string; 場域_anchor:string; 初始狀態:"現身"|"失我"; 煞氣:Miasma;
  背景:string; 執念:Obsession[];
  特例?:{ 類型:"失我靈"|"拒談靈"; 關鍵物?:string; 關鍵人物?:string; 拒談觸發?:string; };
  限制?:{ 唯一性鍵:string[]; };
}
export interface Anchor { id:string; 地點:string; 條件:string[]; mapId?:string; 完成後?:{裝飾?:string;回聲腳本?:string;} }
export interface NPC { id:string; 稱呼:string; 性格:string[]; 避雷:string[]; 轉折階段:("抗拒"|"猶豫"|"願試"|"承諾")[]; 可被說動的點:string[]; 到場條件:string[]; }
export interface StoryService { spiritId:string; triggerLine:number; }
export interface StoryNode {
  id:string; anchor:string; service?:StoryService;
  steps:( {t:"TEXT"; who:"旁白"|"亡魂"|"NPC"|"玩家"; text:string; lineId?:string; updates?:string[]}
        | {t:"CALL_GHOST_COMM"; spiritId:string; lineId?:string}
        | {t:"CALL_MEDIATION"; npcId:string; lineId?:string}
        | {t:"GIVE_ITEM"; itemId:string; lineId?:string}
        | {t:"UPDATE_FLAG"; flag:string; value:any; lineId?:string}
        | {t:"END"; lineId?:string}
        | {t:"CHOICE"; lineId?:string; options:(
              {action:"GOTO_LINE"; text:string; targetLineId:string; nextLineId?:string}
            | {action:"START_STORY"; text:string; storyId:string; nextLineId?:string}
            | {action:"CALL_GHOST_COMM"; text:string; spiritId:string; nextLineId?:string}
            | {action:"CALL_MEDIATION"; text:string; npcId:string; nextLineId?:string}
            | {action:"END"; text:string; nextLineId?:string}
          )[] } )[];
}
export interface GhostOption {
  text:string; type:"安撫"|"提問"|"交換"|"儀式"|"指認";
  targets:string[]; requires:string[]; effect:"解結"|"鬆動"|"平煞"|"條件交換"|"觸怒"; hint?:string;
}
export interface WorldStateData {
  位置:string; 煞氣:Miasma; 陰德:"低"|"中"|"高"; 同行:string[]; 物品:string[]; 字卡:string[];
  旗標:Record<string,any>; 已安息靈:string[]; 對話摘要:string[]; 版本:number;
}
export interface MapDef { id:string; image:string; }
