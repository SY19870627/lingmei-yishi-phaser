import { ModuleScene } from '@core/Router';

export default class GhostCommScene extends ModuleScene<{ spiritId: string }, { resolvedKnots: string[] }> {
  constructor() {
    super('GhostCommScene');
  }

  create() {
    this.done?.({ resolvedKnots: [] });
  }
}
