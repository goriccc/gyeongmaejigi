import { describe, expect, it } from 'vitest';
import {
  calcBid,
  calcInvestedCapital,
  calcNetYield,
  marginLabelText,
  marginTier,
  marginTierClass,
  resolveBidLoanRate,
  resolveBidMargin,
  yieldLabelText,
  yieldTier,
  yieldTierClass,
} from './bidCalculator';
import { calcCostItems, brokerFeeRate } from './costItems';
import { rankLoanOffers } from './loanCompare';
import {
  calcNetProfitAfterBusinessTax,
  calcTradingBusinessTransferTax,
} from './tradingTax';

describe('calcBid', () => {
  it('목업 기본값과 근접한 입찰가', () => {
    const result = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
    });
    expect(result.bidPrice).toBeCloseTo(580_000_000 * (1 - 0.055), -2);
    expect(result.grossProfit).toBeGreaterThan(0);
    expect(result.transferTax).toBeCloseTo(
      calcTradingBusinessTransferTax(result.grossProfit),
      0,
    );
    expect(result.netProfit).toBeCloseTo(
      result.grossProfit - result.transferTax - result.localIncomeTax,
      0,
    );
    expect(result.invested).toBeCloseTo(
      calcInvestedCapital(
        result.bidPrice,
        result.loanPrincipal,
        result.profitDetailedTotal,
      ),
      0,
    );
    expect(result.netYield).toBeCloseTo(
      calcNetYield(result.netProfit, result.invested),
      1,
    );
    expect(result.netYield).toBeGreaterThan(0);
  });

  it('조건부 비용만큼 입찰가를 낮춘다', () => {
    const base = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
    });
    const withExtra = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      conditionalExtra: 5_000_000,
    });
    expect(withExtra.bidPrice).toBe(base.bidPrice - 5_000_000);
    expect(withExtra.interestCost).toBeLessThan(base.interestCost);
  });

  it('건물분 부가세만큼 세후수익을 낮춘다', () => {
    const base = calcBid({
      sellPrice: 511_000_000,
      months: 6,
      loanRate: 0.048,
      margin: 0.1,
    });
    const withVat = calcBid({
      sellPrice: 511_000_000,
      months: 6,
      loanRate: 0.048,
      margin: 0.1,
      buildingVat: 17_524_910,
    });
    expect(withVat.bidPrice).toBe(base.bidPrice);
    expect(withVat.profitDetailedTotal).toBeCloseTo(base.profitDetailedTotal, -2);
    expect(withVat.grossProfit).toBeCloseTo(
      base.grossProfit - 17_524_910,
      0,
    );
    expect(withVat.netProfit).toBeCloseTo(
      calcNetProfitAfterBusinessTax(base.grossProfit - 17_524_910),
      0,
    );
    expect(withVat.effectiveSellPrice).toBeCloseTo(
      511_000_000 - 17_524_910,
      0,
    );
  });
});

describe('marginLabelText', () => {
  it('구간 라벨', () => {
    expect(marginLabelText(5)).toBe('저마진');
    expect(marginLabelText(8)).toBe('저마진');
    expect(marginLabelText(8.5)).toBe('중마진');
    expect(marginLabelText(12)).toBe('중마진');
    expect(marginLabelText(12.5)).toBe('고마진');
  });
});

describe('marginTier', () => {
  it('구간·CSS 클래스', () => {
    expect(marginTier(8)).toBe('low');
    expect(marginTier(8.5)).toBe('mid');
    expect(marginTier(12.5)).toBe('high');
    expect(marginTierClass(10)).toBe('margin-tier-mid');
  });
});

describe('yieldTier', () => {
  it('실투자금 대비 수익률 구간', () => {
    expect(yieldTier(12)).toBe('low');
    expect(yieldTier(12.5)).toBe('mid');
    expect(yieldTier(20)).toBe('mid');
    expect(yieldTier(21)).toBe('mid');
    expect(yieldTier(21.5)).toBe('high');
    expect(yieldTierClass(15)).toBe('margin-tier-mid');
    expect(yieldLabelText(12)).toBe('저마진');
    expect(yieldLabelText(15)).toBe('중마진');
    expect(yieldLabelText(21)).toBe('중마진');
    expect(yieldLabelText(22)).toBe('고마진');
  });
});

describe('resolveBidLoanRate / resolveBidMargin', () => {
  it('기본값·레거시 마이그레이션', () => {
    expect(resolveBidLoanRate()).toBe(5);
    expect(resolveBidLoanRate(4.5)).toBe(5);
    expect(resolveBidLoanRate(4.8)).toBe(4.8);
    expect(resolveBidMargin()).toBe(10);
    expect(resolveBidMargin(5.5)).toBe(10);
    expect(resolveBidMargin(8)).toBe(8);
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
    });
    const costs = calcCostItems(
      bid.bidPrice,
      580_000_000,
      bid.interestCost,
      bid.loanPrincipal,
      6,
      0.045,
    );
    expect(costs.items).toHaveLength(13);
    expect(costs.requiredTotal).toBeGreaterThan(10_000_000);
  });

  it('대형 건물분 부가세 항목 추가', () => {
    const costs = calcCostItems(
      400_000_000,
      511_000_000,
      10_000_000,
      240_000_000,
      6,
      0.048,
      undefined,
      undefined,
      {},
      null,
      {},
      17_524_910,
    );
    expect(costs.items).toHaveLength(14);
    expect(costs.items.some((i) => i.key === 'buildingVat')).toBe(true);
  });
});

describe('rankLoanOffers', () => {
  it('세후수익 내림차순 + 최적 배지', () => {
    const bid = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
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
      bid.effectiveSellPrice,
      bid.financeFreeDetailed,
      6,
    );
    expect(ranked[0].isBest).toBe(true);
    expect(ranked[0].netProfit).toBeGreaterThanOrEqual(ranked[1].netProfit);
  });
});
