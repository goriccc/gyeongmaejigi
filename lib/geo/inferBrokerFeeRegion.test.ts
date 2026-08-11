import { describe, expect, it } from 'vitest';
import { inferBrokerFeeRegion } from './inferBrokerFeeRegion';

describe('inferBrokerFeeRegion', () => {
  it('소재지 접두사로 시·도 추정', () => {
    const r = inferBrokerFeeRegion({
      address: '전북특별자치도 전주시 덕진구 …',
    });
    expect(r.regionId).toBe('jeonbuk');
    expect(r.source).toBe('address');
    expect(r.profile.shortName).toBe('전북');
  });

  it('경기도·강원특별자치도 등 다양한 표기', () => {
    expect(
      inferBrokerFeeRegion({ address: '경기도 성남시 분당구' }).regionId,
    ).toBe('gyeonggi');
    expect(
      inferBrokerFeeRegion({ address: '강원특별자치도 춘천시' }).regionId,
    ).toBe('gangwon');
    expect(
      inferBrokerFeeRegion({ address: '제주특별자치도 제주시' }).regionId,
    ).toBe('jeju');
  });

  it('관할법원명으로 추정', () => {
    const r = inferBrokerFeeRegion({
      courtName: '수원지방법원 성남지원',
    });
    expect(r.regionId).toBe('gyeonggi');
    expect(r.source).toBe('court');
  });

  it('소재지가 있으면 법원보다 소재지 우선', () => {
    const r = inferBrokerFeeRegion({
      address: '전북특별자치도 전주시',
      courtName: '서울중앙지방법원',
    });
    expect(r.regionId).toBe('jeonbuk');
    expect(r.source).toBe('address');
  });

  it('미확인 시 전국 표준 fallback', () => {
    const r = inferBrokerFeeRegion({});
    expect(r.regionId).toBeNull();
    expect(r.source).toBe('fallback');
    expect(r.profile.shortName).toBe('전국');
  });
});
