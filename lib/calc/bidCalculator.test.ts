import { describe, expect, it } from 'vitest';
import { calcBid, marginLabelText } from './bidCalculator';
import { calcCostItems, brokerFeeRate } from './costItems';
import { rankLoanOffers } from './loanCompare';

describe('calcBid', () => {
  it('목업 기본값과 근접한 입찰가', () => {
    const result = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
    });
    // 580M - 5% - 5.5% = 580M * 0.895 = 519.1M ... wait
    // bid = sell - sell*cost - sell*margin = sell*(1-0.05-0.055) = 580M*0.895
    expect(result.bidPrice).toBeCloseTo(580_000_000 * 0.895, -2);
    expect(result.grossProfit).toBeCloseTo(580_000_000 * 0.055, -2);
    expect(result.netYield).toBeGreaterThan(0);
  });

  it('조건부 비용만큼 입찰가를 낮춘다', () => {
    const base = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
    });
    const withExtra = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
      conditionalExtra: 5_000_000,
    });
    expect(withExtra.bidPrice).toBe(base.bidPrice - 5_000_000);
    expect(withExtra.interestCost).toBeLessThan(base.interestCost);
  });
});

describe('marginLabelText', () => {
  it('구간 라벨', () => {
    expect(marginLabelText(3)).toBe('저마진');
    expect(marginLabelText(5.5)).toBe('중마진');
    expect(marginLabelText(10)).toBe('고마진');
  });
});

describe('brokerFeeRate / calcCostItems', () => {
  it('9억 미만 0.4%', () => {
    expect(brokerFeeRate(580_000_000)).toBe(0.004);
  });

  it('필수 항목 합계가 양수', () => {
    const bid = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
    });
    const costs = calcCostItems(
      bid.bidPrice,
      580_000_000,
      bid.interestCost,
      bid.loanPrincipal,
      6,
      0.045,
      0.05,
    );
    expect(costs.items).toHaveLength(13);
    expect(costs.requiredTotal).toBeGreaterThan(10_000_000);
  });
});

describe('rankLoanOffers', () => {
  it('세후수익 내림차순 + 최적 배지', () => {
    const bid = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
    });
    const ranked = rankLoanOffers(
      [
        {
          id: '1',
          name: 'A',
          ltv: 0.75,
          rate: 0.046,
          prepayRate: 0.0048,
          prepayPeriod: 36,
        },
        {
          id: '2',
          name: 'B',
          ltv: 0.9,
          rate: 0.052,
          prepayRate: 0.01,
          prepayPeriod: 36,
        },
      ],
      bid.bidPrice,
      bid.grossProfit,
      6,
    );
    expect(ranked[0].isBest).toBe(true);
    expect(ranked[0].netProfit).toBeGreaterThanOrEqual(ranked[1].netProfit);
  });
});
