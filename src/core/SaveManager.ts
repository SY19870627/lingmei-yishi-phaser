import { WorldState } from './WorldState';
export class SaveManager {
  constructor(private world: WorldState){}
  private key(slot:number){ return `lm-save-${slot}`; }
  save(slot=0){ localStorage.setItem(this.key(slot), JSON.stringify(this.world.data)); }
  load(slot=0){ const raw = localStorage.getItem(this.key(slot)); if(!raw) throw new Error("no save"); this.world.data = JSON.parse(raw); }
  exists(slot=0){ return !!localStorage.getItem(this.key(slot)); }
}
