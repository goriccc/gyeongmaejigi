import { describe, expect, it } from 'vitest';
import {
  formatYmd,
  isWeekend,
  resolveBondBasisDate,
} from '@/lib/calc/businessDay';
import {
  calcHousingBondPurchaseAmount,
  inferHousingBondRegion,
  roundBondPurchaseAmount,
} from '@/lib/calc/housingBond';
import {
  parseWooriCustomerBurden,
  parseWooriDiscountTable,
} from '@/lib/housingBond/wooriClient';

describe('housingBond purchase amount', () => {
  it('서울 2억 주택 23‰ → 460만원', () => {
    const result = calcHousingBondPurchaseAmount(200_000_000, 'metro');
    expect(result.ratePerMille).toBe(23);
    expect(result.purchaseAmount).toBe(4_600_000);
    expect(result.exempt).toBe(false);
  });

  it('2천만원 미만 면제', () => {
    const result = calcHousingBondPurchaseAmount(19_000_000, 'metro');
    expect(result.exempt).toBe(true);
    expect(result.purchaseAmount).toBe(0);
  });

  it('만원 단위 반올림', () => {
    expect(roundBondPurchaseAmount(4_632_900)).toBe(4_630_000);
    expect(roundBondPurchaseAmount(4_635_000)).toBe(4_640_000);
  });

  it('지역 추정', () => {
    expect(inferHousingBondRegion('서울특별시 강남구')).toBe('metro');
    expect(inferHousingBondRegion('경기도 성남시')).toBe('other');
  });
});

describe('businessDay', () => {
  it('토요일 → 직전 금요일', () => {
    const sat = new Date(2026, 7, 8);
    expect(isWeekend(sat)).toBe(true);
    const fri = resolveBondBasisDate(sat);
    expect(formatYmd(fri)).toBe('2026-08-07');
  });
});

describe('woori HTML parsers', () => {
  it('할인율 표 파싱', () => {
    const html = `
      <tr><td>2026.08.11</td><td>8,531</td><td>4.212</td><td>14.89957</td></tr>
    `;
    const rows = parseWooriDiscountTable(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-08-11');
    expect(rows[0].discountRatePct).toBeCloseTo(14.89957);
  });

  it('고객부담금 파싱', () => {
    const html = `
      <input type="hidden" name="SLF_BRDM" id="SLF_BRDM" value="685,370">
      <input type="hidden" name="NAHB_PRFT_RT" id="NAHB_PRFT_RT" value="4.212">
    `;
    const parsed = parseWooriCustomerBurden(html);
    expect(parsed?.customerBurden).toBe(685_370);
  });
});
