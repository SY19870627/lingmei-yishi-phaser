import type { WorldState } from './WorldState';

export type GhostState =
  | '未現身'
  | '現身'
  | '失我'
  | '溝通中'
  | '拒談'
  | '沉默'
  | '安息'
  | '回聲';

export class GhostDirector {
  private static readonly STATE_FLAG_PREFIX = 'spirit.';
  private static readonly STATE_FLAG_SUFFIX = '.state';

  static getStateFlagKey(spiritId: string): string {
    return `${this.STATE_FLAG_PREFIX}${spiritId}${this.STATE_FLAG_SUFFIX}`;
  }

  static getState(spiritId: string, world: WorldState | undefined): GhostState {
    if (!spiritId) {
      return '未現身';
    }

    const data = world?.data;
    if (!data) {
      return '未現身';
    }

    if (data.已安息靈?.includes(spiritId)) {
      return '安息';
    }

    const flagKey = this.getStateFlagKey(spiritId);
    const rawState = data.旗標?.[flagKey];
    if (typeof rawState === 'string' && this.isGhostState(rawState)) {
      return rawState;
    }

    return '未現身';
  }

  static setState(spiritId: string, state: GhostState, world: WorldState | undefined): void {
    if (!world || !spiritId) {
      return;
    }
    const flagKey = this.getStateFlagKey(spiritId);
    world.setFlag(flagKey, state);
  }

  static markResolved(spiritId: string, world: WorldState | undefined): void {
    if (!world || !spiritId) {
      return;
    }
    const data = world.data;
    if (!data.已安息靈.includes(spiritId)) {
      data.已安息靈.push(spiritId);
    }
    this.setState(spiritId, '安息', world);
  }

  private static isGhostState(value: string): value is GhostState {
    switch (value) {
      case '未現身':
      case '現身':
      case '失我':
      case '溝通中':
      case '拒談':
      case '沉默':
      case '安息':
      case '回聲':
        return true;
      default:
        return false;
    }
  }
}
