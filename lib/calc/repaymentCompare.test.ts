import { describe, expect, it } from 'vitest';
import {
  monthlyEqualPayment,
  monthlyEqualPrincipal,
  repaymentCompareSnapshot,
  totalInterestEqualPayment,
  totalInterestEqualPrincipal,
} from './repaymentCompare';

describe('repaymentCompare', () => {
  const principal = 100_000_000;
  const rate = 0.05;
  const years = 10;
  const months = years * 12;

  it('원리금균등 1억·5%·10년 1회차 약 106만', () => {
    const pmt = monthlyEqualPayment(principal, rate, months);
    expect(Math.round(pmt / 10_000)).toBe(106);
  });

  it('원금균등 1회차 약 125만', () => {
    const first = monthlyEqualPrincipal(principal, rate, 1, months);
    expect(Math.round(first / 10_000)).toBe(125);
  });

  it('원금균등 총 이자가 원리금균등보다 적다', () => {
    const snap = repaymentCompareSnapshot(principal, rate, years);
    expect(snap.totalInterestPrincipal).toBeLessThan(
      snap.totalInterestPayment,
    );
    expect(
      Math.round(
        (snap.totalInterestPayment - snap.totalInterestPrincipal) / 10_000,
      ),
    ).toBe(207);
  });

  it('총 이자 공식 일치', () => {
    expect(totalInterestEqualPrincipal(principal, rate, months)).toBeCloseTo(
      repaymentCompareSnapshot(principal, rate, years).totalInterestPrincipal,
      0,
    );
    expect(totalInterestEqualPayment(principal, rate, months)).toBeCloseTo(
      repaymentCompareSnapshot(principal, rate, years).totalInterestPayment,
      0,
    );
  });
});
