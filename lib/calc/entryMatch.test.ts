import { describe, expect, it } from 'vitest';
import { calcEntryMatch } from './entryMatch';
import { acquisitionTaxRate } from './acquisitionTax';
import { dsrLoanCapacity } from './dsr';
import { applyLtvWithCredit, baseLTV } from './ltv';

describe('baseLTV / applyLtvWithCredit', () => {
  it('주택수별 기준 LTV', () => {
    expect(baseLTV(0)).toBe(0.7);
    expect(baseLTV(1)).toBe(0.6);
    expect(baseLTV(2)).toBe(0.4);
  });

  it('신용 보정 후 클램프', () => {
    expect(applyLtvWithCredit(0, 0.05)).toBe(0.75);
    expect(applyLtvWithCredit(2, -0.05)).toBeCloseTo(0.35);
  });
});

describe('acquisitionTaxRate', () => {
  it('6억 이하 1%', () => {
    expect(acquisitionTaxRate(210_000_000, 0)).toBeCloseTo(0.01);
  });

  it('다주택 중과 8%', () => {
    expect(acquisitionTaxRate(500_000_000, 2)).toBe(0.08);
  });

  it('6~9억 구간 선형', () => {
    expect(acquisitionTaxRate(750_000_000, 0)).toBeCloseTo(0.02);
  });
});

describe('dsrLoanCapacity', () => {
  it('연금현재가치 공식', () => {
    const cap = dsrLoanCapacity(55_000_000, 0.5, 0.045, 10);
    expect(cap).toBeGreaterThan(200_000_000);
    expect(cap).toBeLessThan(400_000_000);
  });
});

describe('calcEntryMatch', () => {
  it('기본값에서 LTV 제약', () => {
    const result = calcEntryMatch({
      seedMoney: 80_000_000,
      houseCount: 0,
      creditState: '보통',
      annualIncome: 55_000_000,
      dsrRate: 0.5,
    });
    expect(result.binding).toBe('LTV');
    expect(result.ltvApplied).toBe(0.7);
    expect(result.bidCapacity).toBeGreaterThan(100_000_000);
  });

  it('낮은 소득이면 DSR 제약', () => {
    const result = calcEntryMatch({
      seedMoney: 80_000_000,
      houseCount: 0,
      creditState: '보통',
      annualIncome: 20_000_000,
      dsrRate: 0.4,
    });
    expect(result.binding).toBe('DSR');
  });
});
