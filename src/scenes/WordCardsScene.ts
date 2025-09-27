import { ModuleScene } from '@core/Router';

export default class WordCardsScene extends ModuleScene<void, void> {
  constructor() {
    super('WordCardsScene');
  }

  create() {
    this.done?.();
  }
}
