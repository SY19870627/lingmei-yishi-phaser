import type { GhostOption, Spirit, WordCard, WorldStateData } from './Types';
export class AiOrchestrator {
  mode:"local"|"provider"="local";
  async genGhostOptions(_ctx:{ spirit:Spirit; word:WordCard; world:WorldStateData; }): Promise<{options:GhostOption[]; tone:string;}> {
    // 簡易假資料：視為可跑通流程
    const base: GhostOption[] = [
      { text:"讓我替你把名冊找正好嗎？", type:"指認", targets:["e1"], requires:[], effect:"鬆動", hint:"碼頭管理處" },
      { text:"我帶王嬸的佛珠，她掛念你。", type:"安撫", targets:[], requires:["it_wang_beads"], effect:"平煞" }
    ];
    return { options: base, tone:"受傷但願談" };
  }
}
