import type { Anchor, Spirit, StoryNode, WorldStateData } from './Types';
import { buildStoryServiceIndex, type StoryServiceEntry } from './StoryServices';
import type { WorldState } from './WorldState';

export type ParsedCondition = { kind: 'item' | 'flag'; key: string; expect?: any };
export type DirectedAnchor = Anchor & { meta?: { resolved?: boolean; service?: StoryServiceEntry } };

const DEFAULT_CONDITION: ParsedCondition = { kind: 'flag', key: '', expect: true };

export function parseCondition(raw: string): ParsedCondition {
  const text = raw.trim();
  if (text.length === 0) {
    return DEFAULT_CONDITION;
  }

  const [kindPart, restPart = ''] = text.split(':', 2);
  const kind = kindPart.trim();
  const rest = restPart.trim();

  if (kind === '持有') {
    return { kind: 'item', key: rest };
  }

  if (kind === '旗標') {
    const [keyPart, expectPart] = rest.split('=', 2);
    const key = keyPart.trim();
    if (expectPart === undefined) {
      return { kind: 'flag', key };
    }
    const expect = parseExpectedValue(expectPart.trim());
    return { kind: 'flag', key, expect };
  }

  throw new Error(`未知條件：${raw}`);
}

function parseExpectedValue(value: string): any {
  if (value === '') {
    return true;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class SpawnDirector {
  private accessibleAnchors = new Map<string, DirectedAnchor>();

  listAccessibleAnchors(
    world: WorldState | undefined,
    anchors: Anchor[],
    stories: StoryNode[],
    spirits: Spirit[]
  ): DirectedAnchor[] {
    const data = world?.data;
    this.accessibleAnchors.clear();
    if (!data) {
      return [];
    }

    const serviceIndex = buildStoryServiceIndex(stories);
    const resolvedSpirits = new Set(data.已安息靈 ?? []);
    const result: DirectedAnchor[] = [];

    anchors.forEach((anchor) => {
      const service = serviceIndex.byAnchor.get(anchor.id);
      const serviceSpiritId = service?.spiritId;
      const resolved = serviceSpiritId ? resolvedSpirits.has(serviceSpiritId) : false;
      const meetsConditions = (anchor.條件 ?? []).every((condition) =>
        this.evaluateCondition(data, condition)
      );
      if (!resolved && !meetsConditions) {
        return;
      }

      if (serviceSpiritId && !spirits.some((spirit) => spirit.id === serviceSpiritId)) {
        // Anchor links to a spirit that is not loaded yet.
      }

      const meta: DirectedAnchor['meta'] | undefined =
        resolved || service
          ? {
              ...(resolved ? { resolved: true } : {}),
              ...(service ? { service } : {}),
            }
          : undefined;

      const directedAnchor: DirectedAnchor = meta ? { ...anchor, meta } : { ...anchor };

      result.push(directedAnchor);
      this.accessibleAnchors.set(anchor.id, directedAnchor);
    });

    return result;
  }

  listStartableStories(
    world: WorldState | undefined,
    stories: StoryNode[],
    currentAnchorId: string | undefined
  ): StoryNode[] {
    if (!world || !currentAnchorId) {
      return [];
    }

    const anchor = this.accessibleAnchors.get(currentAnchorId);
    if (!anchor || anchor.meta?.resolved) {
      return [];
    }

    return stories.filter((story) => story.anchor === currentAnchorId && !this.isStoryFinished(world, story));
  }

  private evaluateCondition(data: WorldStateData, condition: string): boolean {
    try {
      const parsed = parseCondition(condition);
      if (parsed.kind === 'item') {
        return data.物品.includes(parsed.key);
      }
      if (parsed.kind === 'flag') {
        const actual = data.旗標?.[parsed.key];
        if (parsed.expect === undefined) {
          return Boolean(actual);
        }
        return actual === parsed.expect;
      }
      return false;
    } catch {
      return false;
    }
  }

  private isStoryFinished(world: WorldState, story: StoryNode): boolean {
    const flagKey = `story:${story.id}`;
    const flags = world.data?.旗標 ?? {};
    return Boolean(flags[flagKey]);
  }
}
