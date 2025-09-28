import type { StoryNode, StoryService } from './Types';

export interface StoryServiceEntry extends StoryService {
  storyId: string;
  anchorId: string;
}

export interface StoryServiceIndex {
  byAnchor: Map<string, StoryServiceEntry>;
  bySpirit: Map<string, StoryServiceEntry>;
}

export function buildStoryServiceIndex(stories: StoryNode[]): StoryServiceIndex {
  const byAnchor = new Map<string, StoryServiceEntry>();
  const bySpirit = new Map<string, StoryServiceEntry>();

  stories.forEach((story) => {
    const service = story?.service;
    if (!service?.spiritId) {
      return;
    }

    const triggerLine = service.triggerLine;
    if (!Number.isInteger(triggerLine) || triggerLine <= 0 || triggerLine > story.steps.length) {
      return;
    }

    const step = story.steps[triggerLine - 1];
    if (!step || typeof step !== 'object') {
      return;
    }

    if (step.t === 'CALL_GHOST_COMM') {
      if (step.spiritId !== service.spiritId) {
        return;
      }
    } else if (step.t === 'CHOICE') {
      const choiceStep = step as Extract<StoryNode['steps'][number], { t: 'CHOICE' }>;
      if (!Array.isArray(choiceStep.options)) {
        return;
      }
      const supportsGhost = choiceStep.options.some((option) => {
        return option.action === 'CALL_GHOST_COMM' && option.spiritId === service.spiritId;
      });
      if (!supportsGhost) {
        return;
      }
    } else {
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
