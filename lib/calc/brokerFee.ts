import {
  BROKER_FEE_FALLBACK_REGION,
  BROKER_FEE_REGION_BY_ID,
  brokerFeeBracketsForRegion,
  type BrokerFeeRegionId,
  type BrokerFeeRegionProfile,
} from '@/data/brokerFeeRegions';
import type { BrokerFeeBracket } from '@/data/brokerFeeRates';

export type BrokerFeeResult = {
  amount: number;
  /** 적용 상한요율 */
  rate: number;
  /** 해당 구간 한도액 */
  cap: number | null;
  /** 한도액으로 금액이 제한됐는지 */
  capApplied: boolean;
  bracket: BrokerFeeBracket;
  region: BrokerFeeRegionProfile;
  regionId: BrokerFeeRegionId | null;
};

function findBrokerFeeBracket(
  sellPrice: number,
  brackets: BrokerFeeBracket[],
): BrokerFeeBracket {
  for (const bracket of brackets) {
    if (sellPrice < bracket.max) return bracket;
  }
  return brackets[brackets.length - 1];
}

export type CalcBrokerFeeOptions = {
  regionId?: BrokerFeeRegionId | null;
  regionProfile?: BrokerFeeRegionProfile;
};

/**
 * 매도가·소재지 시·도 기준 주택 매매 중개보수 상한액.
 * @param sellPrice - 매도가(원)
 * @param options - regionId 또는 regionProfile (inferBrokerFeeRegion 결과)
 */
export function calcBrokerFee(
  sellPrice: number,
  options: CalcBrokerFeeOptions = {},
): BrokerFeeResult {
  const brackets = brokerFeeBracketsForRegion(options.regionId);
  const region =
    options.regionProfile ??
    (options.regionId
      ? BROKER_FEE_REGION_BY_ID[options.regionId]
      : BROKER_FEE_FALLBACK_REGION);

  if (sellPrice <= 0) {
    const bracket = brackets[0];
    return {
      amount: 0,
      rate: 0,
      cap: bracket.cap,
      capApplied: false,
      bracket,
      region,
      regionId: options.regionId ?? null,
    };
  }

  const bracket = findBrokerFeeBracket(sellPrice, brackets);
  const raw = sellPrice * bracket.rate;
  const capped = bracket.cap != null ? Math.min(raw, bracket.cap) : raw;

  return {
    amount: Math.round(capped),
    rate: bracket.rate,
    cap: bracket.cap,
    capApplied: bracket.cap != null && raw > bracket.cap,
    bracket,
    region,
    regionId: options.regionId ?? null,
  };
}

/**
 * 매도가 구간 상한요율 (한도 미반영, 표시용).
 */
export function brokerFeeRate(
  sellPrice: number,
  regionId?: BrokerFeeRegionId | null,
): number {
  if (sellPrice <= 0) return 0;
  const brackets = brokerFeeBracketsForRegion(regionId);
  return findBrokerFeeBracket(sellPrice, brackets).rate;
}

/** 비용 항목 note 문구 */
export function brokerFeeNote(result: BrokerFeeResult): string {
  const pct = (result.rate * 100).toFixed(1);
  let note = `주택 매매 ${result.region.shortName} 상한 ${pct}% (${result.bracket.label})`;
  note += ` · ${result.region.ordinance}`;
  if (result.capApplied && result.cap != null) {
    note += ` · 한도 ${result.cap.toLocaleString('ko-KR')}원 적용`;
  }
  note += ' — VAT 별도';
  return note;
}
