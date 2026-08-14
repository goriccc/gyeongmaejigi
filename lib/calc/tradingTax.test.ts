import { describe, expect, it } from 'vitest';
import {
  calcLocalIncomeTaxOnTransferTax,
  calcNetProfitAfterBusinessTax,
  calcNetProfitAfterTransferTax,
  calcPreTaxProfit,
  calcTradingBusinessTransferTax,
  formatTradingBusinessTransferTaxMeta,
} from './tradingTax';

describe('tradingTax', () => {
  it('세전수익 = 실질매도가 − 입찰가 − 상세비용', () => {
    expect(calcPreTaxProfit(580_000_000, 462_714_558, 19_822_393)).toBe(
      97_463_049,
    );
  });

  it('구간 경계에서 누진공제로 세액이 연속된다', () => {
    expect(calcTradingBusinessTransferTax(14_000_000)).toBeCloseTo(840_000, 0);
    expect(calcTradingBusinessTransferTax(14_000_001)).toBeCloseTo(840_000.15, 0);
    expect(calcTradingBusinessTransferTax(50_000_000)).toBeCloseTo(6_240_000, 0);
    expect(calcTradingBusinessTransferTax(50_000_001)).toBeCloseTo(
      6_240_000.24,
      0,
    );
  });

  it('V11 세전수익 97,463,049 — 35% − 누진공제 1,544만', () => {
    const base = 97_463_049;
    expect(calcTradingBusinessTransferTax(base)).toBeCloseTo(18_672_067, 0);
    expect(formatTradingBusinessTransferTaxMeta(base)).toBe('35% − 누진공제');
  });

  it('세후수익 = 세전 − 양도세 − 지방소득세(양도세×10%) — 엑셀 E37', () => {
    const preTax = 97_463_049;
    const transfer = calcTradingBusinessTransferTax(preTax);
    const local = calcLocalIncomeTaxOnTransferTax(transfer);
    expect(local).toBeCloseTo(transfer * 0.1, 0);
    expect(calcNetProfitAfterBusinessTax(preTax, transfer)).toBeCloseTo(
      preTax - transfer - local,
      0,
    );
    expect(calcNetProfitAfterTransferTax(preTax, transfer)).toBeCloseTo(
      preTax - transfer - local,
      0,
    );
  });

  it('엑셀 E35·E36·E37 검산 (부가세 2,700만 시트)', () => {
    const e35 = 70_314_558;
    const e36 = 11_115_494;
    const e37 = 58_087_515;
    expect(calcLocalIncomeTaxOnTransferTax(e36)).toBeCloseTo(e36 * 0.1, 0);
    expect(e35 - e36 - e36 * 0.1).toBeCloseTo(e37, -3);
  });

  it('과세표준 0 이하이면 양도세·지방세 0', () => {
    expect(calcTradingBusinessTransferTax(-1)).toBe(0);
    expect(calcLocalIncomeTaxOnTransferTax(0)).toBe(0);
  });
});
