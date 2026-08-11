/** 법원 선택 목록 정렬 — 서울·인천·경기·부산 우선, 나머지 가나다순, 제주 마지막 */

export type CourtListItem = { code: string; label: string };

const JEJU = /제주/;

const GYEONGGI = /수원|의정부|안양|성남|평택|경기/;

function courtSortRank(label: string): number {
  if (JEJU.test(label)) return 6;
  if (/서울/.test(label)) return 0;
  if (/인천/.test(label)) return 1;
  if (GYEONGGI.test(label)) return 2;
  if (/부산/.test(label)) return 3;
  return 4;
}

export function compareCourtLabels(a: string, b: string): number {
  const rankA = courtSortRank(a);
  const rankB = courtSortRank(b);
  if (rankA !== rankB) return rankA - rankB;
  return a.localeCompare(b, 'ko');
}

export function sortCourtList<T extends CourtListItem>(items: T[]): T[] {
  return [...items].sort((a, b) => compareCourtLabels(a.label, b.label));
}
