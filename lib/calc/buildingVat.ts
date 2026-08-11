/** 국민주택 규모 — 전용면적 84㎡ 이하 */
export const NATIONAL_HOUSING_EXCLUSIVE_AREA_M2 = 84;

/** 농어촌특별세 면제 기준 — 전용 85㎡ 이하 */
export const FARM_TAX_EXCLUSIVE_AREA_M2 = 85;

export type PropertySizeClass = 'standard' | 'large';

/** auto: 전용면적 기준 자동, standard/large: 수동 고정 */
export type PropertySizeMode = 'auto' | 'standard' | 'large';

export type BuildingVatCalcMode = 'direct' | 'standards';

export type BuildingVatInput = {
  sellPrice: number;
  landStandardPrice: number;
  buildingStandardPrice: number;
};

export type BuildingVatResult = {
  vatAmount: number;
  vatRateOfSell: number;
  landPortion: number;
  buildingPortion: number;
  buildingVatBase: number;
};

/**
 * 대형(84㎡ 초과) 건물분 부가세 — V11 세금 탭 J12 공식.
 * 매도가를 토지/건물 기준시가 비율로 안분한 뒤 건물분 10% VAT.
 */
export function calcBuildingVatFromStandards(
  input: BuildingVatInput,
): BuildingVatResult {
  const { sellPrice, landStandardPrice, buildingStandardPrice } = input;

  if (sellPrice <= 0) {
    return {
      vatAmount: 0,
      vatRateOfSell: 0,
      landPortion: 0,
      buildingPortion: 0,
      buildingVatBase: 0,
    };
  }

  const buildingVatBase = buildingStandardPrice * 0.1;
  const denominator =
    landStandardPrice + buildingStandardPrice + buildingVatBase;

  if (denominator <= 0) {
    return {
      vatAmount: 0,
      vatRateOfSell: 0,
      landPortion: 0,
      buildingPortion: 0,
      buildingVatBase: 0,
    };
  }

  const landPortion = (sellPrice * landStandardPrice) / denominator;
  const buildingPortion = (sellPrice * buildingStandardPrice) / denominator;
  const vatAmount = (sellPrice * buildingVatBase) / denominator;

  return {
    vatAmount,
    vatRateOfSell: vatAmount / sellPrice,
    landPortion,
    buildingPortion,
    buildingVatBase,
  };
}

/** 토지면적 × ㎡당 공시지가 */
export function calcLandStandardPrice(
  landAreaM2: number,
  landUnitPricePerM2: number,
): number {
  if (landAreaM2 <= 0 || landUnitPricePerM2 <= 0) return 0;
  return landAreaM2 * landUnitPricePerM2;
}

export function isLargeByExclusiveArea(exclusiveAreaM2: number): boolean {
  return exclusiveAreaM2 > NATIONAL_HOUSING_EXCLUSIVE_AREA_M2;
}

export function resolvePropertySizeClass(
  mode: PropertySizeMode,
  exclusiveAreaM2?: number | null,
): PropertySizeClass {
  if (mode === 'standard' || mode === 'large') return mode;
  if (exclusiveAreaM2 == null || exclusiveAreaM2 <= 0) return 'standard';
  return isLargeByExclusiveArea(exclusiveAreaM2) ? 'large' : 'standard';
}

export function effectiveSellPrice(
  sellPrice: number,
  buildingVatAmount: number,
): number {
  return Math.max(0, sellPrice - Math.max(0, buildingVatAmount));
}

/** 전용 85㎡ 초과 시 농어촌특별세 (낙찰가 × 0.2%) */
export function suggestFarmTaxWon(
  bidPrice: number,
  exclusiveAreaM2?: number | null,
): number {
  if (bidPrice <= 0) return 0;
  if (exclusiveAreaM2 == null || exclusiveAreaM2 <= FARM_TAX_EXCLUSIVE_AREA_M2) {
    return 0;
  }
  return bidPrice * 0.002;
}

/** 매도가 대비 부가세율 — 추천 4% 이하, 보통 4.5% 이하, 비추천 4.5% 초과 */
export const BUILDING_VAT_RATE_RECOMMENDED_MAX = 0.04;
export const BUILDING_VAT_RATE_NORMAL_MAX = 0.045;

export type BuildingVatRateVerdict = 'recommended' | 'normal' | 'notRecommended';

export function buildingVatRateOfSell(
  sellPrice: number,
  vatAmount: number,
): number {
  if (sellPrice <= 0 || vatAmount <= 0) return 0;
  return vatAmount / sellPrice;
}

export function buildingVatRateVerdict(
  vatRateOfSell: number,
): BuildingVatRateVerdict | null {
  if (vatRateOfSell <= 0) return null;
  if (vatRateOfSell <= BUILDING_VAT_RATE_RECOMMENDED_MAX) return 'recommended';
  if (vatRateOfSell <= BUILDING_VAT_RATE_NORMAL_MAX) return 'normal';
  return 'notRecommended';
}

export function buildingVatRateVerdictFromAmount(
  sellPrice: number,
  vatAmount: number,
): BuildingVatRateVerdict | null {
  return buildingVatRateVerdict(buildingVatRateOfSell(sellPrice, vatAmount));
}

export function buildingVatVerdictLabel(
  verdict: BuildingVatRateVerdict,
): string {
  if (verdict === 'recommended') return '추천 물건';
  if (verdict === 'normal') return '보통 물건';
  return '비추천 물건';
}

export function buildingVatVerdictBadgeTone(
  verdict: BuildingVatRateVerdict,
): 'ok' | 'mid' | 'warn' {
  if (verdict === 'recommended') return 'ok';
  if (verdict === 'normal') return 'mid';
  return 'warn';
}

export function propertySizeLabel(size: PropertySizeClass): string {
  return size === 'large' ? '대형 (84㎡ 초과)' : '국평 이하 (84㎡ 이하)';
}

export type ResolveBuildingVatParams = {
  propertySize: PropertySizeClass;
  sellPrice: number;
  calcMode: BuildingVatCalcMode;
  directVatWon?: number;
  landAreaM2?: number;
  landUnitPricePerM2?: number;
  buildingStandardPrice?: number;
};

/** 대형일 때만 건물분 부가세 금액을 산출합니다. */
export function resolveBuildingVatWon(params: ResolveBuildingVatParams): number {
  if (params.propertySize !== 'large' || params.sellPrice <= 0) return 0;

  if (params.calcMode === 'direct') {
    return Math.max(0, params.directVatWon ?? 0);
  }

  const landStandard = calcLandStandardPrice(
    params.landAreaM2 ?? 0,
    params.landUnitPricePerM2 ?? 0,
  );
  const buildingStandard = params.buildingStandardPrice ?? 0;
  if (landStandard <= 0 || buildingStandard <= 0) {
    return Math.max(0, params.directVatWon ?? 0);
  }

  return calcBuildingVatFromStandards({
    sellPrice: params.sellPrice,
    landStandardPrice: landStandard,
    buildingStandardPrice: buildingStandard,
  }).vatAmount;
}
