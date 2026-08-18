/**
 * 원 단위 금액을 "약 N억 M만원" 형식으로 포맷합니다.
 * @param n - 원 단위 금액
 * @returns 한국어 원 단위 표시 문자열
 */
export function fmtWon(n: number): string {
  const rounded = Math.round(n);
  const eok = Math.floor(rounded / 100_000_000);
  const man = Math.round((rounded % 100_000_000) / 10_000);
  let s = '약 ';
  if (eok > 0) s += `${eok}억 `;
  s += `${man.toLocaleString('ko-KR')}만원`;
  return s;
}

/**
 * 비율을 퍼센트 문자열로 변환합니다. (불필요한 소수 0 제거)
 * @param r - 0~1 비율
 */
export function pct(r: number): string {
  return `${(r * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

/**
 * 콤마가 포함된 숫자 문자열을 파싱합니다.
 * @param value - 입력 문자열
 * @returns 숫자 (파싱 실패 시 0)
 */
export function parseNumberInput(value: string): number {
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 원 단위 금액을 "N,NNN,NNN원" 형식으로 포맷합니다.
 * @param n - 원 단위 금액
 */
export function fmtWonExact(n: number): string {
  return `${formatComma(n)}원`;
}

/** (비율·범례) 금액원 — 입찰가 계산 UI */
export function fmtWonExactLead(
  meta: string,
  amount: number,
  options?: { minus?: boolean },
): string {
  const sign = options?.minus ? '−' : '';
  return `(${meta}) ${sign}${fmtWonExact(amount)}`;
}

/**
 * 숫자를 천단위 콤마 문자열로 포맷합니다.
 */
export function formatComma(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

/** 1평 = 3.305785㎡ (국토교통부 고시) */
export const M2_PER_PYEONG = 3.305785;

export function m2ToPyeong(m2: number): number {
  if (!Number.isFinite(m2) || m2 <= 0) return 0;
  return m2 / M2_PER_PYEONG;
}

/** 전용면적 — ㎡와 평(소수 2자리) */
export function formatExclusiveAreaM2(m2: number): string {
  const pyeong = m2ToPyeong(m2);
  return `${m2} ㎡ (${pyeong.toFixed(2)}평)`;
}

/** 순번을 ①②③ 원형 숫자로. 1–20은 유니코드, 그 이상은 (21) 형식 */
export function formatCircledNumber(n: number): string {
  const order = Math.floor(n);
  if (!Number.isFinite(order) || order < 1) return '';
  if (order <= 20) return String.fromCharCode(0x245f + order);
  return `(${order})`;
}
