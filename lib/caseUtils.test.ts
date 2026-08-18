import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseFile, PostWinGoals } from '@/types/case';
import {
  caseBadgeLabel,
  getNextAction,
  groupCases,
  isArchivedCase,
  isPostWinCase,
} from '@/lib/caseUtils';

function mockCase(overrides: Partial<CaseFile> = {}): CaseFile {
  return {
    id: 'c1',
    name: '테스트',
    caseNumber: '2026타경1',
    stage: 'A',
    track: 'bidding',
    appraisalValue: 0,
    auctionDate: '',
    riskFlags: [],
    checklist: [],
    ...overrides,
  };
}

describe('groupCases / post-win', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00+09:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('지난 매각일의 pending 사건은 종료로 보낸다', () => {
    const c = mockCase({ id: 'past', auctionDate: '2026-08-01' });
    expect(isArchivedCase(c)).toBe(true);
    expect(groupCases([c]).archived.map((x) => x.id)).toEqual(['past']);
    expect(groupCases([c]).reviewing).toHaveLength(0);
  });

  it('낙찰 사건은 매각일이 지나도 검토 중이 아니라 낙찰 후다', () => {
    const c = mockCase({
      id: 'won',
      auctionDate: '2026-08-01',
      bidOutcome: 'won',
      stage: 'F',
      postWinGoals: { loanCompare: true, eviction: false },
    });
    expect(isPostWinCase(c)).toBe(true);
    expect(isArchivedCase(c)).toBe(false);
    const g = groupCases([c]);
    expect(g.postWin.map((x) => x.id)).toEqual(['won']);
    expect(g.reviewing).toHaveLength(0);
    expect(g.thisWeek).toHaveLength(0);
  });

  it('앞으로 8일 이후 입찰 전 사건은 입찰 준비(reviewing)다', () => {
    const c = mockCase({ id: 'prep', auctionDate: '2026-09-10' });
    const g = groupCases([c]);
    expect(g.reviewing.map((x) => x.id)).toEqual(['prep']);
    expect(g.thisWeek).toHaveLength(0);
  });

  it('이번 주 입찰과 명도 전용은 기존 구간에 남는다', () => {
    const week = mockCase({ id: 'week', auctionDate: '2026-08-22' });
    const eviction = mockCase({
      id: 'ev',
      track: 'eviction',
      stage: 'E',
      bidOutcome: 'won',
    });
    const g = groupCases([week, eviction]);
    expect(g.thisWeek.map((x) => x.id)).toEqual(['week']);
    expect(g.eviction.map((x) => x.id)).toEqual(['ev']);
  });
});

describe('getNextAction post-win', () => {
  it('대출만이면 대출상품 비교로 보낸다', () => {
    const goals: PostWinGoals = { loanCompare: true, eviction: false };
    const next = getNextAction(
      mockCase({ bidOutcome: 'won', stage: 'F', postWinGoals: goals }),
    );
    expect(next).toEqual({ href: '/f', label: '대출상품 비교' });
  });

  it('명도만이면 명도 코칭으로 보낸다', () => {
    const next = getNextAction(
      mockCase({
        bidOutcome: 'won',
        stage: 'E',
        postWinGoals: { loanCompare: false, eviction: true },
      }),
    );
    expect(next).toEqual({ href: '/e', label: '명도 코칭' });
  });

  it('둘 다이면 제5장 먼저, stage E면 명도', () => {
    const goals: PostWinGoals = { loanCompare: true, eviction: true };
    expect(
      getNextAction(mockCase({ bidOutcome: 'won', stage: 'F', postWinGoals: goals })),
    ).toEqual({ href: '/f', label: '대출상품 비교' });
    expect(
      getNextAction(mockCase({ bidOutcome: 'won', stage: 'E', postWinGoals: goals })),
    ).toEqual({ href: '/e', label: '명도 코칭' });
  });
});

describe('caseBadgeLabel', () => {
  it('낙찰 후 목적에 따라 배지를 나눈다', () => {
    expect(
      caseBadgeLabel(
        mockCase({
          bidOutcome: 'won',
          postWinGoals: { loanCompare: true, eviction: true },
        }),
      ),
    ).toBe('낙찰 · 대출·명도');
    expect(
      caseBadgeLabel(
        mockCase({
          bidOutcome: 'won',
          postWinGoals: { loanCompare: true, eviction: false },
        }),
      ),
    ).toBe('낙찰 · 대출');
  });
});
