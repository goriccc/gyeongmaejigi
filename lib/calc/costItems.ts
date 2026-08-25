import {
  DEFAULT_PREPAY,
  FIXED_COSTS,
} from '@/data/taxTable';
import {
  brokerFeeNote,
  calcBrokerFee,
  type CalcBrokerFeeOptions,
} from './brokerFee';
import {
  acquisitionTaxRate,
  eduTaxRate,
  firstTimeTaxDeduction,
  type HouseCount,
  type RegZone,
} from './acquisitionTax';
import type { AcquisitionTaxContext } from './bidPolicy';
import {
  buildingVatRateVerdictFromAmount,
  buildingVatVerdictLabel,
  type PropertySizeClass,
} from './buildingVat';

export { brokerFeeRate } from './brokerFee';

export type CostItem = {
  key: string;
  name: string;
  note: string;
  amount: number | null;
  rate: number | null;
  kind: 'required' | 'conditional';
};

export type ConditionalCostsWon = {
  unpaid?: number;
  evict?: number;
  farm?: number;
  miscOther?: number;
  repair?: number;
  force?: number;
};

export type HousingBondCostInput = {
  customerBurden: number;
  note: string;
};

export type CostItemsTaxOptions = Partial<AcquisitionTaxContext>;

/** 조건부 비용 4종 합계(원) */
export function sumConditionalCostsWon(
  conditional: ConditionalCostsWon = {},
): number {
  return (
    (conditional.unpaid ?? 0) +
    (conditional.evict ?? 0) +
    (conditional.farm ?? 0) +
    (conditional.miscOther ?? 0) +
    (conditional.repair ?? 0) +
    (conditional.force ?? 0)
  );
}

export type CostItemsResult = {
  items: CostItem[];
  requiredTotal: number;
  conditionalTotal: number;
  detailedTotal: number;
  approxTotal: number;
  diff: number;
};

/**
 * 입찰가·매도가 기준 비용 항목 13종을 계산합니다.
 * @param bid - 입찰가(원)
 * @param sell - 매도가(원)
 * @param interestCost - 금융비용(원)
 * @param loanPrincipal - 대출원금(원)
 * @param months - 보유개월
 * @param loanRate - 대출이자율(비율)
 * @param prepayRate - 중도상환수수료율 (기본 가정값)
 * @param prepayPeriod - 적용기간(개월)
 * @param conditional - 조건부 비용 (원)
 * @param housingBond - 국민주택채권 즉시매도 본인부담금 (공시가 기준)
 * @param brokerFeeRegion - 중개보수 조례 시·도 (inferBrokerFeeRegion 결과)
 */
