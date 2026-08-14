import { APPROX_DETAIL_BLEND } from '@/data/taxTable';
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
  margin: number;
  costRate: number;
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

/**
 * V11 엑셀 E31 — 2차 취득 산정 입찰가.
 * E6 = 매도가 − 개략비용 − 목표수익, E30 = (개략 − 상세)×50%, E31 = E6 + E30 (E30>0).
 */
export function bidFromExcelBlend(
  sellPrice: number,
  marginAmt: number,
  costRate: number,
  detailedTotal: number,
): number {
  const approxTotal = sellPrice * costRate;
  const firstPassBid = sellPrice - approxTotal - marginAmt;
  const blendAdd = Math.max(0, (approxTotal - detailedTotal) * APPROX_DETAIL_BLEND);
  if (blendAdd > 0) {
    return Math.max(0, firstPassBid + blendAdd);
  }
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

/** V11 F33 — 상세(E29) 산출용 앵커 입찰가 (상세 100% 역산) */
function convergeAnchorBid(
  params: ConvergeBidParams,
  marginAmt: number,
  vatAmt: number,
  policy: ResolvedBidPolicy,
): { anchorBid: number; detailedForBlend: number } {
  const {
    sellPrice,
    months,
    loanRate,
    costRate,
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
    sellPrice * (1 - costRate - params.margin) - conditionalExtra,
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
      costRate,
      undefined,
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
    const nextBid = Math.max(
      0,
      sellPrice - requiredForBid - marginAmt - conditionalExtra,
    );
    if (Math.abs(nextBid - bidPrice) < 1) {
      bidPrice = nextBid;
      break;
    }
    bidPrice = nextBid;
  }

  const requiredForBid = requiredCostForBid(costs.requiredTotal, vatAmt);
  return {
    anchorBid: bidPrice,
    detailedForBlend: requiredForBid + costs.conditionalTotal,
  };
}

/**
 * 필수 비용 상세 합계를 입찰가 역산에 반영합니다.
 * 이자·취득세 등이 낙찰가에 연동되므로 고정점까지 반복합니다.
 */
export function convergeBid(params: ConvergeBidParams): ConvergedBid {
  const {
    sellPrice,
    months,
    loanRate,
    margin,
    costRate,
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

  const { detailedForBlend } = convergeAnchorBid(
    params,
    marginAmt,
    vatAmt,
    policy,
  );
  const bidPrice = bidFromExcelBlend(
    sellPrice,
    marginAmt,
    costRate,
    detailedForBlend,
  );

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
    costRate,
    undefined,
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
