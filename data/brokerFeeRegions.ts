/**
 * 시·도별 주택 매매 중개보수 조례 (전국)
 *
 * 2022~2023년 개정 이후 17개 시·도 모두 동일 6구간 상한요율·한도액 적용.
 * 출처: 각 시·도 「주택의 중개보수 등에 관한 조례」 별표1 · 마이홈포털
 * 최종 확인: 2026-08
 */

import {
  BROKER_FEE_SALE_BRACKETS,
  type BrokerFeeBracket,
} from './brokerFeeRates';

export type BrokerFeeRegionId =
  | 'seoul'
  | 'busan'
  | 'daegu'
  | 'incheon'
  | 'gwangju'
  | 'daejeon'
  | 'ulsan'
  | 'sejong'
  | 'gyeonggi'
  | 'gangwon'
  | 'chungbuk'
  | 'chungnam'
  | 'jeonbuk'
  | 'jeonnam'
  | 'gyeongbuk'
  | 'gyeongnam'
  | 'jeju';

export type BrokerFeeRegionProfile = {
  id: BrokerFeeRegionId;
  /** 지도·UI용 약칭 (regulatedRegions REGION_TILES 와 동일) */
  shortName: string;
  fullName: string;
  ordinance: string;
  /** 주소 문자열 매칭 (긴 접두사 우선) */
  addressPrefixes: string[];
  /** 법원명 키워드 (지방법원·지원 등) */
  courtKeywords: string[];
};

/** 전국 공통 6구간 (2022.2~ 표준) */
export const BROKER_FEE_STANDARD_BRACKETS: BrokerFeeBracket[] =
  BROKER_FEE_SALE_BRACKETS;

export const BROKER_FEE_REGIONS: BrokerFeeRegionProfile[] = [
  {
    id: 'seoul',
    shortName: '서울',
    fullName: '서울특별시',
    ordinance: '서울특별시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['서울특별시', '서울시', '서울'],
    courtKeywords: ['서울'],
  },
  {
    id: 'busan',
    shortName: '부산',
    fullName: '부산광역시',
    ordinance: '부산광역시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['부산광역시', '부산시', '부산'],
    courtKeywords: ['부산'],
  },
  {
    id: 'daegu',
    shortName: '대구',
    fullName: '대구광역시',
    ordinance: '대구광역시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['대구광역시', '대구시', '대구'],
    courtKeywords: ['대구'],
  },
  {
    id: 'incheon',
    shortName: '인천',
    fullName: '인천광역시',
    ordinance: '인천광역시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['인천광역시', '인천시', '인천'],
    courtKeywords: ['인천'],
  },
  {
    id: 'gwangju',
    shortName: '광주',
    fullName: '광주광역시',
    ordinance: '광주광역시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['광주광역시', '광주시', '광주'],
    courtKeywords: ['광주'],
  },
  {
    id: 'daejeon',
    shortName: '대전',
    fullName: '대전광역시',
    ordinance: '대전광역시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['대전광역시', '대전시', '대전'],
    courtKeywords: ['대전'],
  },
  {
    id: 'ulsan',
    shortName: '울산',
    fullName: '울산광역시',
    ordinance: '울산광역시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['울산광역시', '울산시', '울산'],
    courtKeywords: ['울산'],
  },
  {
    id: 'sejong',
    shortName: '세종',
    fullName: '세종특별자치시',
    ordinance: '세종특별자치시 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['세종특별자치시', '세종시', '세종'],
    courtKeywords: ['세종'],
  },
  {
    id: 'gyeonggi',
    shortName: '경기',
    fullName: '경기도',
    ordinance: '경기도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['경기도', '경기'],
    courtKeywords: ['수원', '의정부', '고양', '남양주', '파주', '성남', '안양'],
  },
  {
    id: 'gangwon',
    shortName: '강원',
    fullName: '강원특별자치도',
    ordinance: '강원특별자치도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: [
      '강원특별자치도',
      '강원도',
      '강원',
    ],
    courtKeywords: ['춘천', '강릉', '원주', '속초'],
  },
  {
    id: 'chungbuk',
    shortName: '충북',
    fullName: '충청북도',
    ordinance: '충청북도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['충청북도', '충북'],
    courtKeywords: ['청주', '충주', '제천'],
  },
  {
    id: 'chungnam',
    shortName: '충남',
    fullName: '충청남도',
    ordinance: '충청남도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['충청남도', '충남'],
    courtKeywords: ['천안', '공주', '논산', '서산', '홍성'],
  },
  {
    id: 'jeonbuk',
    shortName: '전북',
    fullName: '전북특별자치도',
    ordinance: '전북특별자치도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: [
      '전북특별자치도',
      '전라북도',
      '전북',
    ],
    courtKeywords: ['전주', '군산', '익산', '정읍'],
  },
  {
    id: 'jeonnam',
    shortName: '전남',
    fullName: '전라남도',
    ordinance: '전라남도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['전라남도', '전남'],
    courtKeywords: ['목포', '순천', '여수', '광양', '나주'],
  },
  {
    id: 'gyeongbuk',
    shortName: '경북',
    fullName: '경상북도',
    ordinance: '경상북도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['경상북도', '경북'],
    courtKeywords: ['포항', '구미', '안동', '경주', '상주'],
  },
  {
    id: 'gyeongnam',
    shortName: '경남',
    fullName: '경상남도',
    ordinance: '경상남도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['경상남도', '경남'],
    courtKeywords: ['창원', '진주', '통영', '거창', '밀양'],
  },
  {
    id: 'jeju',
    shortName: '제주',
    fullName: '제주특별자치도',
    ordinance: '제주특별자치도 주택의 중개보수 등에 관한 조례',
    addressPrefixes: ['제주특별자치도', '제주도', '제주'],
    courtKeywords: ['제주'],
  },
];

export const BROKER_FEE_REGION_BY_ID = Object.fromEntries(
  BROKER_FEE_REGIONS.map((r) => [r.id, r]),
) as Record<BrokerFeeRegionId, BrokerFeeRegionProfile>;

/** 소재지·법원 미확인 시 적용 (전국 표준 6구간) */
export const BROKER_FEE_FALLBACK_REGION: BrokerFeeRegionProfile = {
  id: 'seoul',
  shortName: '전국',
  fullName: '전국 표준',
  ordinance: '공인중개사법 시행규칙 별표1 (시·도 조례 공통)',
  addressPrefixes: [],
  courtKeywords: [],
};

/** 시·도별 주택 매매·교환 상한요율표 */
export function brokerFeeBracketsForRegion(
  _regionId?: BrokerFeeRegionId | null,
): BrokerFeeBracket[] {
  return BROKER_FEE_STANDARD_BRACKETS;
}
