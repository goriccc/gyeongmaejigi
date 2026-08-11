import { describe, expect, it } from 'vitest';
import {
  calcBuildingVatFromStandards,
  calcLandStandardPrice,
  effectiveSellPrice,
  isLargeByExclusiveArea,
  resolvePropertySizeClass,
  suggestFarmTaxWon,
  buildingVatRateVerdict,
  buildingVatRateVerdictFromAmount,
  buildingVatVerdictLabel,
} from './buildingVat';

/** V11 엑셀 예시 (매도가 511M, 대형 탭) */
const EXCEL_SELL = 511_000_000;
const EXCEL_LAND = 254_327_080;
const EXCEL_BUILDING = 140_059_560;
const EXCEL_VAT = 17_524_910.064726051;

describe('calcBuildingVatFromStandards', () => {
  it('V11 J12 공식과 일치', () => {
    const r = calcBuildingVatFromStandards({
      sellPrice: EXCEL_SELL,
      landStandardPrice: EXCEL_LAND,
      buildingStandardPrice: EXCEL_BUILDING,
    });
    expect(r.vatAmount).toBeCloseTo(EXCEL_VAT, 0);
    expect(r.vatRateOfSell).toBeCloseTo(0.0343, 3);
    expect(r.landPortion + r.buildingPortion + r.vatAmount).toBeCloseTo(
      EXCEL_SELL,
      0,
    );
  });

  it('매도가 0이면 0', () => {
    const r = calcBuildingVatFromStandards({
      sellPrice: 0,
      landStandardPrice: 100,
      buildingStandardPrice: 100,
    });
    expect(r.vatAmount).toBe(0);
  });
});

describe('calcLandStandardPrice', () => {
  it('면적 × 공시지가', () => {
    expect(calcLandStandardPrice(61.67, 4_124_000)).toBeCloseTo(
      EXCEL_LAND,
      0,
    );
  });
});

describe('resolvePropertySizeClass', () => {
  it('auto — 84㎡ 이하는 standard', () => {
    expect(resolvePropertySizeClass('auto', 84)).toBe('standard');
    expect(resolvePropertySizeClass('auto', 84.1)).toBe('large');
  });

  it('면적 없으면 standard', () => {
    expect(resolvePropertySizeClass('auto', undefined)).toBe('standard');
  });

  it('수동 override', () => {
    expect(resolvePropertySizeClass('large', 50)).toBe('large');
    expect(resolvePropertySizeClass('standard', 200)).toBe('standard');
  });
});

describe('isLargeByExclusiveArea', () => {
  it('84 초과만 large', () => {
    expect(isLargeByExclusiveArea(84)).toBe(false);
    expect(isLargeByExclusiveArea(84.01)).toBe(true);
  });
});

describe('effectiveSellPrice', () => {
  it('매도가 − 부가세', () => {
    expect(effectiveSellPrice(EXCEL_SELL, EXCEL_VAT)).toBeCloseTo(
      493_475_089.935,
      0,
    );
  });
});

describe('buildingVatRateVerdict', () => {
  it('4% 이하 추천', () => {
    expect(buildingVatRateVerdict(0.04)).toBe('recommended');
    expect(buildingVatRateVerdict(0.03)).toBe('recommended');
  });

  it('4% 초과 4.5% 이하 보통', () => {
    expect(buildingVatRateVerdict(0.045)).toBe('normal');
    expect(buildingVatRateVerdict(0.042)).toBe('normal');
  });

  it('4.5% 초과 비추천', () => {
    expect(buildingVatRateVerdict(0.046)).toBe('notRecommended');
  });

  it('V11 예시 3.4%는 추천 물건', () => {
    const verdict = buildingVatRateVerdictFromAmount(
      EXCEL_SELL,
      EXCEL_VAT,
    );
    expect(verdict).toBe('recommended');
  });

  it('등급 라벨', () => {
    expect(buildingVatVerdictLabel('recommended')).toBe('추천 물건');
    expect(buildingVatVerdictLabel('normal')).toBe('보통 물건');
    expect(buildingVatVerdictLabel('notRecommended')).toBe('비추천 물건');
  });
});

describe('suggestFarmTaxWon', () => {
  it('85㎡ 이하는 0', () => {
    expect(suggestFarmTaxWon(500_000_000, 85)).toBe(0);
  });

  it('86㎡ 이상은 0.2%', () => {
    expect(suggestFarmTaxWon(500_000_000, 86)).toBe(1_000_000);
  });
});
