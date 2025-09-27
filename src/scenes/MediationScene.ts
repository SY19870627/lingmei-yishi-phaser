import { ModuleScene } from '@core/Router';

export default class MediationScene extends ModuleScene<{ npcId: string }, { npcId: string; stage: string; resolved?: string[] }> {
  constructor() {
    super('MediationScene');
  }

  create() {
    this.done?.({ npcId: '', stage: '抗拒', resolved: [] });
  }
}
