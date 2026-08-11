import { describe, expect, it } from 'vitest';
import {
  buildFieldRoutePlan,
  haversineM,
  optimizeVisitOrder,
  packCasesByDailyCount,
} from '@/lib/field/routePlanner';
import type { CaseFile } from '@/types/case';

function mockCase(
  id: string,
  lat: number,
  lng: number,
  auctionDate: string,
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
    address: '서울',
    riskFlags: [],
    checklist: [],
  };
}

describe('routePlanner', () => {
  it('packCasesByDailyCount splits by deadline order', () => {
    const cases = [
      mockCase('a', 37.5, 127.0, '2026-08-01'),
      mockCase('b', 37.51, 127.01, '2026-08-05'),
      mockCase('c', 37.52, 127.02, '2026-08-10'),
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
      mockCase('a', 37.5, 127.0, '2026-08-01'),
      mockCase('b', 37.51, 127.01, '2026-08-05'),
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
});
