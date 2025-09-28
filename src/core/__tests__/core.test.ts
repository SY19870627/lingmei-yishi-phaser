import { describe, expect, it } from 'vitest';

import { parseCondition } from '../SpawnDirector';
import HintsManager from '../HintsManager';
import { seedFrom } from '../Seed';
import type { Anchor, Spirit, StoryNode } from '../Types';
import type { WorldState } from '../WorldState';

describe('parseCondition', () => {
  it('returns default flag expectation when input is blank', () => {
    expect(parseCondition('   ')).toEqual({ kind: 'flag', key: '', expect: true });
  });

  it('parses item requirements written with 持有 prefix', () => {
    expect(parseCondition('持有: 玉佩')).toEqual({ kind: 'item', key: '玉佩' });
  });

  it('parses expected flag values, including numeric literals', () => {
    expect(parseCondition('旗標:好感=2')).toEqual({ kind: 'flag', key: '好感', expect: 2 });
  });

  it('throws an error when the condition kind is unknown', () => {
    expect(() => parseCondition('其他:內容')).toThrowError(/未知條件/);
  });
});

describe('HintsManager.gather', () => {
  const baseWorld = { data: { 旗標: {} } } as unknown as WorldState;

  it('collects textual hints stored in world flags and trims their contents', () => {
    const world = {
      data: {
        旗標: {
          'hint:ghost': '  找找線索  ',
          'ghost.hint2': '和柳葉有關',
          other: '不相關',
          'ghostHint:empty': '   ',
        },
      },
    } as unknown as WorldState;

    const hints = HintsManager.gather(world, undefined, undefined, undefined);

    expect(hints).toEqual([
      { id: 'ghost.hint2', text: '和柳葉有關', kind: '線索' },
      { id: 'hint:ghost', text: '找找線索', kind: '線索' },
    ]);
  });

  it('produces action hints pointing to key persons when obsession conditions reference them', () => {
    const spirits: Spirit[] = [
      {
        id: 'spirit-1',
        名: '阿靈',
        年代: '清末',
        場域_anchor: 'anchor-1',
        初始狀態: '現身',
        煞氣: '清',
        背景: '故事背景',
        執念: [
          { id: 'obs-1', 名: '心結', 條件: ['關鍵人物:npc_teacher:聊聊'], 狀態: '未解' },
        ],
      },
    ];
    const anchors: Anchor[] = [
      { id: 'anchor-1', 地點: '祠堂', 條件: [] }
    ];
    const stories: StoryNode[] = [
      {
        id: 'story-1',
        anchor: 'anchor-1',
        service: { spiritId: 'spirit-1', triggerLine: 1 },
        steps: [
          { t: 'CALL_GHOST_COMM', spiritId: 'spirit-1' },
          { t: 'END' }
        ]
      }
    ];

    const hints = HintsManager.gather(baseWorld, spirits, anchors, stories);

    expect(hints).toContainEqual({
      id: 'obsession:obs-1',
      text: '去祠堂找這位靈的關鍵人物說「聊聊」。',
      kind: '行動',
    });
  });

  it('marks obsession hints as item-related when the condition implies a required offering', () => {
    const spirits: Spirit[] = [
      {
        id: 'spirit-2',
        名: '林魂',
        年代: '日治',
        場域_anchor: 'anchor-2',
        初始狀態: '現身',
        煞氣: '清',
        背景: '背景資料',
        執念: [
          { id: 'obs-2', 名: '供燈', 條件: ['準備供品'], 狀態: '未解' },
        ],
      },
    ];
    const anchors: Anchor[] = [
      { id: 'anchor-2', 地點: '碼頭', 條件: [] }
    ];
    const stories: StoryNode[] = [
      {
        id: 'story-2',
        anchor: 'anchor-2',
        service: { spiritId: 'spirit-2', triggerLine: 1 },
        steps: [
          { t: 'CALL_GHOST_COMM', spiritId: 'spirit-2' },
          { t: 'END' }
        ]
      }
    ];

    const hints = HintsManager.gather(baseWorld, spirits, anchors, stories);

    expect(hints).toContainEqual({
      id: 'obsession:obs-2',
      text: '去碼頭找找「準備供品」，也許能幫林魂。',
      kind: '物品',
    });
  });
});

describe('seedFrom', () => {
  it('creates deterministic pseudo-random sequences for the same seed source', () => {
    const randomA = seedFrom('儀式種子');
    const randomB = seedFrom('儀式種子');
    const randomC = seedFrom('不同種子');

    const sequenceA = Array.from({ length: 5 }, () => randomA());
    const sequenceB = Array.from({ length: 5 }, () => randomB());
    const sequenceC = Array.from({ length: 5 }, () => randomC());

    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceA).not.toEqual(sequenceC);
  });
});
