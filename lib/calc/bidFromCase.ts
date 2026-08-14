import { DEFAULT_MISC_OTHER_WON } from '@/data/taxTable';
import type { CaseFile } from '@/types/case';
import { convergeBid } from './bidConverge';
import {
  resolveBuildingVatWon,
  resolvePropertySizeClass,
} from './buildingVat';
import { sumConditionalCostsWon, type ConditionalCostsWon } from './costItems';

type BidCalcSaved = NonNullable<CaseFile['bidCalcInputs']>;

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

/** 사건에 저장된 입찰가 계산 입력으로 역산 결과를 만듭니다. */
export function bidResultFromSaved(
  saved: BidCalcSaved | undefined,
  caseExclusiveAreaM2?: number,
  entryInputs?: CaseFile['entryMatchInputs'],
) {
  if (!saved) return null;

  const exclusiveArea = saved.exclusiveAreaM2 ?? caseExclusiveAreaM2;
  const propertySize = resolvePropertySizeClass(
    saved.propertySizeMode ?? 'auto',
    exclusiveArea,
  );
  const buildingVat = resolveBuildingVatWon({
    propertySize,
    sellPrice: saved.sellPrice,
    calcMode: saved.buildingVatCalcMode ?? 'direct',
    directVatWon:
      saved.buildingVatMan != null
        ? saved.buildingVatMan * 10_000
        : undefined,
    landAreaM2: saved.landAreaM2,
    landUnitPricePerM2: saved.landUnitPricePerM2,
    buildingStandardPrice: saved.buildingStandardPrice,
  });

  const conditionalWon = conditionalWonFromSaved(saved);
  const conditionalExtra = sumConditionalCostsWon(conditionalWon);

  return convergeBid({
    sellPrice: saved.sellPrice,
    months: saved.months,
    loanRate: saved.loanRate / 100,
    margin: saved.margin / 100,
    costRate: saved.costRate,
    conditionalExtra,
    buildingVat,
    propertySize,
    exclusiveAreaM2: exclusiveArea,
    propertySizeMode: saved.propertySizeMode ?? 'auto',
    conditionalWon,
    entryInputs: entryInputs ?? null,
  });
}
