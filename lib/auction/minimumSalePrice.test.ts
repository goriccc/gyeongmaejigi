import { describe, expect, it } from 'vitest';
import {
  computeRoundMinimumPrice,
  resolveMinimumSalePrice,
} from '@/lib/auction/minimumSalePrice';

describe('computeRoundMinimumPrice', () => {
  it('유찰 횟수마다 80% 적용 (0회=100%)', () => {
    const appraisal = 1_580_000_000;
    expect(computeRoundMinimumPrice(appraisal, 0)).toBe(1_580_000_000);
    expect(computeRoundMinimumPrice(appraisal, 1)).toBe(1_264_000_000);
    expect(computeRoundMinimumPrice(appraisal, 2)).toBe(1_011_200_000);
  });
});

describe('resolveMinimumSalePrice', () => {
  const appraisal = 1_580_000_000;

  it('API 최저가가 감정가보다 작으면 그대로 사용', () => {
    expect(
      resolveMinimumSalePrice({
        appraisalValue: appraisal,
        auctionRound: 2,
        failedBidCount: 1,
        apiMinPrice: 1_264_000_000,
      }),
    ).toBe(1_264_000_000);
  });

  it('2025타경104034 — minmaePrice=감정가, 유찰 1회 → 80%', () => {
    expect(
      resolveMinimumSalePrice({
        appraisalValue: appraisal,
        auctionRound: 2,
        failedBidCount: 1,
        apiMinPrice: appraisal,
        notifyMinPrices: [1_264_000_000],
      }),
    ).toBe(1_264_000_000);
  });

  it('1회차 — minmaePrice=감정가, 유찰 0회 → 100%', () => {
    expect(
      resolveMinimumSalePrice({
        appraisalValue: appraisal,
        auctionRound: 1,
        failedBidCount: 0,
        apiMinPrice: appraisal,
      }),
    ).toBe(1_580_000_000);
  });
});
