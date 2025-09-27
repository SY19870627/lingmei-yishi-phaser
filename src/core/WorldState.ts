import type { WorldStateData } from './Types';
export class WorldState {
  data: WorldStateData = {
    位置: "港邊醫館後巷", 煞氣: "濁", 陰德:"低", 同行:[], 物品:[], 字卡:[],
    旗標: {}, 已安息靈: [], 對話摘要: [], 版本: 1
  };
  setFlag(k:string,v:any){ this.data.旗標[k]=v; }
  hasItem(id:string){ return this.data.物品.includes(id); }
  grantItem(id:string){ if(!this.hasItem(id)) this.data.物品.push(id); }
  snapshot(): WorldStateData { return JSON.parse(JSON.stringify(this.data)) as WorldStateData; }
  loadFrom(data: WorldStateData){ this.data = JSON.parse(JSON.stringify(data)) as WorldStateData; }
}
