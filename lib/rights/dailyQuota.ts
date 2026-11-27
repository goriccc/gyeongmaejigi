/** 권리분석 — 기기(브라우저)당 하루 1회 제한 */

export const RIGHTS_DAILY_COOKIE = 'gyeongmaejigi_rights_day';
const RIGHTS_DAILY_LS_KEY = 'gyeongmaejigi:rightsAnalysisDay';

export const RIGHTS_DAILY_LIMIT_MESSAGE =
  '권리분석은 기기당 하루에 1회만 이용할 수 있습니다. 내일 다시 시도해 주세요.';

/** Asia/Seoul 기준 YYYY-MM-DD */
export function kstDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 다음 한국 자정까지 초 (쿠키 Max-Age) */
export function secondsUntilNextKstMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const h = get('hour');
  const min = get('minute');
  const s = get('second');
  const elapsed = h * 3600 + min * 60 + s;
  const daySec = 24 * 3600;
  const remain = daySec - elapsed;
  return remain <= 0 ? daySec : remain;
}

export function parseCookieHeader(
  header: string | null,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('=').trim());
  }
  return null;
}

export function buildRightsDailyCookie(dayKey: string, now = new Date()): string {
  const maxAge = secondsUntilNextKstMidnight(now);
  const secure =
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
      ? '; Secure'
      : '';
  return `${RIGHTS_DAILY_COOKIE}=${encodeURIComponent(dayKey)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function isRightsQuotaUsedToday(
  cookieHeader: string | null,
  now = new Date(),
): boolean {
  const used = parseCookieHeader(cookieHeader, RIGHTS_DAILY_COOKIE);
  return used === kstDateKey(now);
}

export function loadRightsQuotaUsedClient(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(RIGHTS_DAILY_LS_KEY) === kstDateKey();
  } catch {
    return false;
  }
}

export function markRightsQuotaUsedClient(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RIGHTS_DAILY_LS_KEY, kstDateKey());
  } catch {
    /* ignore quota / private mode */
  }
}
