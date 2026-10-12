import { geocodeAddressDetail, type AddressGeo } from '@/lib/auction/geocode';
import { LEGACY_EMD_CODES, LEGACY_SGG_BY_NEW } from '@/lib/realty/legacyLdCodes';

/** 브이월드 국가중점 API — 공동주택·개별주택 가격 속성조회 */
const VWORLD_NED_BASE = 'https://api.vworld.kr/ned/data';

export type OfficialPriceKind = 'apart' | 'indvd';

export type OfficialPriceResult =
  | {
      ok: true;
      officialPrice: number;
      stdrYear: string;
      kind: OfficialPriceKind;
      /** 화면 표시용 — 예: "그랜드빌 602호 · 2026년 공동주택가격" */
      label: string;
    }
  | { ok: false; error: string };

export type AddressUnit = { dong: string | null; ho: string | null };

type ApartRow = {
  stdrYear?: string;
  pblntfPc?: string;
  dongNm?: string;
  hoNm?: string;
  aphusNm?: string;
  lastUpdtDt?: string;
};

type IndvdRow = {
  stdrYear?: string;
  housePc?: string;
  lastUpdtDt?: string;
};

/** 경매 소재지에서 동·호를 뽑습니다. 예: "… 104동 3층304호" → { dong: "104", ho: "304" } */
export function parseUnitFromAddress(address: string): AddressUnit {
  const text = address.replace(/\s+/g, ' ');
  const hoMatches = [...text.matchAll(/(?:제\s*)?([A-Za-z]?\d{1,5})\s*호(?![가-힣])/g)];
  const ho = hoMatches.length ? hoMatches[hoMatches.length - 1][1].toUpperCase() : null;

  const dongMatch =
    text.match(/(?:제\s*)?(\d{1,4})\s*동(?=\s|,|$|제|\d)/) ??
    text.match(/(?:제\s*)?([A-Za-z]|[가-하])\s*동(?=\s*(?:제\s*)?\d{1,2}\s*층|\s*(?:제\s*)?[A-Za-z]?\d{1,5}\s*호)/);
  const dong = dongMatch ? dongMatch[1].toUpperCase() : null;

  return { dong, ho };
}

export function pnuFromGeo(geo: AddressGeo): string | null {
  if (!geo.bCode || geo.bCode.length < 10 || !geo.bun) return null;
  const bun = geo.bun.replace(/\D/g, '').padStart(4, '0');
  const ji = (geo.ji ?? '').replace(/\D/g, '').padStart(4, '0') || '0000';
  if (bun === '0000') return null;
  return `${geo.bCode.slice(0, 10)}${geo.mountain ? '2' : '1'}${bun}${ji}`;
}

/** 현재 PNU + 행정구역 개편 전 옛 법정동 코드로 만든 PNU 후보 */
export function pnuCandidatesFromGeo(geo: AddressGeo): string[] {
  const pnu = pnuFromGeo(geo);
  if (!pnu) return [];
  const out = [pnu];
  const emd = geo.emdName?.replace(/\s+/g, ' ').trim();
  const legacySggs = LEGACY_SGG_BY_NEW[pnu.slice(0, 5)];
  if (!emd || !legacySggs) return out;
  for (const sgg of legacySggs) {
    const suffix = LEGACY_EMD_CODES[sgg]?.[emd];
    if (suffix) out.push(`${sgg}${suffix}${pnu.slice(10)}`);
  }
  return out;
}

function normalizeUnit(v: string | null | undefined): string {
  return (v ?? '')
    .replace(/\s+/g, '')
    .replace(/^제/, '')
    .replace(/(동|호)$/, '')
    .toUpperCase();
}

function stripLeadingZeros(v: string): string {
  return v.replace(/^([A-Z]?)0+(\d)/, '$1$2');
}

function unitEquals(a: string | null | undefined, b: string): boolean {
  const x = normalizeUnit(a);
  const y = normalizeUnit(b);
  if (!x || !y) return false;
  return x === y || stripLeadingZeros(x) === stripLeadingZeros(y);
}

function kstYear(now = new Date()): number {
  return new Date(now.getTime() + 9 * 3600_000).getUTCFullYear();
}

async function vworldFetch<T>(
  op: string,
  key: string,
  params: Record<string, string>,
): Promise<T[]> {
  const domain = process.env.VWORLD_DOMAIN?.trim();
  if (!domain) throw new Error('VWORLD_DOMAIN이 설정되지 않았습니다.');
  const url = new URL(`${VWORLD_NED_BASE}/${op}`);
  url.search = new URLSearchParams({
    key,
    domain,
    format: 'json',
    numOfRows: '1000',
    pageNo: '1',
    ...params,
  }).toString();
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.name === 'TimeoutError'
        ? '브이월드 응답 시간 초과'
        : '브이월드 연결 실패',
    );
  }
  if (!res.ok) throw new Error(`브이월드 응답 오류 (${res.status})`);
  const data = (await res.json()) as Record<
    string,
    { field?: T[] | T; resultCode?: string; resultMsg?: string } | undefined
  >;
  const body = Object.values(data)[0];
  if (body?.resultCode && body.resultCode !== '' && body.resultCode !== '0') {
    throw new Error(`브이월드 오류: ${body.resultMsg || body.resultCode}`);
  }
  const field = body?.field;
  if (!field) return [];
  return Array.isArray(field) ? field : [field];
}

function latestByUpdate<T extends { lastUpdtDt?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (b.lastUpdtDt ?? '').localeCompare(a.lastUpdtDt ?? ''),
  );
}

