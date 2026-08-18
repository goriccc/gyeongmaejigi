/** 건축연도 — 2024년 (2년차) */
export function formatBuildYearLabel(buildYear: number): string {
  const age = new Date().getFullYear() - buildYear;
  if (age <= 0) return `${buildYear}년`;
  return `${buildYear}년 (${age}년차)`;
}

/** 단지 규모 — 363세대 · 7동 */
export function formatScaleLabel(
  householdCount?: number,
  buildingCount?: number,
): string | null {
  const parts: string[] = [];
  if (householdCount && householdCount > 0) {
    parts.push(`${householdCount.toLocaleString('ko-KR')}세대`);
  }
  if (buildingCount && buildingCount > 0) {
    parts.push(`${buildingCount.toLocaleString('ko-KR')}동`);
  }
  return parts.length ? parts.join(' · ') : null;
}
