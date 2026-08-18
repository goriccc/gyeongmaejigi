import { sameComplexBuildingName } from '@/lib/field/complexName';
import { fetchDataGoKrItems, pickField } from '@/lib/field/dataGoKr';

export type PlatKey = {
  sigunguCd: string;
  bjdongCd: string;
  bun: string;
  ji: string;
  mountain: boolean;
};

export function platKeyStr(p: PlatKey): string {
  return `${p.sigunguCd}-${p.bjdongCd}-${p.mountain ? '1' : '0'}-${p.bun}-${p.ji}`;
}

export type BuildingTitle = {
  useAprYear: number | null;
  dongName: string | null;
  buildingName: string | null;
  hhldCnt: number | null;
  hoCnt: number | null;
  mainAtchGbCd: string | null;
  mainAtchGbCdNm: string | null;
  mainPurpsCdNm: string | null;
  etcPurps: string | null;
};

/** 표제부 세대수 — hhldCnt 우선, 없으면 hoCnt */
export function titleHouseholdCount(t: BuildingTitle): number {
  if (t.hhldCnt != null && t.hhldCnt > 0) return t.hhldCnt;
  if (t.hoCnt != null && t.hoCnt > 0) return t.hoCnt;
  return 0;
}

export type BuildingRecap = {
  pk: string | null;
  bldNm: string | null;
  hhldCnt: number;
  mainBldCnt: number;
};

function padParcel(n: string | undefined): string {
  return (n ?? '').replace(/\D/g, '').padStart(4, '0');
}

