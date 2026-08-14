import { describe, expect, it } from 'vitest';
import { convergeBid } from './bidConverge';
import {
  loanPrincipalAtBid,
  resolveBidPolicy,
  calcAcquisitionTaxAmount,
} from './bidPolicy';

describe('resolveBidPolicy', () => {
  it('미설정 시 무주택 LTV 70%', () => {
    const p = resolveBidPolicy(null, true);
    expect(p.houseCount).toBe(0);
    expect(p.ltvRate).toBeCloseTo(0.7, 5);
    expect(p.usesDefaultPolicy).toBe(true);
  });

  it('수도권 1주택 → LTV 0', () => {
    const p = resolveBidPolicy({
      houseCount: 1,
      sudogwon: true,
      regZone: 'none',
      creditState: '보통',
    });
    expect(p.ltvRate).toBe(0);
    expect(p.loanBadge).toContain('대출금지');
  });

  it('2주택 규제지역 → 취득세 12%', () => {
    const ctx = resolveBidPolicy({
      houseCount: 2,
      regZone: 'adjusted',
      sudogwon: true,
    });
    const tax = calcAcquisitionTaxAmount(500_000_000, {
      houseCount: ctx.houseCount,
      regZone: ctx.regZone,
      lowPriceException: ctx.lowPriceException,
      dispositionPlanned: ctx.dispositionPlanned,
      firstTimeBuyer: ctx.firstTimeBuyer,
    });
    expect(tax.rate).toBe(0.12);
    expect(tax.amount).toBe(60_000_000);
  });
});

describe('convergeBid + bidPolicy', () => {
  const baseParams = {
    sellPrice: 580_000_000,
    months: 6,
    loanRate: 0.05,
    margin: 0.16,
    costRate: 0.05,
    conditionalExtra: 300_000,
    buildingVat: 0,
    propertySize: 'large' as const,
    exclusiveAreaM2: 86,
    conditionalWon: { miscOther: 300_000 },
    housingBond: { customerBurden: 882_940, note: 'excel' },
  };

  it('수도권 1주택 LTV 0 → 이자 0', () => {
    const r = convergeBid({
      ...baseParams,
      entryInputs: {
        houseCount: 1,
        sudogwon: true,
        regZone: 'none',
        creditState: '보통',
      },
    });
    expect(r.ltvApplied).toBe(0);
    expect(r.loanPrincipal).toBe(0);
    expect(r.interestCost).toBe(0);
    expect(r.costs.items.find((i) => i.key === 'interest')?.amount).toBe(0);
  });

  it('2주택 규제 → 무주택 대비 입찰가가 낮다', () => {
    const none = convergeBid({ ...baseParams, entryInputs: { houseCount: 0 } });
    const multi = convergeBid({
      ...baseParams,
      entryInputs: { houseCount: 2, regZone: 'adjusted', sudogwon: true },
    });
    expect(multi.bidPrice).toBeLessThan(none.bidPrice);
    const multiTax = multi.costs.items.find((i) => i.key === 'tax');
    expect(multiTax?.rate).toBe(0.12);
  });

  it('loanPrincipalAtBid — 수도권 절대금액 캡', () => {
    const policy = resolveBidPolicy({ houseCount: 0, sudogwon: true });
    const bid = 2_000_000_000;
    expect(loanPrincipalAtBid(bid, policy)).toBe(400_000_000);
  });
});
