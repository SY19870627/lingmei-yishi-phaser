import { ModuleScene } from '@core/Router';

export default class HintsScene extends ModuleScene<void, void> {
  constructor() {
    super('HintsScene');
  }

  create() {
    this.done?.();
  }
}
