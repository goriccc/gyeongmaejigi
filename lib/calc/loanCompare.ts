import {
  calcNetProfitAfterBusinessTax,
  calcPreTaxProfit,
  calcTradingBusinessTransferTax,
} from './tradingTax';

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
 * @param effectiveSellPrice - 실질 매도가(원)
 * @param financeFreeDetailed - 이자·중도상환 제외 상세비용(원)
 * @param months - 매도잔금기간(개월)
 */
export function rankLoanOffers(
  offers: LoanOfferInput[],
  bid: number,
  effectiveSellPrice: number,
  financeFreeDetailed: number,
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
    const detailedTotal = financeFreeDetailed + interestCost + prepayFee;
    const grossProfit = calcPreTaxProfit(
      effectiveSellPrice,
      bid,
      detailedTotal,
    );
    const transferTax = calcTradingBusinessTransferTax(grossProfit);
    const netProfit = calcNetProfitAfterBusinessTax(grossProfit, transferTax);
    return { ...offer, netProfit };
  });

  computed.sort((a, b) => b.netProfit - a.netProfit);

  return computed.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    isBest: idx === 0,
  }));
}
