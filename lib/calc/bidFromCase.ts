import type { CaseFile } from '@/types/case';
import { calcBid } from './bidCalculator';
import { sumConditionalCostsWon } from './costItems';

type BidCalcSaved = NonNullable<CaseFile['bidCalcInputs']>;

/** 사건에 저장된 입찰가 계산 입력으로 역산 결과를 만듭니다. */
export function bidResultFromSaved(saved: BidCalcSaved | undefined) {
  if (!saved) return null;

  const conditionalExtra = sumConditionalCostsWon({
    unpaid:
      saved.unpaidMgmtFeeMan != null
        ? saved.unpaidMgmtFeeMan * 10_000
        : undefined,
    farm:
      saved.farmTaxMan != null ? saved.farmTaxMan * 10_000 : undefined,
    repair:
      saved.repairCostMan != null ? saved.repairCostMan * 10_000 : undefined,
    force:
      saved.forceExecCostMan != null
        ? saved.forceExecCostMan * 10_000
        : undefined,
  });

  return calcBid({
    sellPrice: saved.sellPrice,
    months: saved.months,
    loanRate: saved.loanRate / 100,
    margin: saved.margin / 100,
    costRate: saved.costRate,
    conditionalExtra,
  });
}
