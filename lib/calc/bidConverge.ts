import type { EntryMatchInputs } from '@/types/case';
import type { CalcBrokerFeeOptions } from './brokerFee';
import { effectiveSellPrice } from './buildingVat';
import type { BidCalcResult } from './bidCalculator';
import { calcInvestedCapital, calcNetYield } from './bidCalculator';
import {
  acquisitionContextFromPolicy,
  loanPrincipalAtBid,
  resolveBidPolicy,
  type ResolvedBidPolicy,
} from './bidPolicy';
import {
  calcFarmTaxWon,
  farmTaxApplies,
  type PropertySizeClass,
  type PropertySizeMode,
} from './buildingVat';
import {
  calcCostItems,
  profitDetailedTotal,
  type ConditionalCostsWon,
  type CostItemsResult,
  type HousingBondCostInput,
} from './costItems';
import {
  calcLocalIncomeTaxOnTransferTax,
  calcNetProfitAfterBusinessTax,
  calcPreTaxProfit,
  calcTradingBusinessTransferTax,
} from './tradingTax';

export type ConvergeBidParams = {
  sellPrice: number;
  months: number;
  loanRate: number;
  /** 중도상환수수료율(비율, 예: 0.0041) — 미전달 시 DEFAULT_PREPAY */
  prepayRate?: number;
  margin: number;
  conditionalExtra: number;
  buildingVat: number;
  propertySize?: PropertySizeClass;
  exclusiveAreaM2?: number | null;
  propertySizeMode?: PropertySizeMode;
  conditionalWon?: ConditionalCostsWon;
  housingBond?: HousingBondCostInput | null;
  brokerFeeRegion?: CalcBrokerFeeOptions;
  maxIterations?: number;
  /** 제1장 입찰 조건 — 미전달 시 무주택·LTV 70% 가정 */
  entryInputs?: Partial<EntryMatchInputs> | null;
};

export type ConvergedBid = BidCalcResult & {
  costs: CostItemsResult;
  policy: ResolvedBidPolicy;
  marginTargetAmt: number;
};

/** 입찰가 역산용 — 건물분 부가세는 실질매도가·세전수익에서만 차감 */
export function requiredCostForBid(
  requiredTotal: number,
  buildingVat: number,
): number {
  return requiredTotal - Math.max(0, buildingVat);
}

function interestAtBid(
  bidPrice: number,
  loanRate: number,
  months: number,
  policy: ResolvedBidPolicy,
): { loanPrincipal: number; interestCost: number } {
  const loanPrincipal = loanPrincipalAtBid(bidPrice, policy);
  const interestCost = loanPrincipal * loanRate * (months / 12);
  return { loanPrincipal, interestCost };
}

function conditionalWithAutoFarm(
  bidPrice: number,
  propertySize: PropertySizeClass,
  conditionalWon: ConditionalCostsWon,
  exclusiveAreaM2?: number | null,
  propertySizeMode: PropertySizeMode = 'auto',
): ConditionalCostsWon {
  if (
    !farmTaxApplies(propertySize, exclusiveAreaM2, propertySizeMode) ||
    bidPrice <= 0
  ) {
    return conditionalWon;
  }
  return { ...conditionalWon, farm: calcFarmTaxWon(bidPrice) };
}

/** 상세비용 100% 역산 — 매도가 − 상세합 − 목표수익 */
export function bidFromDetailedCosts(
  sellPrice: number,
  marginAmt: number,
  detailedTotal: number,
): number {
  return Math.max(0, sellPrice - detailedTotal - marginAmt);
}

/** 역산에 실제 반영된 비용 (= 매도가 − 목표수익 − 입찰가) */
export function effectiveCostInBid(
  sellPrice: number,
  marginAmt: number,
  bidPrice: number,
): number {
  return Math.max(0, sellPrice - marginAmt - bidPrice);
}

