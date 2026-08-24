import { describe, expect, it } from 'vitest';
import {
  calcMaxLoanEqualPrincipal,
  clampGraceMonths,
  dsrAnnualRepayCapacity,
  dsrAssessmentRate,
  dsrLoanCapacityEqualPayment,
  dsrLoanCapacityEqualPrincipal,
  stressDsrBreakdown,
  stressDsrRatio,
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

  it('엑셀 원리금균등 거치0 (소득 5천만·DSR50%·4.5%·30년)', () => {
    const annual = dsrAnnualRepayCapacity(50_000_000, 0.5, 0);
    const cap = dsrLoanCapacityEqualPayment(annual, 0.045, 30, 0);
    expect(cap).toBeCloseTo(411_169_081, -4);
  });

  it('은행 대조: 원금균등 총상환평균 (소득 4920만·DSR50%·8.5%·거치12·30년)', () => {
    // 2026.2.6 상담내역 · DSR_역산계산기.xlsx — 기대 ≈ 3억 1,796만
    const cap = calcMaxLoanEqualPrincipal(
      49_200_000,
      0.5,
      0.085,
      12,
      360,
    );
    expect(cap).toBeGreaterThan(317_960_000 * 0.999);
    expect(cap).toBeLessThan(317_960_000 * 1.001);
    expect(Math.round(cap / 1_000_000)).toBe(318);
  });

  it('은행 대조: 원리금균등 총상환평균 (소득 4920만·DSR50%·8.5%·거치0/12·30년)', () => {
    const annual = dsrAnnualRepayCapacity(49_200_000, 0.5, 0);
    const noGrace = dsrLoanCapacityEqualPayment(annual, 0.085, 30, 0);
    const withGrace = dsrLoanCapacityEqualPayment(annual, 0.085, 30, 12);
    expect(Math.round(noGrace)).toBe(266_609_969);
    expect(Math.round(withGrace)).toBe(265_352_971);
    expect(withGrace).toBeLessThan(noGrace);
  });

  it('거치가 길수록 총이자가 늘어 원금균등 한도가 줄어든다', () => {
    const withGrace = calcMaxLoanEqualPrincipal(
      49_200_000,
      0.5,
      0.085,
      12,
      360,
    );
    const noGrace = calcMaxLoanEqualPrincipal(
      49_200_000,
      0.5,
      0.085,
      0,
      360,
    );
    expect(withGrace).toBeLessThan(noGrace);
  });

  it('엑셀 스트레스DSR(%) = 연평균상환÷소득 (318M·8.449%·거치12)', () => {
    // DSR_역산계산기.xlsx · 약정 5.5% + 가산 2.949%p → 49.835%
    const ratio = stressDsrRatio(
      318_000_000,
      49_200_000,
      0.055 + 0.02949,
      30,
      12,
      'equalPrincipal',
    );
    expect(ratio * 100).toBeCloseTo(49.835, 3);
  });

  it('산정금리 = 약정 + 가산', () => {
    expect(dsrAssessmentRate(0.055, 0.015)).toBeCloseTo(0.07);
  });

  it('거치기간 clamp: NaN→기본, 범위 밖→경계', () => {
    expect(clampGraceMonths(Number.NaN)).toBe(12);
    expect(clampGraceMonths(-3)).toBe(0);
    expect(clampGraceMonths(99)).toBe(60);
    expect(clampGraceMonths(12.6)).toBe(13);
  });
});
