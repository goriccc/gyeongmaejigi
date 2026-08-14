import {
  LOCAL_INCOME_TAX_ON_NATIONAL_RATE,
  TRADING_BUSINESS_INCOME_TAX_BRACKETS,
  type TradingBusinessIncomeTaxBracket,
} from '@/data/taxTable';

/** 실질 매도가 − 입찰가 − 상세비용 */
export function calcPreTaxProfit(
  effectiveSellPrice: number,
  bidPrice: number,
  detailedTotal: number,
): number {
  return effectiveSellPrice - bidPrice - detailedTotal;
}

/** 과세표준에 해당하는 매매사업자 소득세 구간 */
export function resolveTradingBusinessTaxBracket(
  taxBase: number,
): TradingBusinessIncomeTaxBracket | null {
  if (taxBase <= 0) return null;
  for (const bracket of TRADING_BUSINESS_INCOME_TAX_BRACKETS) {
    if (taxBase <= bracket.maxBase) return bracket;
  }
  return TRADING_BUSINESS_INCOME_TAX_BRACKETS.at(-1) ?? null;
}

/**
 * 매매사업자 기준 예상 소득세(국세) — 이 건 이익만 과세표준으로 가정.
 * 산출세액 = 과세표준 × 세율 − 누진공제
 */
export function calcTradingBusinessTransferTax(preTaxProfit: number): number {
  const bracket = resolveTradingBusinessTaxBracket(preTaxProfit);
  if (!bracket) return 0;
  return Math.max(0, preTaxProfit * bracket.rate - bracket.deduction);
}

/** 지방소득세 — 양도세(국세) × 10% */
export function calcLocalIncomeTaxOnTransferTax(transferTax: number): number {
  if (transferTax <= 0) return 0;
  return transferTax * LOCAL_INCOME_TAX_ON_NATIONAL_RATE;
}

/**
 * 세후 예상수익 (엑셀 E37).
 * = 세전 목표수익 − 양도세 − 지방소득세(양도세×10%)
 */
export function calcNetProfitAfterBusinessTax(
  preTaxProfit: number,
  transferTax = calcTradingBusinessTransferTax(preTaxProfit),
): number {
  const localIncomeTax = calcLocalIncomeTaxOnTransferTax(transferTax);
  return preTaxProfit - transferTax - localIncomeTax;
}

/** @deprecated calcNetProfitAfterBusinessTax 사용 */
export function calcNetProfitAfterTransferTax(
  preTaxProfit: number,
  transferTax = calcTradingBusinessTransferTax(preTaxProfit),
): number {
  return calcNetProfitAfterBusinessTax(preTaxProfit, transferTax);
}

/** UI 표기 — 예: `35% − 누진공제` */
export function formatTradingBusinessTransferTaxMeta(taxBase: number): string {
  const bracket = resolveTradingBusinessTaxBracket(taxBase);
  if (!bracket) return '';
  const ratePct = `${(bracket.rate * 100).toFixed(0)}%`;
  if (bracket.deduction <= 0) return ratePct;
  return `${ratePct} − 누진공제`;
}

/** 실효세율 (표시용) */
export function effectiveTradingBusinessTaxRate(taxBase: number): number {
  if (taxBase <= 0) return 0;
  return calcTradingBusinessTransferTax(taxBase) / taxBase;
}
