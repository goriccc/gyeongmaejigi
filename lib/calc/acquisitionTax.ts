import {
  ACQUISITION_TAX_BRACKETS,
  MULTI_HOUSE_SURCHARGE_RATE,
} from '@/data/taxTable';

/**
 * 낙찰가·주택수 기준 취득세율(비율)을 반환합니다.
 * @param price - 낙찰가(원)
 * @param houseCount - 현재 주택수 (0/1/2+)
 * @returns 취득세율 (0~1)
 */
export function acquisitionTaxRate(price: number, houseCount: number): number {
  if (houseCount >= 2) {
    return MULTI_HOUSE_SURCHARGE_RATE;
  }
  if (price <= ACQUISITION_TAX_BRACKETS.low) return 0.01;
  if (price <= ACQUISITION_TAX_BRACKETS.high) {
    return (price * 2) / 300_000_000 / 100 - 3 / 100;
  }
  return 0.03;
}

/**
 * 모듈 D용 취득세율 — 다주택 중과 없이 낙찰가 구간만 적용합니다.
 * @param price - 낙찰가(원)
 */
export function progressiveAcquisitionTaxRate(price: number): number {
  return acquisitionTaxRate(price, 0);
}

/**
 * 지방교육세율(비율)을 반환합니다.
 * @param price - 낙찰가(원)
 * @param taxRate - 적용 취득세율
 */
export function eduTaxRate(price: number, taxRate: number): number {
  if (price <= ACQUISITION_TAX_BRACKETS.low) return 0.001;
  if (price <= ACQUISITION_TAX_BRACKETS.high) return taxRate / 10;
  return 0.003;
}

/**
 * 취득세 금액을 계산합니다.
 * @param price - 낙찰가(원)
 * @param houseCount - 현재 주택수
 */
export function calcAcquisitionTax(
  price: number,
  houseCount: number,
): { rate: number; amount: number } {
  const rate = acquisitionTaxRate(price, houseCount);
  return { rate, amount: price * rate };
}
