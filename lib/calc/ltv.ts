import type { HouseCount, RegZone } from './acquisitionTax';

/**
 * 주택수별 기준 LTV를 반환합니다.
 * 지방·비규제 다주택 영역에서 쓰이는 시작값 — 정부 고시가 아닌 임의 가정치.
 */
export function baseLTV(houseCount: number): number {
  if (houseCount === 0) return 0.7;
  if (houseCount === 1) return 0.6;
  return 0.4;
}

/**
 * LTV 상한 (2025.6.27 + 2025.10.15 대책)
 */
export function ltvCap(
  sudogwon: boolean,
  regZone: RegZone,
  houseCount: HouseCount,
  lowPriceException: boolean,
  dispositionPlanned: boolean,
  lenderLtv: number,
  firstTimeBuyer: boolean,
  realDemand: boolean,
): number {
  if (houseCount >= 1) {
    if (dispositionPlanned) {
      return regZone === 'adjusted' ? 0.4 : 0.7;
    }
    if (sudogwon) {
      return 0;
    }
    return 1; // 지방: 상한 없음(참고치)
  }
  const regulated = regZone === 'adjusted';
  if (firstTimeBuyer) return sudogwon || regulated ? 0.7 : 0.8;
  if (realDemand && regulated) return 0.6;
  if (regulated) return 0.4;
  return 1;
}

/**
 * 대출한도 절대금액 캡 (2025.10.15, 수도권 한정. 지방은 캡 없음).
 */
export function loanAmountCap(isSudogwon: boolean, price: number): number {
  if (!isSudogwon) return Number.POSITIVE_INFINITY;
  if (price <= 1_500_000_000) return 600_000_000;
  if (price <= 2_500_000_000) return 400_000_000;
  return 200_000_000;
}

export function applyLtvWithCredit(
  houseCount: number,
  creditAdj: number,
): number {
  return Math.min(0.8, Math.max(0.2, baseLTV(houseCount) + creditAdj));
}

export function applyLtvWithPolicy(
  houseCount: HouseCount,
  creditAdj: number,
  sudogwon: boolean,
  regZone: RegZone,
  lowPriceException: boolean,
  dispositionPlanned: boolean,
  lenderLtv: number,
  firstTimeBuyer: boolean,
  realDemand: boolean,
): number {
  const base = applyLtvWithCredit(houseCount, creditAdj);
  const cap = ltvCap(
    sudogwon,
    regZone,
    houseCount,
    lowPriceException,
    dispositionPlanned,
    lenderLtv,
    firstTimeBuyer,
    realDemand,
  );
  return Math.min(base, cap);
}

/** @deprecated */
export function regZoneLtvCap(zone: RegZone, houseCount: number): number {
  if (zone === 'adjusted') {
    if (houseCount === 0) return 0.5;
    if (houseCount === 1) return 0.4;
    return 0;
  }
  return 1;
}

/** @deprecated */
export function applyLtvWithCreditAndZone(
  houseCount: number,
  creditAdj: number,
  regZone: RegZone,
): number {
  const base = applyLtvWithCredit(houseCount, creditAdj);
  return Math.min(base, regZoneLtvCap(regZone, houseCount));
}

export const CREDIT_MAP = {
  우수: { adj: 0.05, rate: 0.055, label: '우수 (900점 이상)' },
  보통: { adj: 0, rate: 0.058, label: '보통 (850점 이상)' },
  주의: { adj: -0.05, rate: 0.061, label: '주의 (750점 이상)' },
} as const;

export type CreditState = keyof typeof CREDIT_MAP;
