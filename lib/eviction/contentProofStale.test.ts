import { describe, expect, it } from 'vitest';
import { isContentProofStale } from '@/lib/eviction/contentProofStale';
import type {
  ContentProofCompare,
  EvictionCoachCompare,
  EvictionConversationLog,
} from '@/types/case';

describe('isContentProofStale', () => {
  const proof: ContentProofCompare = {
    analyzedAt: '2026-08-18T10:00:00.000Z',
    result: {
      model: 'claude-sonnet-5',
      label: 'AI 내용증명',
      title: 't',
      body: 'b',
      caution: 'c',
    },
  };

  it('코칭 분석이 더 최신이면 stale', () => {
    const coach: EvictionCoachCompare = {
      analyzedAt: '2026-08-18T11:00:00.000Z',
    };
    expect(isContentProofStale(proof, coach, null)).toBe(true);
  });

  it('대화 기록이 더 최신이면 stale', () => {
    const log: EvictionConversationLog = {
      entries: [],
      updatedAt: '2026-08-18T11:00:00.000Z',
    };
    expect(isContentProofStale(proof, null, log)).toBe(true);
  });

  it('초안이 가장 최신이면 유효', () => {
    const coach: EvictionCoachCompare = {
      analyzedAt: '2026-08-18T09:00:00.000Z',
    };
    const log: EvictionConversationLog = {
      entries: [],
      updatedAt: '2026-08-18T09:30:00.000Z',
    };
    expect(isContentProofStale(proof, coach, log)).toBe(false);
  });
});