function convergeBidPrice(
  params: ConvergeBidParams,
  marginAmt: number,
  vatAmt: number,
  policy: ResolvedBidPolicy,
): number {
  const {
    sellPrice,
    months,
    loanRate,
    prepayRate,
    conditionalExtra,
    propertySize = 'standard',
    exclusiveAreaM2,
    propertySizeMode = 'auto',
    conditionalWon = {},
    housingBond = null,
    brokerFeeRegion = {},
    buildingVat,
    maxIterations = 24,
  } = params;
  const taxCtx = acquisitionContextFromPolicy(policy);

  let bidPrice = Math.max(
    0,
    sellPrice * (1 - params.margin) - conditionalExtra,
  );
  let costs!: CostItemsResult;

  for (let i = 0; i < maxIterations; i++) {
    const { loanPrincipal, interestCost } = interestAtBid(
      bidPrice,
      loanRate,
      months,
      policy,
    );
    costs = calcCostItems(
      bidPrice,
      sellPrice,
      interestCost,
      loanPrincipal,
      months,
      loanRate,
      prepayRate,
      undefined,
      conditionalWithAutoFarm(
        bidPrice,
        propertySize,
        conditionalWon,
        exclusiveAreaM2,
        propertySizeMode,
      ),
      housingBond,
      brokerFeeRegion,
      buildingVat,
      propertySize,
      taxCtx,
    );
    const requiredForBid = requiredCostForBid(costs.requiredTotal, vatAmt);
    const detailedTotal = requiredForBid + costs.conditionalTotal;
    const nextBid = bidFromDetailedCosts(sellPrice, marginAmt, detailedTotal);
    if (Math.abs(nextBid - bidPrice) < 1) {
      bidPrice = nextBid;
      break;
    }
    bidPrice = nextBid;
  }

  return bidPrice;
}

/**
 * 필수·조건부 상세 비용 합계를 입찰가 역산에 반영합니다.
 * 이자·취득세 등이 낙찰가에 연동되므로 고정점까지 반복합니다.
 */
export function convergeBid(params: ConvergeBidParams): ConvergedBid {
  const {
    sellPrice,
    months,
    loanRate,
    prepayRate,
    margin,
    conditionalExtra,
    buildingVat,
    propertySize = 'standard',
    exclusiveAreaM2,
    propertySizeMode = 'auto',
    conditionalWon = {},
    housingBond = null,
    brokerFeeRegion = {},
  } = params;

  const policy = resolveBidPolicy(
    params.entryInputs,
    params.entryInputs == null,
  );
  const taxCtx = acquisitionContextFromPolicy(policy);
  const marginAmt = sellPrice * margin;
  const vatAmt = Math.max(0, buildingVat);

  const bidPrice = convergeBidPrice(params, marginAmt, vatAmt, policy);

  const { loanPrincipal, interestCost } = interestAtBid(
    bidPrice,
    loanRate,
    months,
    policy,
  );
  const costs = calcCostItems(
    bidPrice,
    sellPrice,
    interestCost,
    loanPrincipal,
    months,
    loanRate,
    prepayRate,
    undefined,
    conditionalWithAutoFarm(
      bidPrice,
      propertySize,
      conditionalWon,
      exclusiveAreaM2,
      propertySizeMode,
    ),
    housingBond,
    brokerFeeRegion,
    buildingVat,
    propertySize,
    taxCtx,
  );

  const costAmt = effectiveCostInBid(sellPrice, marginAmt, bidPrice);
  const effectiveSell = effectiveSellPrice(sellPrice, vatAmt);
  const profitDetailed = profitDetailedTotal(costs, vatAmt);
  const grossProfit = calcPreTaxProfit(
    effectiveSell,
    bidPrice,
    profitDetailed,
  );
  const transferTax = calcTradingBusinessTransferTax(grossProfit);
  const localIncomeTax = calcLocalIncomeTaxOnTransferTax(transferTax);
  const netProfit = calcNetProfitAfterBusinessTax(grossProfit, transferTax);
  const invested = calcInvestedCapital(bidPrice, loanPrincipal, profitDetailed);
  const netYield = calcNetYield(netProfit, invested);
  const prepayFee = costs.items.find((i) => i.key === 'prepay')?.amount ?? 0;

  return {
    bidPrice,
    grossProfit,
    transferTax,
    localIncomeTax,
    netProfit,
    netYield,
    loanPrincipal,
    interestCost,
    invested,
    costAmt,
    conditionalExtra,
    buildingVat: vatAmt,
    effectiveSellPrice: effectiveSell,
    financeFreeDetailed: profitDetailed - interestCost - prepayFee,
    profitDetailedTotal: profitDetailed,
    ltvApplied: policy.ltvRate,
    loanBadge: policy.loanBadge,
    loanBadgeTone: policy.loanBadgeTone,
    marginTargetAmt: marginAmt,
    costs,
    policy,
  };
}
