import { DEFAULT_MISC_OTHER_WON } from '@/data/taxTable';
import { inferBrokerFeeRegion } from '@/lib/geo/inferBrokerFeeRegion';
import type { CaseFile } from '@/types/case';
import {
  DEFAULT_BID_LOAN_RATE,
  DEFAULT_BID_MARGIN,
} from './bidCalculator';
import { convergeBid } from './bidConverge';
import {
  resolveBuildingVatWon,
  resolvePropertySizeClass,
} from './buildingVat';
import { sumConditionalCostsWon, type ConditionalCostsWon } from './costItems';

type BidCalcSaved = NonNullable<CaseFile['bidCalcInputs']>;

export type LoanCompareBidBasis = {
  bidPrice: number;
  effectiveSellPrice: number;
  financeFreeDetailed: number;
  months: number;
  sellPrice: number;
};

function conditionalWonFromSaved(saved: BidCalcSaved): ConditionalCostsWon {
  return {
    unpaid:
      saved.unpaidMgmtFeeMan != null
        ? saved.unpaidMgmtFeeMan * 10_000
        : undefined,
    evict:
      saved.evictionCostMan != null
        ? saved.evictionCostMan * 10_000
        : undefined,
    miscOther:
      saved.miscOtherCostMan != null
        ? saved.miscOtherCostMan * 10_000
        : DEFAULT_MISC_OTHER_WON,
    repair:
      saved.repairCostMan != null ? saved.repairCostMan * 10_000 : undefined,
    force:
      saved.forceExecCostMan != null
        ? saved.forceExecCostMan * 10_000
        : undefined,
  };
}

function hasBidSnapshot(saved: BidCalcSaved): boolean {
  return (
    saved.bidPrice != null &&
    saved.bidPrice > 0 &&
    saved.effectiveSellPrice != null &&
    saved.financeFreeDetailed != null
  );
}

/** 제5장용 — 낙찰가 또는 제4장 저장값을 사용합니다. */
export function loanCompareBidFromCase(
  caseFile: CaseFile | null | undefined,
): LoanCompareBidBasis | null {
  if (!caseFile) return null;
  const saved = caseFile.bidCalcInputs;
  const winning =
    caseFile.winningBidWon != null && caseFile.winningBidWon > 0
      ? caseFile.winningBidWon
      : undefined;

  if (winning != null) {
    const bidPrice =
      saved?.bidPrice != null && saved.bidPrice > 0 ? saved.bidPrice : winning;
    const sellPrice = saved?.sellPrice != null && saved.sellPrice > 0
      ? saved.sellPrice
      : 0;
    return {
      bidPrice,
      effectiveSellPrice:
        saved?.effectiveSellPrice != null && saved.effectiveSellPrice > 0
          ? saved.effectiveSellPrice
          : sellPrice > 0
            ? sellPrice
            : bidPrice,
      financeFreeDetailed: saved?.financeFreeDetailed ?? 0,
      months: saved?.months && saved.months > 0 ? saved.months : 6,
      sellPrice,
    };
  }

  if (!saved) return null;

  if (hasBidSnapshot(saved)) {
    return {
      bidPrice: saved.bidPrice!,
      effectiveSellPrice: saved.effectiveSellPrice!,
      financeFreeDetailed: saved.financeFreeDetailed!,
      months: saved.months,
      sellPrice: saved.sellPrice,
    };
  }

  const result = bidResultFromSaved(saved, {
    exclusiveAreaM2: caseFile.exclusiveAreaM2,
    entryInputs: caseFile.entryMatchInputs,
    address: caseFile.address,
    courtName: caseFile.courtName,
  });
  if (!result) return null;

  return {
    bidPrice: result.bidPrice,
    effectiveSellPrice: result.effectiveSellPrice,
    financeFreeDetailed: result.financeFreeDetailed,
    months: saved.months,
    sellPrice: saved.sellPrice,
  };
}

export function stubBidCalcFromWinningBid(winningBidWon: number): BidCalcSaved {
  return {
    sellPrice: 0,
    months: 6,
    loanRate: DEFAULT_BID_LOAN_RATE,
    margin: DEFAULT_BID_MARGIN,
    bidPrice: winningBidWon,
    financeFreeDetailed: 0,
  };
}

/** 사건에 저장된 입찰가 계산 입력으로 역산 결과를 만듭니다. */
export function bidResultFromSaved(
  saved: BidCalcSaved | undefined,
  ctx?: {
    exclusiveAreaM2?: number;
    entryInputs?: CaseFile['entryMatchInputs'] | null;
    address?: string;
    courtName?: string;
  },
) {
  if (!saved) return null;

  const exclusiveArea = saved.exclusiveAreaM2 ?? ctx?.exclusiveAreaM2;
  const propertySize = resolvePropertySizeClass(
    saved.propertySizeMode ?? 'auto',
    exclusiveArea,
  );
  const buildingVat = resolveBuildingVatWon({
    propertySize,
    sellPrice: saved.sellPrice,
    calcMode: saved.buildingVatCalcMode ?? 'direct',
    directVatWon:
      saved.buildingVatWon ??
      (saved.buildingVatMan != null
        ? saved.buildingVatMan * 10_000
        : undefined),
    landAreaM2: saved.landAreaM2,
    landUnitPricePerM2: saved.landUnitPricePerM2,
    buildingStandardPrice: saved.buildingStandardPrice,
  });

  const conditionalWon = conditionalWonFromSaved(saved);
  const conditionalExtra = sumConditionalCostsWon(conditionalWon);
  const broker = inferBrokerFeeRegion({
    address: ctx?.address,
    courtName: ctx?.courtName,
  });

  return convergeBid({
    sellPrice: saved.sellPrice,
    months: saved.months,
    loanRate: saved.loanRate / 100,
    margin: saved.margin / 100,
    conditionalExtra,
    buildingVat,
    propertySize,
    exclusiveAreaM2: exclusiveArea,
    propertySizeMode: saved.propertySizeMode ?? 'auto',
    conditionalWon,
    housingBond:
      saved.housingBondBurden != null
        ? { customerBurden: saved.housingBondBurden, note: '' }
        : null,
    brokerFeeRegion: {
      regionId: broker.regionId,
      regionProfile: broker.profile,
    },
    entryInputs: ctx?.entryInputs ?? null,
  });
}
