/** 토·일 여부 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** 하루 전 */
export function previousDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - 1);
  return next;
}

/**
 * 주말이면 직전 금요일(마지막 영업일)로 보정합니다.
 * 공휴일은 할인율 조회 시 테이블에 없으면 추가로 이전 일자를 탐색합니다.
 */
export function resolveBondBasisDate(date = new Date()): Date {
  let cursor = new Date(date);
  while (isWeekend(cursor)) {
    cursor = previousDay(cursor);
  }
  return cursor;
}

/** Date → YYYY-MM-DD (로컬) */
export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date → YYYYMM */
export function formatYm(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/** YYYY-MM-DD → Date (로컬 자정) */
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
