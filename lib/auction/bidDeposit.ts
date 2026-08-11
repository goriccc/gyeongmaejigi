import { parseAmount, stripHtml } from '@/lib/auction/caseNumberFormat';

export type BidDepositRate = 10 | 20;

export function parseBidDepositRate(value: unknown): BidDepositRate | null {
  const text = stripHtml(value).replace(/[^\d]/g, '');
  if (text === '20') return 20;
  if (text === '10') return 10;
  const num = Number(text);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num >= 15) return 20;
  if (num <= 12) return 10;
  return null;
}

export function inferBidDepositRate(
  depositAmount: number,
  baseAmount: number,
): BidDepositRate {
  if (baseAmount <= 0) return 10;
  const pct = (depositAmount / baseAmount) * 100;
  return pct >= 15 ? 20 : 10;
}

export function calcBidDeposit(
  baseAmount: number,
  rate: BidDepositRate = 10,
): number {
  if (baseAmount <= 0) return 0;
  return Math.round(baseAmount * (rate / 100));
}

export function resolveBidDeposit(input: {
  appraisalValue: number;
  minimumSalePrice?: number | null;
  depositAmount?: number | null;
  depositRate?: unknown;
}): { amount: number; rate: BidDepositRate } {
  const base =
    input.minimumSalePrice && input.minimumSalePrice > 0
      ? input.minimumSalePrice
      : input.appraisalValue;

  const parsedRate = parseBidDepositRate(input.depositRate);

  if (input.depositAmount && input.depositAmount > 0) {
    const rate =
      parsedRate ??
      inferBidDepositRate(input.depositAmount, base > 0 ? base : input.appraisalValue);
    return { amount: input.depositAmount, rate };
  }

  const rate = parsedRate ?? 10;
  return {
    amount: calcBidDeposit(base, rate),
    rate,
  };
}

export function parseBidDepositAmount(value: unknown): number | null {
  return parseAmount(value);
}