export function calcCostItems(
  bid: number,
  sell: number,
  interestCost: number,
  loanPrincipal: number,
  months: number,
  loanRate: number,
  prepayRate = DEFAULT_PREPAY.rate,
  prepayPeriod = DEFAULT_PREPAY.periodMonths,
  conditional: ConditionalCostsWon = {},
  housingBond: HousingBondCostInput | null = null,
  brokerFeeRegion: CalcBrokerFeeOptions = {},
  buildingVat = 0,
  propertySize: PropertySizeClass = 'standard',
  taxOptions: CostItemsTaxOptions = {},
): CostItemsResult {
  const houseCount = (taxOptions.houseCount ?? 0) as HouseCount;
  const regZone = (taxOptions.regZone ?? 'none') as RegZone;
  const lowPriceException = taxOptions.lowPriceException ?? false;
  const dispositionPlanned = taxOptions.dispositionPlanned ?? false;
  const firstTimeBuyer = taxOptions.firstTimeBuyer ?? false;
  const taxRate = acquisitionTaxRate(
    bid,
    houseCount,
    regZone,
    lowPriceException,
    dispositionPlanned,
  );
  const taxRaw = bid * taxRate;
  const taxDeduction = firstTimeTaxDeduction(firstTimeBuyer, bid, taxRaw);
  const taxAmt = taxRaw - taxDeduction;
  const taxNote =
    taxDeduction > 0
      ? `생애최초 감면 ${Math.round(taxDeduction / 10_000)}만원 반영`
      : houseCount >= 2
        ? `다주택 중과 ${(taxRate * 100).toFixed(0)}% (제1장 주택수·규제 반영)`
        : houseCount === 1 && regZone === 'adjusted'
          ? `규제지역 1주택 ${(taxRate * 100).toFixed(0)}%`
          : '낙찰가 구간별 누진 (6억 이하 1% · 6~9억 구간 1~3% · 9억 초과 3%)';
  const eduRate = eduTaxRate(bid, taxRate);
  const eduAmt = bid * eduRate;
  const prepayFee =
    loanPrincipal *
    prepayRate *
    Math.max(0, (prepayPeriod - months) / prepayPeriod);
  const broker = calcBrokerFee(sell, brokerFeeRegion);
  const bondAmount =
    housingBond != null ? housingBond.customerBurden : FIXED_COSTS.housingBond;
  const bondNote =
    housingBond?.note ??
    '시가표준액 기준 매입률 고시에 따름 — 150만원 가정치';

  const items: CostItem[] = [
    {
      key: 'tax',
      name: '취득세',
      note: taxNote,
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
      note: bondNote,
      amount: bondAmount,
      rate: null,
      kind: 'required',
    },
    {
      key: 'interest',
      name: '금융비용 (경락대출 이자)',
      note: '제1장 LTV 기준 대출원금 × 이자율 × 보유개월 — 위 대출이자율 슬라이더에 연동',
      amount: interestCost,
      rate: loanRate,
      kind: 'required',
    },
    {
      key: 'prepay',
      name: '중도상환수수료',
      note: '대출원금 × 수수료율 × (적용기간 − 보유개월) ÷ 적용기간 — 위 중도상환수수료율 슬라이더에 연동 (적용기간 36개월)',
      amount: prepayFee,
      rate: prepayRate,
      kind: 'required',
    },
    {
      key: 'broker',
      name: '중개보수 (매도시)',
      note: brokerFeeNote(broker),
      amount: broker.amount,
      rate: broker.rate,
      kind: 'required',
    },
    {
      key: 'cancellation',
      name: '말소비',
      note: '등기 말소 — 10만원 가정치',
      amount: FIXED_COSTS.cancellation,
      rate: null,
      kind: 'required',
    },
    ...(buildingVat > 0
      ? [
          {
            key: 'buildingVat',
            name: '건물분 부가세 (대형)',
            note: (() => {
              const base =
                '전용 84㎡ 초과 단타 — 매수자 명의이나 실무상 낙찰자 부담 가정. 매도가 대비 약 3~4%';
              const verdict = buildingVatRateVerdictFromAmount(
                sell,
                buildingVat,
              );
              if (!verdict) return base;
              return `${base} · ${buildingVatVerdictLabel(verdict)}`;
            })(),
            amount: buildingVat,
            rate: sell > 0 ? buildingVat / sell : null,
            kind: 'required' as const,
          },
        ]
      : []),
    ...(propertySize === 'large'
      ? [
          {
            key: 'farm',
            name: '농어촌특별세',
            note: '전용 85㎡ 초과 대형 — 낙찰가×0.2% (85㎡ 이하는 면제)',
            amount: conditional.farm ?? 0,
            rate:
              conditional.farm && bid > 0 ? conditional.farm / bid : null,
            kind: 'required' as const,
          },
        ]
      : []),
    {
      key: 'unpaid',
      name: '미납관리비',
      note: '물건별로 다름 — 확인되면 입찰가에서 선반영 권장',
      amount: conditional.unpaid ?? null,
      rate: null,
      kind: 'conditional',
    },
    {
      key: 'evict',
      name: '명도비',
      note: '평균 250~300만원 (32평 기준) — 원 단위 입력',
      amount: conditional.evict ?? null,
      rate: null,
      kind: 'conditional',
    },
    {
      key: 'miscOther',
      name: '기타비용',
      note: '교통비·명도 선물·입주청소 등 — 기본 30만원',
      amount: conditional.miscOther ?? null,
      rate: null,
      kind: 'conditional',
    },
    {
      key: 'repair',
      name: '수리비',
      note: '임장에서 확인된 상태에 따라 다름',
      amount: conditional.repair ?? null,
      rate: null,
      kind: 'conditional',
    },
    {
      key: 'force',
      name: '강제집행비',
      note: '평균 10건 중 1건 발생, 발생시 600~700만원 — 사전 반영 불가',
      amount: conditional.force ?? null,
      rate: null,
      kind: 'conditional',
    },
  ];

  const requiredTotal = items
    .filter((i) => i.kind === 'required' && i.amount != null)
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const conditionalTotal = items
    .filter((i) => i.kind === 'conditional' && i.amount != null)
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const detailedTotal = requiredTotal + conditionalTotal;

  return {
    items,
    requiredTotal,
    conditionalTotal,
    detailedTotal,
    approxTotal: detailedTotal,
    diff: 0,
  };
}

/** 금융비용(이자·중도상환) 제외 상세비용 — 대출상품별 재계산용 */
export function financeFreeDetailedTotal(costs: CostItemsResult): number {
  const interest = costs.items.find((i) => i.key === 'interest')?.amount ?? 0;
  const prepay = costs.items.find((i) => i.key === 'prepay')?.amount ?? 0;
  return costs.detailedTotal - interest - prepay;
}

/**
 * 세전수익 산출용 상세비용.
 * 실질 매도가에서 이미 차감한 건물분 부가세는 required 합계에서 제외합니다.
 */
export function profitDetailedTotal(
  costs: CostItemsResult,
  buildingVat: number,
): number {
  const vat = Math.max(0, buildingVat);
  return Math.max(0, costs.requiredTotal - vat) + costs.conditionalTotal;
}
