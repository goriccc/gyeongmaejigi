import { ENTRY_FIXED_COST } from '@/data/taxTable';
import { acquisitionTaxRate } from './acquisitionTax';
import { applyLtvWithCredit, CREDIT_MAP, type CreditState } from './ltv';
import { dsrLoanCapacity } from './dsr';

export type EntryMatchInput = {
  /** 시드머니(원) */
  seedMoney: number;
  houseCount: 0 | 1 | 2;
  creditState: CreditState;
  /** 연소득(원) — 세션 전용, 저장하지 않음 */
  annualIncome: number;
  /** DSR 한도 비율 */
  dsrRate: number;
};

export type EntryMatchResult = {
  bidCapacity: number;
  ltvApplied: number;
  dsrCapacity: number;
  loanCapacity: number;
  binding: 'LTV' | 'DSR';
  taxRate: number;
  taxAmount: number;
  sizeGuide: string;
};

/**
 * 낙찰가 규모 가이드 텍스트를 반환합니다.
 * @param price - 낙찰가(원)
 */
export function sizeGuideText(price: number): string {
  if (price < 300_000_000) return '소형 (3억원 미만)';
  if (price < 600_000_000) return '중형 (3~6억원대)';
  if (price < 900_000_000) return '중대형 (6~9억원대)';
  return '대형 (9억원 이상)';
}

/**
 * LTV·DSR 이중제약으로 실투자 가능 낙찰가를 역산합니다.
 * @param input - 진입매칭 입력값
 * @returns 계산 결과
 */
export function calcEntryMatch(input: EntryMatchInput): EntryMatchResult {
  const { seedMoney, houseCount, creditState, annualIncome, dsrRate } = input;
  const credit = CREDIT_MAP[creditState];
  const ltv = applyLtvWithCredit(houseCount, credit.adj);
  const fixedCost = ENTRY_FIXED_COST;
  const dsrCapacity = dsrLoanCapacity(
    annualIncome,
    dsrRate,
    credit.rate,
    10,
  );

  let priceByLTV = (seedMoney - fixedCost) / (1 - ltv + 0.01);
  for (let i = 0; i < 8; i++) {
    const rate = acquisitionTaxRate(priceByLTV, houseCount);
    priceByLTV = (seedMoney - fixedCost) / (1 - ltv + rate);
  }
  priceByLTV = Math.max(0, priceByLTV);

  let price: number;
  let loanAmt: number;
  let binding: 'LTV' | 'DSR';

  if (priceByLTV * ltv <= dsrCapacity) {
    price = priceByLTV;
    loanAmt = price * ltv;
    binding = 'LTV';
  } else {
    let priceByDSR = seedMoney + dsrCapacity - fixedCost;
    for (let i = 0; i < 8; i++) {
      const rate = acquisitionTaxRate(priceByDSR, houseCount);
      priceByDSR = (seedMoney + dsrCapacity - fixedCost) / (1 + rate);
    }
    price = Math.max(0, priceByDSR);
    loanAmt = dsrCapacity;
    binding = 'DSR';
  }

  const taxRate = acquisitionTaxRate(price, houseCount);
  const taxAmount = price * taxRate;

  return {
    bidCapacity: price,
    ltvApplied: ltv,
    dsrCapacity,
    loanCapacity: loanAmt,
    binding,
    taxRate,
    taxAmount,
    sizeGuide: sizeGuideText(price),
  };
}