function parseIntField(raw: string): number {
  const n = Number(raw.replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function platFromRow(
  row: Record<string, string>,
  sigunguCd: string,
  bjdongCd: string,
): PlatKey | null {
  const bun = padParcel(pickField(row, ['bun', '번']));
  const ji = padParcel(pickField(row, ['ji', '지']));
  if (!bun || bun === '0000') return null;
  const platGb = pickField(row, ['platGbCd', '대지구분코드']);
  const mountain = platGb === '1';
  return { sigunguCd, bjdongCd, bun, ji: ji || '0000', mountain };
}

function titleParams(plat: PlatKey): Record<string, string> {
  return {
    sigunguCd: plat.sigunguCd,
    bjdongCd: plat.bjdongCd,
    platGbCd: plat.mountain ? '1' : '0',
    bun: plat.bun,
    ji: plat.ji,
    numOfRows: '50',
    pageNo: '1',
  };
}

function isResidentialPurps(purps: string): boolean {
  return /공동주택|아파트|주택|연립|다세대|맨션|기숙/i.test(purps);
}

/** 집합건물 전유부 호실 수 */
export async function countExposUnits(plat: PlatKey): Promise<number> {
  const seen = new Set<string>();

  for (let pageNo = 1; pageNo <= 30; pageNo++) {
    const { items, error } = await fetchDataGoKrItems(
      'https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposInfo',
      {
        ...titleParams(plat),
        numOfRows: '100',
        pageNo: String(pageNo),
      },
    );
    if (error) break;
    if (items.length === 0) break;

    for (const row of items) {
      const ho = pickField(row, ['hoNm', '호명칭']);
      if (!ho) continue;
      const dong = pickField(row, ['dongNm', '동명칭']);
      seen.add(`${dong}|${ho}`);
    }

    if (items.length < 100) break;
    await new Promise((r) => setTimeout(r, 120));
  }

  return seen.size;
}

/** 집합건물 전유·주거 호실 수 — 표제부 hhldCnt에 상가·주차 등이 포함된 경우 보정 */
export async function countExclusiveResidentialUnits(
  plat: PlatKey,
): Promise<number> {
  const seen = new Set<string>();

  for (let pageNo = 1; pageNo <= 30; pageNo++) {
    const { items, error } = await fetchDataGoKrItems(
      'https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo',
      {
        ...titleParams(plat),
        numOfRows: '100',
        pageNo: String(pageNo),
      },
    );
    if (error) break;
    if (items.length === 0) break;

    for (const row of items) {
      const pubuse = pickField(row, ['exposPubuseGbCdNm', '전유공용구분코드명']);
      if (pubuse !== '전유') continue;

      const purps = `${pickField(row, ['mainPurpsCdNm', '주용도코드명'])} ${pickField(row, ['etcPurps', '기타용도'])}`;
      if (!isResidentialPurps(purps)) continue;
      if (/공용|주차|관리|경비|기계|전기|MDF|휀룸|계단|노인/i.test(purps)) continue;

      const ho = pickField(row, ['hoNm', '호명칭']);
      if (!ho) continue;
      const dong = pickField(row, ['dongNm', '동명칭']);
      const key = `${dong}|${ho}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }

    if (items.length < 100) break;
    await new Promise((r) => setTimeout(r, 120));
  }

  return seen.size;
}

function titleFromRow(row: Record<string, string>): BuildingTitle {
  const day = pickField(row, ['useAprDay', '사용승인일']);
  const year = day.length >= 4 ? Number(day.slice(0, 4)) : null;
  const dong = pickField(row, ['dongNm', '동명칭']) || null;
  const buildingName = pickField(row, ['bldNm', '건물명']) || null;
  const hhldRaw = pickField(row, ['hhldCnt', '세대수']);
  const hoRaw = pickField(row, ['hoCnt', '호수']);
  const hhldCnt = hhldRaw ? parseIntField(hhldRaw) || null : null;
  const hoCnt = hoRaw ? parseIntField(hoRaw) || null : null;
  const mainAtchGbCd = pickField(row, ['mainAtchGbCd', '주부속구분코드']) || null;
  const mainAtchGbCdNm =
    pickField(row, ['mainAtchGbCdNm', '주부속구분코드명']) || null;
  const mainPurpsCdNm = pickField(row, ['mainPurpsCdNm', '주용도코드명']) || null;
  const etcPurps = pickField(row, ['etcPurps', '기타용도']) || null;
  return {
    useAprYear: year && year > 1900 ? year : null,
    dongName: dong,
    buildingName,
    hhldCnt,
    hoCnt,
    mainAtchGbCd,
    mainAtchGbCdNm,
    mainPurpsCdNm,
    etcPurps,
  };
}

export async function fetchBuildingTitles(input: {
  sigunguCd: string;
  bjdongCd: string;
  bun?: string;
  ji?: string;
  mountain?: boolean;
}): Promise<{ titles: BuildingTitle[]; error?: string }> {
  const plat: PlatKey = {
    sigunguCd: input.sigunguCd,
    bjdongCd: input.bjdongCd,
    bun: padParcel(input.bun),
    ji: padParcel(input.ji) || '0000',
    mountain: Boolean(input.mountain),
  };
  const params = titleParams(plat);
  if (!params.bun || params.bun === '0000') {
    delete params.bun;
    delete params.ji;
  }

  const { items, error } = await fetchDataGoKrItems(
    'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo',
    params,
  );
  if (error) return { titles: [], error };

  return { titles: items.map(titleFromRow) };
}

export async function fetchAttachedPlats(plat: PlatKey): Promise<PlatKey[]> {
  const { items, error } = await fetchDataGoKrItems(
    'https://apis.data.go.kr/1613000/BldRgstHubService/getBrAtchJibunInfo',
    titleParams(plat),
  );
  if (error) return [];

  const out: PlatKey[] = [];
  for (const row of items) {
    const bun = padParcel(pickField(row, ['atchBun', '부속번', 'bun', '번']));
    const ji = padParcel(pickField(row, ['atchJi', '부속지', 'ji', '지']));
    if (!bun || bun === '0000') continue;
    out.push({
      sigunguCd: plat.sigunguCd,
      bjdongCd: plat.bjdongCd,
      bun,
      ji: ji || '0000',
      mountain: plat.mountain,
    });
  }
  return out;
}

export async function fetchNamedComplexInBjdong(input: {
  sigunguCd: string;
  bjdongCd: string;
  canonicalName: string;
}): Promise<{ plats: PlatKey[]; titles: BuildingTitle[] }> {
  const plats: PlatKey[] = [];
  const titles: BuildingTitle[] = [];
  const seenPlat = new Set<string>();

  for (const platGbCd of ['0', '1'] as const) {
    for (let pageNo = 1; pageNo <= 30; pageNo++) {
      const { items, error } = await fetchDataGoKrItems(
        'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo',
        {
          sigunguCd: input.sigunguCd,
          bjdongCd: input.bjdongCd,
          platGbCd,
          numOfRows: '100',
          pageNo: String(pageNo),
        },
      );
      if (error || items.length === 0) break;

      for (const row of items) {
        const bldNm = pickField(row, ['bldNm', '건물명']);
        if (!bldNm || !sameComplexBuildingName(bldNm, input.canonicalName)) {
          continue;
        }
        titles.push(titleFromRow(row));
        const plat = platFromRow(row, input.sigunguCd, input.bjdongCd);
        if (!plat) continue;
        const key = platKeyStr(plat);
        if (seenPlat.has(key)) continue;
        seenPlat.add(key);
        plats.push(plat);
      }

      if (items.length < 100) break;
    }
  }

  return { plats, titles };
}

export async function fetchMatchingPlatsInBjdong(input: {
  sigunguCd: string;
  bjdongCd: string;
  canonicalName: string;
}): Promise<PlatKey[]> {
  const { plats } = await fetchNamedComplexInBjdong(input);
  return plats;
}

function recapFromRow(row: Record<string, string>): BuildingRecap | null {
  const hhld = parseIntField(pickField(row, ['hhldCnt', '세대수']));
  const bld = parseIntField(pickField(row, ['mainBldCnt', '주건축물수']));
  if (hhld === 0 && bld === 0) return null;
  return {
    pk: pickField(row, ['mgmBldrgstPk', '관리건축물대장PK']) || null,
    bldNm: pickField(row, ['bldNm', '건물명']) || null,
    hhldCnt: hhld,
    mainBldCnt: bld,
  };
}

export async function fetchNamedRecapsInBjdong(input: {
  sigunguCd: string;
  bjdongCd: string;
  canonicalName: string;
}): Promise<BuildingRecap[]> {
  const recaps: BuildingRecap[] = [];
  const seen = new Set<string>();

  for (const platGbCd of ['0', '1'] as const) {
    for (let pageNo = 1; pageNo <= 20; pageNo++) {
      const { items, error } = await fetchDataGoKrItems(
        'https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo',
        {
          sigunguCd: input.sigunguCd,
          bjdongCd: input.bjdongCd,
          platGbCd,
          numOfRows: '100',
          pageNo: String(pageNo),
        },
      );
      if (error || items.length === 0) break;

      for (const row of items) {
        const recap = recapFromRow(row);
        if (!recap?.bldNm) continue;
        if (!sameComplexBuildingName(recap.bldNm, input.canonicalName)) continue;
        const key = recap.pk || `${recap.bldNm}-${recap.hhldCnt}-${recap.mainBldCnt}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recaps.push(recap);
      }

      if (items.length < 100) break;
    }
  }

  return recaps;
}

/** 지오코드 법정동과 대장 bjdong이 어긋날 때 — 시군구 총괄표제부 검색 */
export async function fetchNamedRecapsInSigungu(input: {
  sigunguCd: string;
  canonicalName: string;
}): Promise<BuildingRecap[]> {
  const recaps: BuildingRecap[] = [];
  const seen = new Set<string>();

  for (let bjdong = 10100; bjdong <= 12000; bjdong += 100) {
    const bjdongCd = String(bjdong);
    for (const platGbCd of ['0', '1'] as const) {
      const { items, error } = await fetchDataGoKrItems(
        'https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo',
        {
          sigunguCd: input.sigunguCd,
          bjdongCd,
          platGbCd,
          numOfRows: '100',
          pageNo: '1',
        },
      );
      if (error || items.length === 0) continue;

      for (const row of items) {
        const recap = recapFromRow(row);
        if (!recap?.bldNm) continue;
        if (!sameComplexBuildingName(recap.bldNm, input.canonicalName)) continue;
        const key =
          recap.pk || `${recap.bldNm}-${recap.hhldCnt}-${recap.mainBldCnt}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recaps.push(recap);
      }
    }
  }

  return recaps;
}

export async function fetchBuildingRecap(plat: PlatKey): Promise<BuildingRecap[]> {
  const { items, error } = await fetchDataGoKrItems(
    'https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo',
    titleParams(plat),
  );
  if (error) return [];

  return items
    .map((row) => recapFromRow(row))
    .filter((r): r is BuildingRecap => r != null);
}
