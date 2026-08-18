import {
  fetchDataGoKrItems,
  parseManAmount,
  pickField,
  type DataGoKrItem,
} from '@/lib/field/dataGoKr';
import {
  complexNameCandidates,
  namesLikelyMatch,
  tradeNameInAddress,
} from '@/lib/field/complexName';
import type { PropType } from '@/lib/field/complexLike';

export type RtmsTrade = {
  yearMonth: string;
  day: number;
  name: string;
  dong: string | null;
  floor: string | null;
  areaM2: number | null;
  amountMan: number;
  buildYear: number | null;
};

const ENDPOINTS: Record<PropType, string> = {
  아파트:
    'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  다세대:
    'https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
  다가구:
    'https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade',
};

function padMonth(n: number): string {
  return String(n).padStart(2, '0');
}

function shiftMonth(year: number, month: number, delta: number): {
  year: number;
  month: number;
} {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function areaClose(
  target: number | undefined,
  trade: number | null,
  propType: PropType,
): boolean {
  if (!target || !trade) return true;
  const tol =
    propType === '아파트'
      ? Math.max(8, target * 0.12)
      : Math.max(12, target * 0.2);
  return Math.abs(target - trade) <= tol;
}

function parseTrade(row: DataGoKrItem): RtmsTrade | null {
  const year = pickField(row, ['dealYear', '년']);
  const month = pickField(row, ['dealMonth', '월']);
  if (!year || !month) return null;
  const amount = parseManAmount(pickField(row, ['dealAmount', '거래금액']));
  if (amount == null) return null;
  const areaRaw = pickField(row, [
    'excluUseAr',
    '전용면적',
    'totalFloorAr',
    '연면적',
  ]);
  const area = areaRaw ? Number(areaRaw) : null;
  const name = pickField(row, ['aptNm', 'mhouseNm', '아파트', '연립다세대']);
  const dongRaw = pickField(row, ['aptDong', 'dong', '동']);
  const buildRaw = pickField(row, ['buildYear', '건축년도']);
  const day = Number(pickField(row, ['dealDay', '일']) || '1');

  return {
    yearMonth: `${year}-${padMonth(Number(month))}`,
    day: Number.isFinite(day) ? day : 1,
    name,
    dong: dongRaw ? (dongRaw.includes('동') ? dongRaw : `${dongRaw}동`) : null,
    floor: pickField(row, ['floor', '층']) || null,
    areaM2: Number.isFinite(area) ? area : null,
    amountMan: amount,
    buildYear: buildRaw ? Number(buildRaw) || null : null,
  };
}

function nameMatches(
  trade: RtmsTrade,
  nameCandidates: string[],
  address?: string,
): boolean {
  if (!trade.name) return false;
  if (
    nameCandidates.some((candidate) => namesLikelyMatch(candidate, trade.name))
  ) {
    return true;
  }
  return address ? tradeNameInAddress(trade.name, address) : false;
}

function matchesCase(
  trade: RtmsTrade,
  nameCandidates: string[],
  address: string | undefined,
  exclusiveAreaM2: number | undefined,
  propType: PropType,
  bun: string | undefined,
  row: DataGoKrItem,
  mode: 'strict' | 'nameOnly' = 'strict',
): boolean {
  if (mode === 'strict' && !areaClose(exclusiveAreaM2, trade.areaM2, propType)) {
    return false;
  }
  if (propType === '다가구') {
    if (!bun) return true;
    const jibun = pickField(row, ['jibun', '지번']);
    return !jibun || jibun.startsWith(bun);
  }
  return nameMatches(trade, nameCandidates, address);
}

function filterTrades(
  rows: Array<{ trade: RtmsTrade; row: DataGoKrItem }>,
  input: {
    nameCandidates: string[];
    address?: string;
    exclusiveAreaM2?: number;
    propType: PropType;
    bun?: string;
  },
  mode: 'strict' | 'nameOnly',
): RtmsTrade[] {
  return rows
    .filter(({ trade, row }) =>
      matchesCase(
        trade,
        input.nameCandidates,
        input.address,
        input.exclusiveAreaM2,
        input.propType,
        input.bun,
        row,
        mode,
      ),
    )
    .map(({ trade }) => trade);
}

export async function fetchMatchingTrades(input: {
  lawdCd: string;
  propType: PropType;
  caseName: string;
  address?: string;
  buildingName?: string;
  ledgerNames?: string[];
  exclusiveAreaM2?: number;
  bun?: string;
  target: number;
  maxMonths?: number;
}): Promise<{ trades: RtmsTrade[]; error?: string; relaxed?: boolean }> {
  const endpoint = ENDPOINTS[input.propType];
  const maxMonths = input.maxMonths ?? 36;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  const pool: Array<{ trade: RtmsTrade; row: DataGoKrItem }> = [];
  let lastError: string | undefined;

  const nameCandidates = complexNameCandidates({
    caseName: input.caseName,
    address: input.address,
    buildingName: input.buildingName,
    ledgerNames: input.ledgerNames,
  });
  const filterInput = {
    nameCandidates,
    address: input.address,
    exclusiveAreaM2: input.exclusiveAreaM2,
    propType: input.propType,
    bun: input.bun,
  };

  for (let i = 0; i < maxMonths; i++) {
    const dealYmd = `${year}${padMonth(month)}`;
    const { items, error } = await fetchDataGoKrItems(endpoint, {
      LAWD_CD: input.lawdCd,
      DEAL_YMD: dealYmd,
      pageNo: '1',
      numOfRows: '100',
    });
    if (error && error !== 'missing-key') lastError = error;
    if (error === 'missing-key') return { trades: [], error };

    for (const row of items) {
      const trade = parseTrade(row);
      if (trade) pool.push({ trade, row });
    }

    const prev = shiftMonth(year, month, -1);
    year = prev.year;
    month = prev.month;
  }

  let matched = filterTrades(pool, filterInput, 'strict').slice(0, input.target);
  let relaxed = false;
  if (matched.length === 0) {
    matched = filterTrades(pool, filterInput, 'nameOnly').slice(0, input.target);
    relaxed = matched.length > 0;
  }

  matched.sort((a, b) => {
    const c = b.yearMonth.localeCompare(a.yearMonth);
    if (c !== 0) return c;
    return b.day - a.day;
  });

  return { trades: matched, error: lastError, relaxed };
}