async function lookupApart(
  pnu: string,
  unit: AddressUnit,
  year: number,
  key: string,
): Promise<OfficialPriceResult | null> {
  if (!unit.ho) {
    const any = await vworldFetch<ApartRow>('getApartHousingPriceAttr', key, {
      pnu,
      stdrYear: String(year),
      numOfRows: '1',
    });
    if (any.length === 0) return null;
    return {
      ok: false,
      error: '공동주택이지만 소재지에서 호수를 찾지 못했습니다. 공시가격을 직접 입력해 주세요.',
    };
  }

  const rows = await vworldFetch<ApartRow>('getApartHousingPriceAttr', key, {
    pnu,
    stdrYear: String(year),
    hoNm: unit.ho,
  });
  let matched = rows.filter((r) => unitEquals(r.hoNm, unit.ho!));
  if (matched.length === 0) {
    const any = await vworldFetch<ApartRow>('getApartHousingPriceAttr', key, {
      pnu,
      stdrYear: String(year),
      numOfRows: '1',
    });
    if (any.length === 0) return null;
    return {
      ok: false,
      error: `공시가격 목록에서 ${unit.ho}호를 찾지 못했습니다. 공시가격을 직접 입력해 주세요.`,
    };
  }

  if (unit.dong) {
    const byDong = matched.filter((r) => unitEquals(r.dongNm, unit.dong!));
    if (byDong.length > 0) {
      matched = byDong;
    } else if (matched.some((r) => normalizeUnit(r.dongNm))) {
      return {
        ok: false,
        error: `공시가격 목록에서 ${unit.dong}동 ${unit.ho}호를 찾지 못했습니다. 공시가격을 직접 입력해 주세요.`,
      };
    }
  }

  const prices = new Set(matched.map((r) => r.pblntfPc));
  if (prices.size > 1) {
    const dongs = [...new Set(matched.map((r) => normalizeUnit(r.dongNm)).filter(Boolean))];
    return {
      ok: false,
      error: dongs.length
        ? `${unit.ho}호가 여러 동(${dongs.slice(0, 5).join('·')}동)에 있어 특정할 수 없습니다. 공시가격을 직접 입력해 주세요.`
        : `${unit.ho}호 공시가격이 여러 건이라 특정할 수 없습니다. 공시가격을 직접 입력해 주세요.`,
    };
  }

  const row = latestByUpdate(matched)[0];
  const price = Number(row.pblntfPc);
  if (!Number.isFinite(price) || price <= 0) return null;
  const dongLabel = normalizeUnit(row.dongNm) ? `${normalizeUnit(row.dongNm)}동 ` : '';
  return {
    ok: true,
    officialPrice: price,
    stdrYear: row.stdrYear ?? String(year),
    kind: 'apart',
    label: `${row.aphusNm ? `${row.aphusNm} ` : ''}${dongLabel}${row.hoNm}호 · ${row.stdrYear ?? year}년 공동주택가격`,
  };
}

async function lookupIndvd(
  pnu: string,
  year: number,
  key: string,
): Promise<OfficialPriceResult | null> {
  const rows = await vworldFetch<IndvdRow>('getIndvdHousingPriceAttr', key, {
    pnu,
    stdrYear: String(year),
  });
  if (rows.length === 0) return null;
  const prices = new Set(rows.map((r) => r.housePc));
  const row = latestByUpdate(rows)[0];
  const price = Number(row.housePc);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    ok: true,
    officialPrice: price,
    stdrYear: row.stdrYear ?? String(year),
    kind: 'indvd',
    label: `${row.stdrYear ?? year}년 개별주택가격${prices.size > 1 ? ' (최신 정정분)' : ''}`,
  };
}

async function kakaoUnavailableReason(): Promise<string | null> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return 'KAKAO_REST_API_KEY 미설정';
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent('서울특별시 중구 세종대로 110')}`,
      {
        headers: { Authorization: `KakaoAK ${key}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      errorType?: string;
      message?: string;
    } | null;
    return `카카오 응답 ${res.status}${body?.errorType ? ` ${body.errorType}` : ''}${body?.message ? `: ${body.message}` : ''}`;
  } catch (e) {
    return e instanceof Error ? `카카오 연결 실패 (${e.name})` : '카카오 연결 실패';
  }
}

/**
 * 사건 소재지로 공시가격(공동주택가격 → 개별주택가격 순)을 조회합니다.
 * 올해 공시분이 없으면 전년도 값을 씁니다.
 */
export async function resolveOfficialPrice(
  address: string,
): Promise<OfficialPriceResult> {
  const apartKey = process.env.VWORLD_APART_HOUSE_KEY?.trim();
  const indvdKey = process.env.VWORLD_INDVD_HOUSE_KEY?.trim();
  if (!apartKey || !indvdKey) {
    return { ok: false, error: '브이월드 API 키가 설정되지 않았습니다.' };
  }

  const geo = await geocodeAddressDetail(address);
  const pnus = geo ? pnuCandidatesFromGeo(geo) : [];
  if (pnus.length === 0) {
    const reason = await kakaoUnavailableReason();
    return {
      ok: false,
      error: reason
        ? `주소 검색(카카오)을 쓸 수 없습니다 — ${reason}. 공시가격을 직접 입력해 주세요.`
        : '소재지에서 지번(필지)을 찾지 못했습니다. 공시가격을 직접 입력해 주세요.',
    };
  }

  const unit = parseUnitFromAddress(address);
  const thisYear = kstYear();

  for (const pnu of pnus) {
    for (const year of [thisYear, thisYear - 1]) {
      const apart = await lookupApart(pnu, unit, year, apartKey);
      if (apart) return apart;
      const indvd = await lookupIndvd(pnu, year, indvdKey);
      if (indvd) return indvd;
    }
  }

  return {
    ok: false,
    error: '해당 필지의 공동주택·개별주택 공시가격이 없습니다(상가·토지 등). 시가표준액을 직접 입력해 주세요.',
  };
}
