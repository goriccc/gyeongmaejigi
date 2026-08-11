import { ACQUISITION_TAX_BRACKETS } from '@/data/taxTable';

export type RegZone = 'none' | 'adjusted';

/** 저장된 legacy 값(overheated)을 규제지역으로 통합 */
export function normalizeRegZone(zone?: string | null): RegZone {
  if (zone === 'adjusted' || zone === 'overheated') return 'adjusted';
  return 'none';
}

/** 현재 보유 주택수 (3 = 3주택 이상 → 매수 후 4주택 이상) */
export type HouseCount = 0 | 1 | 2 | 3;

function progressiveRate(price: number): number {
  if (price <= ACQUISITION_TAX_BRACKETS.low) return 0.01;
  if (price <= ACQUISITION_TAX_BRACKETS.high) {
    return (price * 2) / 300_000_000 / 100 - 3 / 100;
  }
  return 0.03;
}

/**
 * 낙찰가·주택수·규제구분·특례 기준 취득세율(비율)을 반환합니다.
 */
export function acquisitionTaxRate(
  price: number,
  houseCount: number,
  regZone: RegZone = 'none',
  lowPriceException = false,
  dispositionPlanned = false,
): number {
  if (dispositionPlanned || lowPriceException) {
    return progressiveRate(price);
  }
  const regulated = regZone === 'adjusted';
  if (houseCount >= 3) return 0.12;
  if (houseCount === 2) return regulated ? 0.12 : 0.08;
  if (houseCount === 1 && regulated) return 0.08;
  return progressiveRate(price);
}

/**
 * 생애최초 취득세 감면 (취득가액 12억 이하, 200만원 한도).
 * 전용 60㎡ 이하 300만원 한도는 면적정보 없어 미반영.
 */
export function firstTimeTaxDeduction(
  firstTimeBuyer: boolean,
  price: number,
  taxAmt: number,
): number {
  if (!firstTimeBuyer || price > 1_200_000_000) return 0;
  return Math.min(taxAmt, 2_000_000);
}

export function progressiveAcquisitionTaxRate(price: number): number {
  return acquisitionTaxRate(price, 0, 'none', false, false);
}

export function eduTaxRate(price: number, taxRate: number): number {
  if (price <= ACQUISITION_TAX_BRACKETS.low) return 0.001;
  if (price <= ACQUISITION_TAX_BRACKETS.high) return taxRate / 10;
  return 0.003;
}

export function calcAcquisitionTax(
  price: number,
  houseCount: number,
  regZone: RegZone = 'none',
  lowPriceException = false,
  dispositionPlanned = false,
): { rate: number; amount: number } {
  const rate = acquisitionTaxRate(
    price,
    houseCount,
    regZone,
    lowPriceException,
    dispositionPlanned,
  );
  return { rate, amount: price * rate };
}
