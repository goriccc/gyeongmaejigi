import { describe, expect, it } from 'vitest';
import {
  calcBidDeposit,
  inferBidDepositRate,
  parseBidDepositRate,
  resolveBidDeposit,
} from './bidDeposit';

describe('bidDeposit', () => {
  it('parses deposit rate', () => {
    expect(parseBidDepositRate('20')).toBe(20);
    expect(parseBidDepositRate('10')).toBe(10);
    expect(parseBidDepositRate('10%')).toBe(10);
  });

  it('calculates 10% deposit from base', () => {
    expect(calcBidDeposit(580_000_000, 10)).toBe(58_000_000);
    expect(calcBidDeposit(580_000_000, 20)).toBe(116_000_000);
  });

  it('infers 20% from amount ratio', () => {
    expect(inferBidDepositRate(116_000_000, 580_000_000)).toBe(20);
    expect(inferBidDepositRate(58_000_000, 580_000_000)).toBe(10);
  });

  it('prefers minimum sale price as base', () => {
    const resolved = resolveBidDeposit({
      appraisalValue: 580_000_000,
      minimumSalePrice: 464_000_000,
      depositRate: 10,
    });
    expect(resolved).toEqual({ amount: 46_400_000, rate: 10 });
  });

  it('uses explicit deposit amount from API', () => {
    const resolved = resolveBidDeposit({
      appraisalValue: 580_000_000,
      minimumSalePrice: 464_000_000,
      depositAmount: 92_800_000,
    });
    expect(resolved.rate).toBe(20);
    expect(resolved.amount).toBe(92_800_000);
  });
});
