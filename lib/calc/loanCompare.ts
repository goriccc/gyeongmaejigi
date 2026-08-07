import { AFTER_TAX_FACTOR } from '@/data/taxTable';

export type LoanOfferInput = {
  id: string;
  name: string;
  /** LTV 비율 (0~1) */
  ltv: number;
  /** 금리 비율 */
  rate: number;
  /** 중도상환수수료율 */
  prepayRate: number;
  /** 적용기간(개월) */
  prepayPeriod: number;
};

export type RankedLoanOffer = LoanOfferInput & {
  netProfit: number;
  rank: number;
  isBest: boolean;
};

/**
 * 대출상품별 세후수익을 계산하고 내림차순 정렬합니다.
 * @param offers - 상담사 조건 목록
 * @param bid - 입찰가(원)
 * @param grossProfit - 세전 목표수익(원)
 * @param months - 매도잔금기간(개월)
 */
export function rankLoanOffers(
  offers: LoanOfferInput[],
  bid: number,
  grossProfit: number,
  months: number,
): RankedLoanOffer[] {
  const computed = offers.map((offer) => {
    const loanPrincipal = bid * offer.ltv;
    const interestCost = loanPrincipal * offer.rate * (months / 12);
    const remainingRatio =
      offer.prepayPeriod > 0
        ? Math.max(0, (offer.prepayPeriod - months) / offer.prepayPeriod)
        : 0;
    const prepayFee = loanPrincipal * offer.prepayRate * remainingRatio;
    const netProfit =
      grossProfit * AFTER_TAX_FACTOR - interestCost - prepayFee;
    return { ...offer, netProfit };
  });

  computed.sort((a, b) => b.netProfit - a.netProfit);

  return computed.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    isBest: idx === 0,
  }));
}
