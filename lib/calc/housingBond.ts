import {
  HOUSING_BOND_EXEMPT_BELOW,
  HOUSING_BOND_PURCHASE_BRACKETS,
  type HousingBondRegion,
} from '@/data/housingBondRates';

export type { HousingBondRegion };

const METRO_PREFIXES = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
] as const;

/** 소재지 문구로 서울·광역시 여부 추정 */
export function inferHousingBondRegion(address?: string): HousingBondRegion {
  const trimmed = address?.trim() ?? '';
  if (!trimmed) return 'metro';
  return METRO_PREFIXES.some((p) => trimmed.startsWith(p)) ? 'metro' : 'other';
}

/** 시가표준액 구간별 매입률(‰). 면제면 null */
export function housingBondPurchaseRatePerMille(
  officialPrice: number,
  region: HousingBondRegion,
): number | null {
  if (officialPrice < HOUSING_BOND_EXEMPT_BELOW) return null;

  let rate: number = HOUSING_BOND_PURCHASE_BRACKETS[0][region];
  for (const bracket of HOUSING_BOND_PURCHASE_BRACKETS) {
    if (officialPrice >= bracket.min) {
      rate = bracket[region];
    }
  }
  return rate;
}

/** 5천원 미만 절사 · 5천원 이상 만원 올림 */
export function roundBondPurchaseAmount(raw: number): number {
  if (raw <= 0) return 0;
  const remainder = raw % 10_000;
  if (remainder === 0) return raw;
  if (remainder >= 5_000) return raw - remainder + 10_000;
  return raw - remainder;
}

/** 채권 매입금액(발행금액, 원) */
export function calcHousingBondPurchaseAmount(
  officialPrice: number,
  region: HousingBondRegion,
): { purchaseAmount: number; ratePerMille: number | null; exempt: boolean } {
  const ratePerMille = housingBondPurchaseRatePerMille(officialPrice, region);
  if (ratePerMille == null) {
    return { purchaseAmount: 0, ratePerMille: null, exempt: true };
  }
  const raw = officialPrice * (ratePerMille / 1000);
  return {
    purchaseAmount: roundBondPurchaseAmount(raw),
    ratePerMille,
    exempt: false,
  };
}

/** 할인율(%) × 매입금액 — API 실패 시 임시 추정 */
export function estimateBondCustomerBurden(
  purchaseAmount: number,
  discountRatePct: number,
): number {
  if (purchaseAmount <= 0 || discountRatePct <= 0) return 0;
  return Math.round(purchaseAmount * (discountRatePct / 100));
}
