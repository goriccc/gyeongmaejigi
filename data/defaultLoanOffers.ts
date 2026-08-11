import type { LoanOffer } from '@/types/case';

export type LoanOfferTemplate = Omit<LoanOffer, 'id'>;

export const GENERIC_LOAN_TEMPLATE: LoanOfferTemplate = {
  name: '상담사 / 상품명',
  ltv: 70,
  rate: 4.5,
  prepayRate: 0.5,
  prepayPeriod: 36,
};

export const DEFAULT_LOAN_OFFERS: LoanOffer[] = [
  {
    id: '1',
    name: '김정아 · 전자상거래(근저당)',
    ltv: 75,
    rate: 4.6,
    prepayRate: 0.48,
    prepayPeriod: 36,
  },
  {
    id: '2',
    name: '천유진 · 개인대출(중도3년)',
    ltv: 90,
    rate: 5.2,
    prepayRate: 1.0,
    prepayPeriod: 36,
  },
  {
    id: '3',
    name: '박현숙 · 일반사업자',
    ltv: 85,
    rate: 4.8,
    prepayRate: 1.0,
    prepayPeriod: 24,
  },
];

export function newLoanOfferId(): string {
  return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
