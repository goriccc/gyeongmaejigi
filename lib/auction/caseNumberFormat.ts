/** 법원경매정보 사건번호 표시 형식 변환 */

const CASE_TYPE_BY_CODE: Record<string, string> = {
  '0130': '타경',
  '0131': '타채',
  '0132': '타기',
  '0133': '타행',
  '0134': '타집',
  '0135': '타공',
};

export function formatCourtLabel(
  name: string,
  branchName: string | null | undefined,
): string {
  const n = name.trim();
  const b = branchName?.trim() ?? '';
  if (!b || b === n) return n;
  if (n.endsWith(b) || n.startsWith(b) || b.includes(n) || n.includes(b)) {
    return n.length >= b.length ? n : b;
  }
  return `${n} ${b}`;
}

/** API 요청용 — 2026타경1234 / 2026-1234 / 연도+일련번호 */
export function normalizeCaseNumber(input: string): string {
  const value = input.trim();
  if (/^\d{4}타[가-힣]\d+$/.test(value)) return value;
  const typed = value.match(/^(\d{4})\s*타([가-힣])\s*(\d+)$/);
  if (typed) return `${typed[1]}타${typed[2]}${typed[3]}`;
  const match = value.match(/^(\d{4})\s*[-_\s]?\s*(\d+)$/);
  if (match) return `${match[1]}타경${match[2]}`;
  return value;
}

export function buildTakyungCaseNumber(year: string, serial: string): string {
  const y = year.replace(/\D/g, '').slice(0, 4);
  const s = serial.replace(/\D/g, '');
  if (!y || !s) return '';
  return `${y}타경${s}`;
}

export function parseTakyungCaseNumber(full: string): {
  year: string;
  serial: string;
} | null {
  const normalized = normalizeCaseNumber(full);
  const m = normalized.match(/^(\d{4})타경(\d+)$/);
  if (!m) return null;
  return { year: m[1], serial: m[2] };
}

export function defaultAuctionYear(): string {
  return String(new Date().getFullYear());
}

/**
 * 표시용 사건번호 — userCsNo 우선, 내부 csNo(20240130115901)는 2024타경115901 형식으로 변환
 */
export function formatDisplayCaseNumber(
  internalCsNo: string | null | undefined,
  userCsNo: string | null | undefined,
  fallbackInput?: string,
): string {
  const user = userCsNo?.trim();
  if (user && /^\d{4}타/.test(user)) return user;

  const fallback = fallbackInput?.trim();
  if (fallback && /^\d{4}타/.test(fallback)) return normalizeCaseNumber(fallback);

  const internal = internalCsNo?.trim() ?? '';
  if (/^\d{4}타/.test(internal)) return internal;

  if (/^\d{12,14}$/.test(internal)) {
    const year = internal.slice(0, 4);
    const typeCode = internal.slice(4, 8);
    const serialRaw = internal.slice(8);
    const typeName = CASE_TYPE_BY_CODE[typeCode] ?? '타경';
    const serial = String(Number(serialRaw));
    if (serial && serial !== 'NaN') {
      return `${year}${typeName}${serial}`;
    }
  }

  return fallback ? normalizeCaseNumber(fallback) : internal;
}

export function stripHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = stripHtml(value).replace(/,/g, '').replace(/[^\d]/g, '');
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function formatYmd(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = stripHtml(value);
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  const dotted = trimmed.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (dotted) {
    const month = dotted[2].padStart(2, '0');
    const day = dotted[3].padStart(2, '0');
    return `${dotted[1]}-${month}-${day}`;
  }

  return trimmed;
}
