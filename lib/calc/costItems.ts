import {
  BROKER_FEE_BRACKETS,
  DEFAULT_PREPAY,
  FIXED_COSTS,
} from '@/data/taxTable';
import { eduTaxRate, progressiveAcquisitionTaxRate } from './acquisitionTax';

export type CostItem = {
  key: string;
  name: string;
  note: string;
  amount: number | null;
  rate: number | null;
  kind: 'required' | 'conditional';
};

export type CostItemsResult = {
  items: CostItem[];
  requiredTotal: number;
  approxTotal: number;
  diff: number;
};

/**
 * 매도가 기준 중개보수 요율을 반환합니다.
 * @param sell - 매도가(원)
 */
export function brokerFeeRate(sell: number): number {
  for (const b of BROKER_FEE_BRACKETS) {
    if (sell < b.max) return b.rate;
  }
  return 0.007;
}

/**
 * 입찰가·매도가 기준 비용 항목 13종을 계산합니다.
 * @param bid - 입찰가(원)
 * @param sell - 매도가(원)
 * @param interestCost - 금융비용(원)
 * @param loanPrincipal - 대출원금(원)
 * @param months - 보유개월
 * @param loanRate - 대출이자율(비율)
 * @param costRate - 개략 취득비용률
 * @param prepayRate - 중도상환수수료율 (기본 가정값)
 * @param prepayPeriod - 적용기간(개월)
 */
export function calcCostItems(
  bid: number,
  sell: number,
  interestCost: number,
  loanPrincipal: number,
  months: number,
  loanRate: number,
  costRate: number,
  prepayRate = DEFAULT_PREPAY.rate,
  prepayPeriod = DEFAULT_PREPAY.periodMonths,
): CostItemsResult {
  const taxRate = progressiveAcquisitionTaxRate(bid);
  const taxAmt = bid * taxRate;
  const eduRate = eduTaxRate(bid, taxRate);
  const eduAmt = bid * eduRate;
  const prepayFee =
    loanPrincipal *
    prepayRate *
    Math.max(0, (prepayPeriod - months) / prepayPeriod);
  const brokerRate = brokerFeeRate(sell);
  const brokerFee = sell * brokerRate;

  const items: CostItem[] = [
    {
      key: 'tax',
      name: '취득세',
      note: '낙찰가 구간별 누진 (6억 이하 1% · 6~9억 구간 1~3% · 9억 초과 3%, 다주택 중과 별도)',
      amount: taxAmt,
      rate: taxRate,
      kind: 'required',
    },
    {
      key: 'edu',
      name: '지방교육세',
      note: '취득세 연동 (6억 이하 0.1% · 6~9억 취득세의 1/10 · 9억 초과 0.3%)',
      amount: eduAmt,
      rate: eduRate,
      kind: 'required',
    },
    {
      key: 'regist',
      name: '등기법무비',
      note: '약 70~120만원 (견적 협의 가능) — 100만원 가정치',
      amount: FIXED_COSTS.registration,
      rate: null,
      kind: 'required',
    },
    {
      key: 'bond',
      name: '국민주택채권 매입 할인비',
      note: '시가표준액 기준 매입률 고시에 따름 — 150만원 가정치',
      amount: FIXED_COSTS.housingBond,
      rate: null,
      kind: 'required',
    },
    {
      key: 'interest',
      name: '금융비용 (경락대출 이자)',
      note: '대출원금 × 이자율 × 보유개월 — 위 대출이자율 슬라이더에 연동됨',
      amount: interestCost,
      rate: loanRate,
      kind: 'required',
    },
    {
      key: 'prepay',
      name: '중도상환수수료',
      note: '대출원금 × 수수료율 × (적용기간 − 보유개월) ÷ 적용기간 — 적용기간 36개월 가정치',
      amount: prepayFee,
      rate: prepayRate,
      kind: 'required',
    },
    {
      key: 'evict',
      name: '명도비',
      note: '평균 250~300만원 (32평 기준)',
      amount: FIXED_COSTS.eviction,
      rate: null,
      kind: 'required',
    },
    {
      key: 'broker',
      name: '중개보수 (매도시)',
      note: '매도가 기준 구간별 0.4~0.7%',
      amount: brokerFee,
      rate: brokerRate,
      kind: 'required',
    },
    {
      key: 'misc',
      name: '말소비 · 기타비용',
      note: '말소비 5~10만원, 교통비·명도 선물·입주청소 등 평균 50만원',
      amount: FIXED_COSTS.misc,
      rate: null,
      kind: 'required',
    },
    {
      key: 'unpaid',
      name: '미납관리비',
      note: '물건별로 다름 — 확인되면 입찰가에서 선반영 권장',
      amount: null,
      rate: null,
      kind: 'conditional',
    },
    {
      key: 'farm',
      name: '농어촌특별세',
      note: '전용 85㎡ 초과시 0.2%, 이하는 면제',
      amount: null,
      rate: null,
      kind: 'conditional',
    },
    {
      key: 'repair',
      name: '수리비',
      note: '임장에서 확인된 상태에 따라 다름',
      amount: null,
      rate: null,
      kind: 'conditional',
    },
    {
      key: 'force',
      name: '강제집행비',
      note: '평균 10건 중 1건 발생, 발생시 600~700만원 — 사전 반영 불가',
      amount: null,
      rate: null,
      kind: 'conditional',
    },
  ];

  const requiredTotal = items
    .filter((i) => i.kind === 'required' && i.amount != null)
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const approxTotal = sell * costRate;

  return {
    items,
    requiredTotal,
    approxTotal,
    diff: approxTotal - requiredTotal,
  };
}
