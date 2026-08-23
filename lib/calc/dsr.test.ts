import { describe, expect, it } from 'vitest';
import {
  dsrAnnualRepayCapacity,
  dsrAssessmentRate,
  dsrLoanCapacityEqualPayment,
  dsrLoanCapacityEqualPrincipal,
  stressDsrBreakdown,
} from './dsr';

describe('stressDsrBreakdown', () => {
  it('수도권 변동형 → 3.0%p', () => {
    const b = stressDsrBreakdown({ sudogwon: true, regZone: 'none' });
    expect(b.premium).toBe(0.03);
    expect(b.usesCapitalTable).toBe(true);
  });

  it('지방 비규제 변동형 → 0.75%p', () => {
    const b = stressDsrBreakdown({ sudogwon: false, regZone: 'none' });
    expect(b.premium).toBe(0.0075);
    expect(b.stageRatio).toBe(0.5);
  });

  it('지방이라도 규제지역이면 3.0%p', () => {
    const b = stressDsrBreakdown({ sudogwon: false, regZone: 'adjusted' });
    expect(b.premium).toBe(0.03);
  });

  it('혼합형 고정기간 길면 가산 0', () => {
    const b = stressDsrBreakdown({
      sudogwon: true,
      rateType: 'hybrid',
      hybridFixedShare: 'high',
    });
    expect(b.premium).toBe(0);
  });
});

describe('dsr capacities', () => {
  it('기존 부채만큼 연간 상환 여력이 줄어든다', () => {
    expect(dsrAnnualRepayCapacity(50_000_000, 0.5, 5_000_000)).toBe(
      20_000_000,
    );
  });

  it('엑셀 원리금균등 (소득 5천만·DSR50%·4.5%·30년)', () => {
    const annual = dsrAnnualRepayCapacity(50_000_000, 0.5, 0);
    const cap = dsrLoanCapacityEqualPayment(annual, 0.045, 30);
    expect(cap).toBeCloseTo(411_169_081, -4);
  });

  it('엑셀 원금균등 1회차 (소득 5천만·DSR50%·4.5%·30년)', () => {
    const annual = dsrAnnualRepayCapacity(50_000_000, 0.5, 0);
    const cap = dsrLoanCapacityEqualPrincipal(annual, 0.045, 30);
    expect(cap).toBeCloseTo(319_148_936, -3);
  });

  it('산정금리 = 약정 + 가산', () => {
    expect(dsrAssessmentRate(0.055, 0.015)).toBeCloseTo(0.07);
  });
});
