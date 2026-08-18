import { describe, expect, it } from 'vitest';
import { getCaseChapterProgress } from '@/lib/stage';
import type { CaseFile } from '@/types/case';

function mockCase(overrides: Partial<CaseFile> = {}): CaseFile {
  return {
    id: 'c1',
    name: '테스트',
    caseNumber: '2026타경1',
    stage: 'F',
    track: 'bidding',
    appraisalValue: 0,
    auctionDate: '',
    bidOutcome: 'won',
    postWinGoals: { loanCompare: true, eviction: false },
    riskFlags: [],
    checklist: [],
    ...overrides,
  };
}

describe('getCaseChapterProgress post-win', () => {
  it('대출만 등록이면 B·C·D·E를 건너뛴다', () => {
    const c = mockCase();
    expect(getCaseChapterProgress(c, 'A')).toBe('완료');
    expect(getCaseChapterProgress(c, 'B')).toBe('건너뜀');
    expect(getCaseChapterProgress(c, 'C')).toBe('건너뜀');
    expect(getCaseChapterProgress(c, 'D')).toBe('건너뜀');
    expect(getCaseChapterProgress(c, 'F')).toBe('진행중');
    expect(getCaseChapterProgress(c, 'E')).toBe('건너뜀');
  });

  it('명도만이면 F를 건너뛰고 E가 진행중이다', () => {
    const c = mockCase({
      stage: 'E',
      postWinGoals: { loanCompare: false, eviction: true },
    });
    expect(getCaseChapterProgress(c, 'F')).toBe('건너뜀');
    expect(getCaseChapterProgress(c, 'E')).toBe('진행중');
  });
});
