import { describe, expect, it } from 'vitest';
import {
  buildFieldRoutePlan,
  filterRoutableCases,
  haversineM,
  moveCaseBetweenDays,
  optimizeVisitOrder,
  packCasesByDailyCount,
  packCasesByRegion,
} from '@/lib/field/routePlanner';
import type { CaseFile } from '@/types/case';

function mockCase(
  id: string,
  lat: number,
  lng: number,
  auctionDate: string,
  address = '서울특별시 중구 세종대로 110',
): CaseFile {
  return {
    id,
    name: id,
    caseNumber: '2026타경1',
    stage: 'C',
    track: 'bidding',
    appraisalValue: 0,
    auctionDate,
    latitude: lat,
    longitude: lng,
    address,
    riskFlags: [],
    checklist: [],
  };
}

describe('routePlanner', () => {
  it('packCasesByDailyCount splits by deadline order', () => {
    const cases = [
      mockCase('a', 37.5, 127.0, '2027-03-01'),
      mockCase('b', 37.51, 127.01, '2027-03-05'),
      mockCase('c', 37.52, 127.02, '2027-03-10'),
    ];
    const packed = packCasesByDailyCount(cases, 2);
    expect(packed).toHaveLength(2);
    expect(packed[0]!.map((c) => c.id)).toEqual(['a', 'b']);
    expect(packed[1]!.map((c) => c.id)).toEqual(['c']);
  });

  it('optimizeVisitOrder prefers nearest neighbor from start', () => {
    const start = { lat: 37.5665, lng: 126.978 };
    const stops = [
      {
        caseId: 'far',
        order: 1,
        lat: 37.6,
        lng: 127.1,
        name: 'far',
        caseNumber: '',
        auctionDate: '',
      },
      {
        caseId: 'near',
        order: 2,
        lat: 37.567,
        lng: 126.979,
        name: 'near',
        caseNumber: '',
        auctionDate: '',
      },
    ];
    const ordered = optimizeVisitOrder(stops, start);
    expect(ordered[0]!.caseId).toBe('near');
  });

  it('buildFieldRoutePlan groups all routable cases', () => {
    const cases = [
      mockCase('a', 37.5, 127.0, '2027-03-01'),
      mockCase('b', 37.51, 127.01, '2027-03-05'),
    ];
    const plan = buildFieldRoutePlan(cases, 3);
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0]!.stops).toHaveLength(2);
  });

  it('haversineM returns positive distance', () => {
    const d = haversineM(
      { lat: 37.5665, lng: 126.978 },
      { lat: 37.5172, lng: 127.0473 },
    );
    expect(d).toBeGreaterThan(5000);
  });

  it('낙찰 사건은 임장 동선에서 제외한다', () => {
    const won = mockCase('won', 37.5, 127.0, '2027-02-01');
    won.bidOutcome = 'won';
    const prep = mockCase('prep', 37.51, 127.01, '2027-03-10');
    const { routable } = filterRoutableCases([won, prep]);
    expect(routable.map((c) => c.id)).toEqual(['prep']);
  });

  it('유사지역 우선은 시·군·구끼리 모은 뒤 하루 건수로 자른다', () => {
    // 고양(출발지 근처) vs 평택(멀리) — 마감일이 섞여 있어도 권역이 먼저
    const goyangStart = { lat: 37.658, lng: 126.832 };
    const cases = [
      mockCase(
        'py1',
        36.99,
        127.09,
        '2027-03-01',
        '경기도 평택시 소사벌로 1',
      ),
      mockCase(
        'gy1',
        37.655,
        126.83,
        '2027-03-05',
        '경기도 고양시 덕양구 행신동 1',
      ),
      mockCase(
        'gy2',
        37.66,
        126.84,
        '2027-03-10',
        '경기도 고양시 덕양구 화정동 2',
      ),
      mockCase(
        'py2',
        37.0,
        127.1,
        '2027-03-12',
        '경기도 평택시 고덕로 2',
      ),
    ];
    const packed = packCasesByRegion(cases, 3, goyangStart);
    const flat = packed.flat().map((c) => c.id);
    // 고양 권역이 평택보다 앞에 오고, 권역 내부는 마감일 순
    expect(flat.indexOf('gy1')).toBeLessThan(flat.indexOf('py1'));
    expect(flat.indexOf('gy1')).toBeLessThan(flat.indexOf('gy2'));
    expect(flat.indexOf('py1')).toBeLessThan(flat.indexOf('py2'));
  });

  it('직접 설정에서 사건을 다른 날로 옮긴다', () => {
    const moved = moveCaseBetweenDays(
      [
        ['a', 'b'],
        ['c'],
      ],
      'b',
      0,
      1,
    );
    expect(moved).toEqual([['a'], ['c', 'b']]);
  });

  it('region 모드 plan에 regionLabel이 붙는다', () => {
    const plan = buildFieldRoutePlan(
      [
        mockCase(
          'a',
          37.65,
          126.83,
          '2027-03-01',
          '경기도 고양시 덕양구 행신동 1',
        ),
        mockCase(
          'b',
          37.66,
          126.84,
          '2027-03-02',
          '경기도 고양시 덕양구 화정동 2',
        ),
      ],
      { dailyCount: 3, packMode: 'region', startPoint: { lat: 37.65, lng: 126.83 } },
    );
    expect(plan.packMode).toBe('region');
    expect(plan.days[0]!.regionLabel).toContain('고양시');
  });
});
