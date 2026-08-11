/**
 * 주택 매매·교환 중개보수 상한요율 (전국 17개 시·도 공통 6구간)
 *
 * 출처: 공인중개사법 시행규칙 제20조 · 각 시·도 「주택의 중개보수 등에 관한 조례」 별표1
 * 시·도별 조례명·추론: data/brokerFeeRegions.ts
 * 최종 확인: 2026-08 (마이홈포털·서울·경기·전북·제주 교차 확인)
 *
 * - 거래금액 × 상한요율 이내 협의, 한도액 초과 불가
 * - 부가가치세 별도 (본 계산 미포함)
 */

export type BrokerFeeBracket = {
  /** 구간 상한(원, 미만). 마지막 구간은 Infinity */
  max: number;
  /** 상한요율 (0.004 = 0.4%) */
  rate: number;
  /** 한도액(원). 없으면 null */
  cap: number | null;
  /** 구간 설명 */
  label: string;
};

/** 주택(부속토지 포함) 매매·교환 */
export const BROKER_FEE_SALE_BRACKETS: BrokerFeeBracket[] = [
  {
    max: 50_000_000,
    rate: 0.006,
    cap: 250_000,
    label: '5천만원 미만',
  },
  {
    max: 200_000_000,
    rate: 0.005,
    cap: 800_000,
    label: '5천만원 이상 ~ 2억원 미만',
  },
  {
    max: 900_000_000,
    rate: 0.004,
    cap: null,
    label: '2억원 이상 ~ 9억원 미만',
  },
  {
    max: 1_200_000_000,
    rate: 0.005,
    cap: null,
    label: '9억원 이상 ~ 12억원 미만',
  },
  {
    max: 1_500_000_000,
    rate: 0.006,
    cap: null,
    label: '12억원 이상 ~ 15억원 미만',
  },
  {
    max: Infinity,
    rate: 0.007,
    cap: null,
    label: '15억원 이상',
  },
];
