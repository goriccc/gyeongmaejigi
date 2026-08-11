import {
  formatYm,
  formatYmd,
  parseYmd,
  previousDay,
  resolveBondBasisDate,
} from '@/lib/calc/businessDay';

export type DailyDiscountRate = {
  date: string;
  discountRatePct: number;
};

export type CustomerBurdenResult = {
  customerBurden: number;
  discountRatePct?: number;
  sellUnitPrice?: number;
};

const WOORI_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const discountCache = new Map<string, { at: number; rows: DailyDiscountRate[] }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

/** 우리은행 월별 할인율 HTML 파싱 */
export function parseWooriDiscountTable(html: string): DailyDiscountRate[] {
  const rows: DailyDiscountRate[] = [];
  const trRe =
    /<tr>\s*<td>(\d{4}\.\d{2}\.\d{2})<\/td>\s*<td>[\d,]+<\/td>\s*<td>[\d.]+<\/td>\s*<td>([\d.]+)<\/td>\s*<\/tr>/g;
  let match: RegExpExecArray | null;
  while ((match = trRe.exec(html)) !== null) {
    const [, dotted, rateStr] = match;
    const [y, m, d] = dotted.split('.');
    rows.push({
      date: `${y}-${m}-${d}`,
      discountRatePct: parseFloat(rateStr),
    });
  }
  return rows;
}

/** 고객부담금 조회 HTML 파싱 */
export function parseWooriCustomerBurden(html: string): CustomerBurdenResult | null {
  const hidden = html.match(/name="SLF_BRDM"\s+id="SLF_BRDM"\s+value="([\d,]+)"/);
  if (hidden) {
    const customerBurden = parseInt(hidden[1].replace(/,/g, ''), 10);
    const rateMatch = html.match(/name="NAHB_PRFT_RT"[^>]*value="([\d.]+)"/);
    const sellMatch = html.match(/name="SELL_UP"[^>]*value="([\d,]+)"/);
    return {
      customerBurden,
      discountRatePct: rateMatch ? parseFloat(rateMatch[1]) : undefined,
      sellUnitPrice: sellMatch
        ? parseInt(sellMatch[1].replace(/,/g, ''), 10)
        : undefined,
    };
  }

  const spanMatch = html.match(
    /즉시매도\s*본인부담금<\/th>\s*<td[^>]*>\s*<span[^>]*>([\d,]+)\s*원<\/span>/,
  );
  if (spanMatch) {
    return {
      customerBurden: parseInt(spanMatch[1].replace(/,/g, ''), 10),
    };
  }
  return null;
}

async function fetchWooriHtml(
  url: string,
  body?: URLSearchParams,
): Promise<string> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'User-Agent': WOORI_UA,
      Accept: 'text/html,application/xhtml+xml',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body?.toString(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`우리은행 채권 조회 HTTP ${res.status}`);
  }
  return res.text();
}

/** 월별 일자 할인율 목록 (주택도시기금 → 우리은행 HBNHB0036) */
export async function fetchMonthlyDiscountRates(
  basisDate: Date,
): Promise<DailyDiscountRate[]> {
  const ym = formatYm(basisDate);
  const cached = discountCache.get(ym);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.rows;
  }

  const year = basisDate.getFullYear();
  const month = String(basisDate.getMonth() + 1).padStart(2, '0');
  const body = new URLSearchParams({
    MODE: '1',
    BSDT_YM: ym,
    STD_YEAR: String(year),
    STD_MONTH: month,
  });

  const html = await fetchWooriHtml(
    'https://svc.wooribank.com/svc/Dream?withyou=HBNHB0036&cc=c004893:c004893',
    body,
  );
  const rows = parseWooriDiscountTable(html);
  if (rows.length === 0) {
    throw new Error('할인율 표를 파싱하지 못했습니다.');
  }
  discountCache.set(ym, { at: Date.now(), rows });
  return rows;
}

/** 주말·공휴일 보정 포함 — 해당 일자(또는 직전 영업일) 할인율 */
export async function resolveDiscountRatePct(
  targetDate: Date,
): Promise<{ basisDate: string; discountRatePct: number }> {
  let cursor = resolveBondBasisDate(targetDate);
  for (let i = 0; i < 14; i += 1) {
    const rows = await fetchMonthlyDiscountRates(cursor);
    const ymd = formatYmd(cursor);
    const hit = rows.find((r) => r.date === ymd);
    if (hit) {
      return { basisDate: ymd, discountRatePct: hit.discountRatePct };
    }
    cursor = previousDay(cursor);
    while (cursor.getDay() === 0 || cursor.getDay() === 6) {
      cursor = previousDay(cursor);
    }
  }
  throw new Error('기준일 할인율을 찾지 못했습니다.');
}

/** 발행금액·기준일 고객부담금 (우리은행 HBNHB0037) */
export async function fetchCustomerBurden(
  purchaseAmount: number,
  basisDateYmd: string,
): Promise<CustomerBurdenResult> {
  const body = new URLSearchParams({
    MODE: '1',
    NACD: '',
    BND_BUY_AM: String(purchaseAmount),
    INQ_STA_DT: basisDateYmd,
    TRPE_DSCD: '1790',
  });
  const html = await fetchWooriHtml(
    'https://svc.wooribank.com/svc/Dream?withyou=HBNHB0037',
    body,
  );
  const parsed = parseWooriCustomerBurden(html);
  if (!parsed) {
    throw new Error('고객부담금 결과를 파싱하지 못했습니다.');
  }
  return parsed;
}

export { parseYmd, resolveBondBasisDate, formatYmd };
