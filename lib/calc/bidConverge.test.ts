import { describe, expect, it } from 'vitest';
import { calcBid } from './bidCalculator';
import { convergeBid } from './bidConverge';
import { calcInvestedCapital, calcNetYield } from './bidCalculator';
import { calcNetProfitAfterBusinessTax } from './tradingTax';

describe('convergeBid', () => {
  it('개략 비용률만 쓸 때와 다른 입찰가를 산출한다', () => {
    const flat = calcBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
    });
    const detailed = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
      conditionalExtra: 0,
      buildingVat: 0,
    });
    expect(detailed.bidPrice).not.toBeCloseTo(flat.bidPrice, -3);
    expect(detailed.costAmt).toBeGreaterThan(0);
    expect(detailed.costAmt).not.toBe(detailed.costs.requiredTotal);
  });

  it('조건부 비용만큼 입찰가를 낮춘다', () => {
    const base = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
      conditionalExtra: 0,
      buildingVat: 0,
    });
    const withExtra = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
      conditionalExtra: 5_000_000,
      buildingVat: 0,
      conditionalWon: { repair: 5_000_000 },
    });
    expect(withExtra.bidPrice).toBeLessThan(base.bidPrice);
    const drop = base.bidPrice - withExtra.bidPrice;
    expect(drop).toBeGreaterThan(2_000_000);
    expect(drop).toBeLessThan(3_000_000);
  });

  it('대형이면 농특세 필수 항목을 포함한다', () => {
    const result = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
      conditionalExtra: 300_000,
      buildingVat: 0,
      propertySize: 'large',
      conditionalWon: { farm: 1_000_000, miscOther: 300_000 },
    });
    expect(result.costs.items.some((i) => i.key === 'farm')).toBe(true);
    expect(result.costs.items.find((i) => i.key === 'farm')?.kind).toBe(
      'required',
    );
  });

  it('대형·86㎡에서 농특세를 입찰가×0.2%로 자동 산출한다', () => {
    const result = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
      conditionalExtra: 300_000,
      buildingVat: 0,
      propertySize: 'large',
      exclusiveAreaM2: 86,
      conditionalWon: { miscOther: 300_000 },
    });
    const farm = result.costs.items.find((i) => i.key === 'farm');
    expect(farm?.amount).toBe(Math.round(result.bidPrice * 0.002));
  });

  it('국평 이하면 농특세 항목을 숨긴다', () => {
    const result = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.045,
      margin: 0.055,
      costRate: 0.05,
      conditionalExtra: 300_000,
      buildingVat: 0,
      propertySize: 'standard',
      conditionalWon: { miscOther: 300_000 },
    });
    expect(result.costs.items.some((i) => i.key === 'farm')).toBe(false);
  });

  it('V11 엑셀 E31(580M·16%·5%)과 근사 일치', () => {
    const result = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.05,
      margin: 0.16,
      costRate: 0.05,
      conditionalExtra: 300_000,
      buildingVat: 0,
      propertySize: 'large',
      exclusiveAreaM2: 86,
      conditionalWon: { miscOther: 300_000 },
      housingBond: { customerBurden: 882_940, note: 'excel' },
    });
    expect(result.bidPrice).toBeCloseTo(462_714_558, -3);
  });

  it('건물분 부가세는 입찰가가 아닌 세전·세후수익만 낮춘다', () => {
    const base = convergeBid({
      sellPrice: 511_000_000,
      months: 6,
      loanRate: 0.048,
      margin: 0.1,
      costRate: 0.05,
      conditionalExtra: 0,
      buildingVat: 0,
    });
    const withVat = convergeBid({
      sellPrice: 511_000_000,
      months: 6,
      loanRate: 0.048,
      margin: 0.1,
      costRate: 0.05,
      conditionalExtra: 0,
      buildingVat: 17_524_910,
    });
    expect(withVat.bidPrice).toBeCloseTo(base.bidPrice, -2);
    expect(withVat.profitDetailedTotal).toBeCloseTo(
      base.profitDetailedTotal,
      -2,
    );
    expect(withVat.grossProfit).toBeCloseTo(
      base.grossProfit - 17_524_910,
      0,
    );
    expect(withVat.netProfit).toBeCloseTo(
      calcNetProfitAfterBusinessTax(base.grossProfit - 17_524_910),
      0,
    );
  });

  it('V11 상세비용(E31 입찰가 기준)과 세전수익 검산', () => {
    const result = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.05,
      margin: 0.16,
      costRate: 0.05,
      conditionalExtra: 300_000,
      buildingVat: 0,
      propertySize: 'large',
      exclusiveAreaM2: 86,
      conditionalWon: { miscOther: 300_000 },
      housingBond: { customerBurden: 882_940, note: 'excel' },
    });
    expect(result.profitDetailedTotal).toBeCloseTo(19_822_393, -3);
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
    expect(result.grossProfit).toBeCloseTo(97_463_049, -3);
    expect(result.netProfit).toBeCloseTo(
      result.grossProfit - result.transferTax - result.localIncomeTax,
      0,
    );
    expect(
      result.bidPrice + result.profitDetailedTotal + result.grossProfit,
    ).toBeCloseTo(result.effectiveSellPrice, 0);
  });

  it('실질매도가 − E31 − E31상세비용 (부가세 2,700만)', () => {
    const result = convergeBid({
      sellPrice: 580_000_000,
      months: 6,
      loanRate: 0.05,
      margin: 0.16,
      costRate: 0.05,
      conditionalExtra: 300_000,
      buildingVat: 27_000_000,
      propertySize: 'large',
      exclusiveAreaM2: 86,
      conditionalWon: { miscOther: 300_000 },
      housingBond: { customerBurden: 882_940, note: 'excel' },
    });
    expect(result.effectiveSellPrice).toBe(553_000_000);
    expect(result.profitDetailedTotal).toBeCloseTo(19_822_393, -3);
    expect(result.grossProfit).toBeCloseTo(70_463_049, -3);
    expect(result.netProfit).toBeCloseTo(
      result.grossProfit - result.transferTax - result.localIncomeTax,
      0,
    );
  });
});
