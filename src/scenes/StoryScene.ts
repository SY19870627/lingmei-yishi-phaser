import { ModuleScene } from '@core/Router';

export default class StoryScene extends ModuleScene<{ storyId: string }, { flagsUpdated: string[] }> {
  constructor() {
    super('StoryScene');
  }

  async create() {
    this.done?.({ flagsUpdated: [] });
  }
}
