import { describe, expect, it } from 'vitest';
import { loanCompareBidFromCase } from '@/lib/calc/bidFromCase';
import type { CaseFile } from '@/types/case';

function stubCase(
  bidCalcInputs: NonNullable<CaseFile['bidCalcInputs']>,
): CaseFile {
  return {
    id: 'c1',
    name: '테스트',
    caseNumber: '2026타경1',
    stage: 'D',
    track: 'bidding',
    appraisalValue: 0,
    auctionDate: '',
    riskFlags: [],
    checklist: [],
    bidCalcInputs,
  };
}

describe('loanCompareBidFromCase', () => {
  it('제4장에서 저장한 입찰가 스냅샷을 그대로 쓴다', () => {
    const basis = loanCompareBidFromCase(
      stubCase({
        sellPrice: 580_000_000,
        months: 6,
        loanRate: 5,
        margin: 10,
        bidPrice: 412_345_678,
        effectiveSellPrice: 580_000_000,
        financeFreeDetailed: 12_000_000,
      }),
    );
    expect(basis?.bidPrice).toBe(412_345_678);
    expect(basis?.effectiveSellPrice).toBe(580_000_000);
    expect(basis?.financeFreeDetailed).toBe(12_000_000);
  });

  it('낙찰 후 등록은 낙찰가를 대출비교 기준으로 쓴다', () => {
    const basis = loanCompareBidFromCase({
      ...stubCase({
        sellPrice: 0,
        months: 6,
        loanRate: 5,
        margin: 10,
        bidPrice: 400_000_000,
      }),
      winningBidWon: 400_000_000,
      bidOutcome: 'won',
      postWinGoals: { loanCompare: true, eviction: false },
    });
    expect(basis?.bidPrice).toBe(400_000_000);
    expect(basis?.sellPrice).toBe(0);
    expect(basis?.effectiveSellPrice).toBe(400_000_000);
  });
});
