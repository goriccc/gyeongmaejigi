function parseUseAprParts(useAprDay?: string | null): {
  year: number;
  month: number | null;
  day: number | null;
} | null {
  if (!useAprDay) return null;
  const digits = useAprDay.replace(/\D/g, '');
  if (digits.length < 4) return null;
  const year = Number(digits.slice(0, 4));
  if (!(year > 1900)) return null;
  const month =
    digits.length >= 6 ? Number(digits.slice(4, 6)) : null;
  const day = digits.length >= 8 ? Number(digits.slice(6, 8)) : null;
  return {
    year,
    month: month != null && month >= 1 && month <= 12 ? month : null,
    day: day != null && day >= 1 && day <= 31 ? day : null,
  };
}

function ageYearsFromParts(
  parts: { year: number; month: number | null; day: number | null },
  now: Date,
): number {
  if (parts.month == null) return now.getFullYear() - parts.year;
  const month = parts.month;
  const day = parts.day ?? 1;
  let age = now.getFullYear() - parts.year;
  const nowMonth = now.getMonth() + 1;
  const nowDay = now.getDate();
  if (nowMonth < month || (nowMonth === month && nowDay < day)) age -= 1;
  return age;
}

function formatUseAprDateLabel(
  parts: { year: number; month: number | null; day: number | null },
): string {
  if (parts.month != null && parts.day != null) {
    return `${parts.year}년 ${parts.month}월 ${parts.day}일`;
  }
  if (parts.month != null) return `${parts.year}년 ${parts.month}월`;
  return `${parts.year}년`;
}

/** 건축연도 — 1987년 10월 29일 (38년차) */
export function formatBuildYearLabel(
  buildYear: number,
  useAprDay?: string | null,
  now = new Date(),
): string {
  const parts = parseUseAprParts(useAprDay) ?? {
    year: buildYear,
    month: null,
    day: null,
  };
  const datePart = formatUseAprDateLabel(parts);
  const age = ageYearsFromParts(parts, now);
  if (age <= 0) return datePart;
  return `${datePart} (${age}년차)`;
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
