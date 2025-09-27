import type { Anchor, Spirit } from './Types';
import type { WorldState } from './WorldState';

export type HintKind = '線索' | '行動' | '物品';

export type HintEntry = {
  id: string;
  text: string;
  kind: HintKind;
};

export class HintsManager {
  static gather(
    world: WorldState | undefined,
    spirits: Spirit[] | undefined,
    anchors: Anchor[] | undefined
  ): HintEntry[] {
    const results: HintEntry[] = [];
    const seen = new Set<string>();

    const worldFlags = world?.data?.旗標 ?? {};
    this.collectGhostHints(worldFlags, results, seen);

    const spiritList = Array.isArray(spirits) ? spirits : [];
    const anchorList = Array.isArray(anchors) ? anchors : [];

    spiritList.forEach((spirit) => {
      const relatedAnchor = anchorList.find((anchor) => anchor.服務靈 === spirit.id);
      const location = relatedAnchor?.地點 ?? '相關地點';

      spirit.執念?.forEach((obsession) => {
        if (!obsession?.id) {
          return;
        }

        const obsessionKey = `obsession:${obsession.id}`;
        if (worldFlags[obsessionKey] === '已解' || obsession.狀態 === '已解') {
          return;
        }

        if (seen.has(obsessionKey)) {
          return;
        }

        const primaryCondition = Array.isArray(obsession.條件) ? obsession.條件[0] ?? '' : '';
        const entry = this.buildObsessionHint(spirit.名 ?? spirit.id, location, obsession.名 ?? obsession.id, primaryCondition);

        results.push({ id: obsessionKey, ...entry });
        seen.add(obsessionKey);
      });
    });

    const kindOrder: Record<HintKind, number> = { 線索: 0, 行動: 1, 物品: 2 };

    return results.sort((a, b) => {
      const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
      if (kindDiff !== 0) {
        return kindDiff;
      }
      return a.id.localeCompare(b.id);
    });
  }

  private static collectGhostHints(
    flags: Record<string, unknown>,
    results: HintEntry[],
    seen: Set<string>
  ) {
    Object.entries(flags).forEach(([key, value]) => {
      if (seen.has(key) || typeof value !== 'string') {
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      if (this.isHintFlagKey(key)) {
        results.push({ id: key, text: trimmed, kind: '線索' });
        seen.add(key);
      }
    });
  }

  private static isHintFlagKey(key: string): boolean {
    return (
      key.startsWith('hint:') ||
      key.startsWith('ghost.hint') ||
      key.startsWith('ghostHint:') ||
      key.includes('.hint')
    );
  }

  private static buildObsessionHint(
    spiritName: string,
    location: string,
    obsessionName: string,
    conditionRaw: string
  ): Omit<HintEntry, 'id'> {
    const condition = conditionRaw?.trim() ?? '';

    const personInfo = this.extractPersonCondition(condition);
    if (personInfo) {
      const { actionText } = personInfo;
      const action = actionText || `談談「${obsessionName}」`;
      const text = `去${location}找這位靈的關鍵人物說「${action}」。`;
      return { text, kind: '行動' };
    }

    const target = this.extractTargetFromCondition(condition) || obsessionName;
    const kind: HintKind = this.isItemRelated(condition, obsessionName) ? '物品' : '行動';
    const text = `去${location}找找「${target}」，也許能幫${spiritName}。`;
    return { text, kind };
  }

  private static extractPersonCondition(condition: string): { actionText: string } | undefined {
    if (!condition) {
      return undefined;
    }

    const directMatch = condition.match(/^關鍵人物:[^\s:：]+[:：]?(.+)?$/);
    if (directMatch) {
      return { actionText: (directMatch[1] ?? '').trim() };
    }

    if (condition.includes('npc_')) {
      const parts = condition.split(/npc_[^\s:：]+/);
      const action = parts.pop()?.trim();
      return { actionText: action ?? '' };
    }

    return undefined;
  }

  private static extractTargetFromCondition(condition: string): string {
    if (!condition) {
      return '';
    }

    const match = condition.match(/[:：](.+)$/);
    if (match) {
      return match[1].trim();
    }

    return condition.trim();
  }

  private static isItemRelated(condition: string, obsessionName: string): boolean {
    const keywords = ['供品', '燈', '燈芯', '香', '飯', '祭', '物', '井'];
    return keywords.some((keyword) => condition.includes(keyword) || obsessionName.includes(keyword));
  }
}

export default HintsManager;
