import type { StoryNode, StoryService } from './Types';

export interface StoryServiceEntry extends StoryService {
  storyId: string;
  anchorId: string;
}

export interface StoryServiceIndex {
  byAnchor: Map<string, StoryServiceEntry>;
  bySpirit: Map<string, StoryServiceEntry>;
}

function isValidTriggerLine(story: StoryNode, triggerLine: number): boolean {
  if (!Number.isInteger(triggerLine) || triggerLine <= 0) {
    return false;
  }
  if (triggerLine > story.steps.length) {
    return false;
  }
  const targetStep = story.steps[triggerLine - 1];
  return typeof targetStep === 'object' && targetStep?.t === 'CALL_GHOST_COMM';
}

export function buildStoryServiceIndex(stories: StoryNode[]): StoryServiceIndex {
  const byAnchor = new Map<string, StoryServiceEntry>();
  const bySpirit = new Map<string, StoryServiceEntry>();

  stories.forEach((story) => {
    const service = story?.service;
    if (!service?.spiritId) {
      return;
    }

    if (!isValidTriggerLine(story, service.triggerLine)) {
      return;
    }

    const step = story.steps[service.triggerLine - 1];
    if (step?.t !== 'CALL_GHOST_COMM' || step.spiritId !== service.spiritId) {
      return;
    }

    const entry: StoryServiceEntry = {
      storyId: story.id,
      anchorId: story.anchor,
      spiritId: service.spiritId,
      triggerLine: service.triggerLine,
    };

    if (!byAnchor.has(entry.anchorId)) {
      byAnchor.set(entry.anchorId, entry);
    }
    if (!bySpirit.has(entry.spiritId)) {
      bySpirit.set(entry.spiritId, entry);
    }
  });

  return { byAnchor, bySpirit };
}
