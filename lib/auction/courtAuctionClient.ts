import type { CourtAuctionCasePayload } from '@/lib/auction/mapCaseLookup';
import { parsePropertySeq } from '@/lib/auction/mapCaseLookup';
import {
  parseBidDepositAmount,
  parseBidDepositRate,
} from '@/lib/auction/bidDeposit';
import { parseAuctionRound, parseFailedBidCount } from '@/lib/auction/auctionRound';
import {
  formatYmd,
  normalizeCaseNumber,
  parseAmount,
  stripHtml,
} from '@/lib/auction/caseNumberFormat';
import { parseExclusiveAreaM2 } from '@/lib/auction/exclusiveArea';
import { extractNotifyMinPrices } from '@/lib/auction/minimumSalePrice';
import {
  parsePropertyDetailPricing,
  type PropertyDetailPricing,
} from '@/lib/auction/propertyDetailPricing';

const BASE_URL = 'https://www.courtauction.go.kr';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ENDPOINTS = {
  courts: {
    path: '/pgj/pgjComm/selectCortOfcCdLst.on',
    warmup:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ143M01.xml&pgjId=143M01',
    referer:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ143M01.xml&pgjId=143M01',
    submissionid: 'mf_wfm_mainFrame_sbm_selectCortOfcCdLst',
  },
  caseDetail: {
    path: '/pgj/pgj15A/selectAuctnCsSrchRslt.on',
    warmup:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ159M00.xml&pgjId=159M00',
    referer:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ159M00.xml&pgjId=159M00',
    submissionid: 'mf_wfm_mainFrame_sbm_selectCsDtlInf',
  },
  propertySearch: {
    path: '/pgj/pgjsearch/searchControllerMain.on',
    warmup:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml&pgjId=151F00',
    referer:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml&pgjId=151F00',
    submissionid: 'mf_wfm_mainFrame_sbm_selectGdsDtlSrch',
  },
  propertyDetail: {
    path: '/pgj/pgj15B/selectAuctnCsSrchRslt.on',
    warmup:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ15BM01.xml&pgjId=15BM01',
    referer:
      '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ15BM01.xml&pgjId=15BM01',
    submissionid: 'mf_wfm_mainFrame_sbm_selectGdsDtlSrch',
  },
} as const;

type EndpointKey = keyof typeof ENDPOINTS;

function nullIfBlank(value: unknown): string | null {
  const text = stripHtml(value);
  return text || null;
}

function parseScheduleRow(row: Record<string, unknown>) {
  const failedBidCount = parseFailedBidCount(
    row.flbdNcnt ?? row.yuchalCnt ?? row.usflbdNcnt,
  );
  return {
    propertyNumber: parsePropertySeq(
      row.maemulSer ?? row.dspslGdsSeq ?? row.mulSer,
    ),
    saleDate: formatYmd(
      row.dspslDxdyYmd ?? row.maeGiil ?? row.dspslYmd ?? row.dxdyYmd,
    ),
    appraisedPrice: parseAmount(
      row.aeeEvlAmt ?? row.gamevalAmt ?? row.aeeEvlAm ?? row.appraisalAmt,
    ),
    minimumSalePrice: parseAmount(row.lwsDspslPrc ?? row.minmaePrice),
    depositRate: parseBidDepositRate(
      row.grntRt ?? row.ipchalGrntRt ?? row.bidGrntRt ?? row.grntRate,
    ),
    depositAmount: parseBidDepositAmount(
      row.grntAmt ?? row.ipchalGrntAmt ?? row.bidGrntAmt ?? row.grntAm,
    ),
    failedBidCount,
    auctionRound: parseAuctionRound(row),
    resultCode: nullIfBlank(row.rsltCd ?? row.mulStatcd ?? row.statCd),
  };
}

function extractScheduleLists(data: Record<string, unknown>): unknown[] {
  const preferred = [
    data.dlt_rletCsGdsDtsDxdyInf,
    data.dlt_dspslDxdyInf,
    data.dlt_dxdyDtsLst,
  ];
  for (const list of preferred) {
    if (Array.isArray(list) && list.length > 0) return list;
  }

  for (const value of Object.values(data)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const row = value[0];
    if (!row || typeof row !== 'object') continue;
    const keys = Object.keys(row as Record<string, unknown>);
    if (
      keys.some((k) =>
        /dspsl|maeGiil|aeeEvl|gameval|lwsDspsl|rslt/i.test(k),
      )
    ) {
      return value;
    }
  }
  return [];
}

function parsePropertyRow(row: Record<string, unknown>) {
  const failedBidCount = parseFailedBidCount(row.yuchalCnt ?? row.flbdNcnt);
  return {
    propertyNumber: parsePropertySeq(row.maemulSer ?? row.dspslGdsSeq),
    saleDate: formatYmd(row.maeGiil ?? row.dspslDxdyYmd),
    appraisedPrice: parseAmount(row.gamevalAmt ?? row.aeeEvlAmt),
    minimumSalePrice: parseAmount(row.minmaePrice ?? row.lwsDspslPrc),
    depositRate: parseBidDepositRate(row.grntRt ?? row.ipchalGrntRt),
    depositAmount: parseBidDepositAmount(row.grntAmt ?? row.ipchalGrntAmt),
    failedBidCount,
    auctionRound: parseAuctionRound(row),
    resultCode: nullIfBlank(row.mulStatcd ?? row.rsltCd),
    notifyMinPrices: extractNotifyMinPrices(row),
    exclusiveAreaM2:
      parseExclusiveAreaM2([
        { minArea: row.minArea, maxArea: row.maxArea, objctArDts: row.objctArDts },
      ]) ?? undefined,
  };
}

function parseExclusiveAreaFromDetail(data: Record<string, unknown>): number | null {
  return parsePropertyDetailPricing(data)?.exclusiveAreaM2 ?? null;
}

class CourtAuctionClient {
  private cookies = new Map<string, string>();
  private warmed = new Set<string>();
  private lastCallAt = 0;

  private cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private storeCookieLine(line: string) {
    const seg = line.split(';')[0];
    const eq = seg.indexOf('=');
    if (eq > 0) {
      this.cookies.set(seg.slice(0, eq).trim(), seg.slice(eq + 1).trim());
    }
  }

  private ingestCookies(res: Response) {
    if (typeof res.headers.getSetCookie === 'function') {
      for (const line of res.headers.getSetCookie()) {
        this.storeCookieLine(line);
      }
      return;
    }
    const raw = res.headers.get('set-cookie');
    if (!raw) return;
    for (const part of raw.split(/,(?=[^;]+=)/)) {
      this.storeCookieLine(part);
    }
  }

  private async warmup(key: EndpointKey) {
    const ep = ENDPOINTS[key];
    if (this.warmed.has(ep.warmup)) return;
    const res = await fetch(`${BASE_URL}${ep.warmup}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        Referer: `${BASE_URL}/`,
      },
    });
    this.ingestCookies(res);
    this.warmed.add(ep.warmup);
  }

  private async throttle() {
    const elapsed = Date.now() - this.lastCallAt;
    if (elapsed < 1200) {
      await new Promise((r) => setTimeout(r, 1200 - elapsed));
    }
    this.lastCallAt = Date.now();
  }

  private async postJson<T>(
    key: EndpointKey,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    await this.warmup(key);
    await this.throttle();
    const ep = ENDPOINTS[key];
    const res = await fetch(`${BASE_URL}${ep.path}`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json;charset=UTF-8',
        Origin: BASE_URL,
        Referer: `${BASE_URL}${ep.referer}`,
        'X-Requested-With': 'XMLHttpRequest',
        submissionid:
          'submissionid' in ep && ep.submissionid
            ? ep.submissionid
            : 'mf_wfm_mainFrame_sbm_selectGdsDtlSrch',
        'sc-userid': 'SYSTEM',
        ...extraHeaders,
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    this.ingestCookies(res);

    const rawText = await res.text();
    let payload: { data?: { ipcheck?: boolean }; message?: string };
    try {
      payload = JSON.parse(rawText) as typeof payload;
    } catch {
      throw new Error(
        `법원경매정보 응답 형식 오류 (${res.status}). 잠시 후 다시 시도해 주세요.`,
      );
    }

    if (!res.ok) {
      throw new Error(
        payload.message || `법원경매정보 요청 실패 (${res.status})`,
      );
    }

    if (payload?.data?.ipcheck === false) {
      const err = new Error(
        payload.message ||
          '법원경매정보 사이트 접속이 일시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
      );
      (err as Error & { code?: string }).code = 'BLOCKED';
      throw err;
    }
    return payload as T;
  }

  async getCourtCodes() {
    const raw = await this.postJson<{
      data?: { result?: Array<Record<string, unknown>> };
    }>('courts', {});
    const list = raw.data?.result ?? [];
    return list
      .map((row) => ({
        code: nullIfBlank(row.cortOfcCd),
        name: nullIfBlank(row.cortOfcNm),
        branchName: nullIfBlank(row.cortSptNm),
      }))
      .filter((c) => c.code && c.name) as Array<{
      code: string;
      name: string;
      branchName: string | null;
    }>;
  }

  private async searchPropertyRaw(courtCode: string, caseNumber: string) {
    const raw = await this.postJson<{
      data?: { dlt_srchResult?: Array<Record<string, unknown>> };
    }>('propertySearch', {
      dma_pageInfo: {
        pageNo: 1,
        pageSize: 10,
        bfPageNo: '',
        startRowNo: '',
        totalCnt: '',
        totalYn: 'Y',
        groupTotalCount: '',
      },
      dma_srchGdsDtlSrchInfo: {
        rletDspslSpcCondCd: '',
        bidDvsCd: '',
        mvprpRletDvsCd: '00031R',
        cortAuctnSrchCondCd: '0004601',
        rprsAdongSdCd: '',
        rprsAdongSggCd: '',
        rprsAdongEmdCd: '',
        rdnmSdCd: '',
        rdnmSggCd: '',
        rdnmNo: '',
        mvprpDspslPlcAdongSdCd: '',
        mvprpDspslPlcAdongSggCd: '',
        mvprpDspslPlcAdongEmdCd: '',
        rdDspslPlcAdongSdCd: '',
        rdDspslPlcAdongSggCd: '',
        rdDspslPlcAdongEmdCd: '',
        cortOfcCd: courtCode,
        jdbnCd: '',
        execrOfcDvsCd: '',
        lclDspslGdsLstUsgCd: '',
        mclDspslGdsLstUsgCd: '',
        sclDspslGdsLstUsgCd: '',
        cortAuctnMbrsId: '',
        aeeEvlAmtMin: '',
        aeeEvlAmtMax: '',
        lwsDspslPrcRateMin: '',
        lwsDspslPrcRateMax: '',
        flbdNcntMin: '',
        flbdNcntMax: '',
        objctArDtsMin: '',
        objctArDtsMax: '',
        mvprpArtclKndCd: '',
        mvprpArtclNm: '',
        mvprpAtchmPlcTypCd: '',
        notifyLoc: 'off',
        lafjOrderBy: '',
        pgmId: 'PGJ151F01',
        csNo: caseNumber,
        cortStDvs: '1',
        statNum: 1,
      },
    });

    return raw.data?.dlt_srchResult ?? [];
  }

  private async searchPropertyByCase(courtCode: string, caseNumber: string) {
    const rows = await this.searchPropertyRaw(courtCode, caseNumber);
    return rows.map((row) => parsePropertyRow(row));
  }

  private async fetchPropertyDetail(
    courtCode: string,
    caseNumber: string,
    dspslGdsSeq: string,
  ): Promise<PropertyDetailPricing | null> {
    try {
      const raw = await this.postJson<{ data?: Record<string, unknown> }>(
        'propertyDetail',
        {
          dma_srchGdsDtlSrch: {
            csNo: caseNumber,
            cortOfcCd: courtCode,
            dspslGdsSeq,
            pgmId: 'PGJ15BM01',
            srchInfo: '',
          },
        },
        { 'SC-Pgm-Id': 'PGJ15BM01' },
      );
      return parsePropertyDetailPricing(raw.data ?? {});
    } catch {
      return null;
    }
  }

  private async fetchExclusiveAreaFromDetail(
    courtCode: string,
    caseNumber: string,
    dspslGdsSeq: string,
  ): Promise<number | undefined> {
    const detail = await this.fetchPropertyDetail(courtCode, caseNumber, dspslGdsSeq);
    return detail?.exclusiveAreaM2;
  }

  private applyDetailPricing<T extends {
    appraisedPrice?: number | null;
    saleDate?: string | null;
    failedBidCount?: number | null;
    auctionRound?: number | null;
    minimumSalePrice?: number | null;
    depositRate?: number | null;
    depositAmount?: number | null;
    exclusiveAreaM2?: number | null;
  }>(item: T, detail: PropertyDetailPricing): T {
    return {
      ...item,
      appraisedPrice: detail.appraisedPrice ?? item.appraisedPrice,
      saleDate: detail.saleDate ?? item.saleDate,
      failedBidCount: detail.failedBidCount ?? item.failedBidCount,
      auctionRound: detail.auctionRound ?? item.auctionRound,
      minimumSalePrice: detail.minimumSalePrice ?? item.minimumSalePrice,
      depositRate: detail.depositRate ?? item.depositRate,
      depositAmount: detail.depositAmount ?? item.depositAmount,
      exclusiveAreaM2: detail.exclusiveAreaM2 ?? item.exclusiveAreaM2,
    };
  }

  private mergeDetailScheduleRow(
    schedule: ReturnType<typeof parseScheduleRow>[],
    propertyNumber: number,
    detail: PropertyDetailPricing,
  ) {
    if (!detail.saleDate) return schedule;
    const idx = schedule.findIndex(
      (row) =>
        row.propertyNumber === propertyNumber && row.saleDate === detail.saleDate,
    );
    const patch = {
      propertyNumber,
      saleDate: detail.saleDate,
      appraisedPrice: detail.appraisedPrice ?? null,
      minimumSalePrice: detail.minimumSalePrice ?? null,
      depositRate: detail.depositRate ?? null,
      depositAmount: detail.depositAmount ?? null,
      failedBidCount: detail.failedBidCount ?? null,
      auctionRound: detail.auctionRound,
      resultCode: null,
      exclusiveAreaM2: detail.exclusiveAreaM2,
    };
    if (idx >= 0) {
      const next = [...schedule];
      next[idx] = { ...next[idx], ...patch };
      return next;
    }
    return [...schedule, patch];
  }

  private async enrichItemsWithDetailPricing(
    courtCode: string,
    caseNumber: string,
    searchRows: Array<Record<string, unknown>> | null,
    items: Array<{
      propertyNumber?: number | null;
      address?: string | null;
      appraisedPrice?: number | null;
      saleDate?: string | null;
      failedBidCount?: number | null;
      auctionRound?: number | null;
      minimumSalePrice?: number | null;
      depositRate?: number | null;
      depositAmount?: number | null;
      exclusiveAreaM2?: number | null;
      notifyMinPrices?: number[];
    }>,
    schedule: ReturnType<typeof parseScheduleRow>[],
  ) {
    const rows = searchRows ?? [];
    let nextItems = items;
    let nextSchedule = schedule;

    for (let i = 0; i < nextItems.length; i++) {
      const item = nextItems[i];
      const seq = item.propertyNumber ?? i + 1;
      const row = this.pickSearchRow(rows, seq);
      const detailCourt = nullIfBlank(row?.boCd) ?? courtCode;
      const detailCase = nullIfBlank(row?.srnSaNo) ?? caseNumber;
      const dspslGdsSeq = row?.maemulSer ?? row?.dspslGdsSeq ?? seq;

      const detail = await this.fetchPropertyDetail(
        detailCourt,
        detailCase,
        String(dspslGdsSeq),
      );
      if (!detail) continue;

      nextItems = nextItems.map((cur, index) =>
        index === i ? this.applyDetailPricing(cur, detail) : cur,
      );
      nextSchedule = this.mergeDetailScheduleRow(
        nextSchedule,
        seq,
        detail,
      );
    }

    return { items: nextItems, schedule: nextSchedule };
  }

  private pickSearchRow(
    rows: Array<Record<string, unknown>>,
    propertyNumber: number,
  ): Record<string, unknown> | undefined {
    if (!rows.length) return undefined;
    const seq = String(propertyNumber);
    const bySeq = rows.find(
      (row) => String(row.maemulSer ?? row.dspslGdsSeq ?? '').trim() === seq,
    );
    if (bySeq) return bySeq;
    return rows[propertyNumber - 1] ?? rows[0];
  }

  private async resolveExclusiveAreaM2(
    courtCode: string,
    caseNumber: string,
    searchRows: Array<Record<string, unknown>> | null,
    propertyNumber = 1,
  ): Promise<number | undefined> {
    const rows = searchRows ?? (await this.searchPropertyRaw(courtCode, caseNumber));
    if (!rows.length) return undefined;

    const row = this.pickSearchRow(rows, propertyNumber);
    if (!row) return undefined;
    const detailCourt = nullIfBlank(row.boCd) ?? courtCode;
    const detailCase = nullIfBlank(row.srnSaNo) ?? caseNumber;
    const dspslGdsSeq = row.maemulSer ?? row.dspslGdsSeq;

    if (dspslGdsSeq != null && String(dspslGdsSeq).trim()) {
      const fromDetail = await this.fetchExclusiveAreaFromDetail(
        detailCourt,
        detailCase,
        String(dspslGdsSeq),
      );
      if (fromDetail) return fromDetail;
    }

    return (
      parseExclusiveAreaM2([
        {
          minArea: row.minArea,
          maxArea: row.maxArea,
          objctArDts: row.objctArDts,
        },
      ]) ?? undefined
    );
  }

  async getCaseByCaseNumber(
    courtCode: string,
    caseNumber: string,
    propertyNumber = 1,
  ) {
    const csNo = normalizeCaseNumber(caseNumber);
    const raw = await this.postJson<{
      status?: number;
      message?: string | null;
      data?: Record<string, unknown>;
    }>('caseDetail', {
      dma_srchCsDtlInf: { cortOfcCd: courtCode, csNo },
    });

    const data = raw.data;
    if (!data || !data.dma_csBasInf) {
      return {
        found: false,
        status: raw.status ?? null,
        message: raw.message ?? null,
      } satisfies CourtAuctionCasePayload;
    }

    const basis = data.dma_csBasInf as Record<string, unknown>;
    let items = (
      Array.isArray(data.dlt_rletCsDspslObjctLst)
        ? data.dlt_rletCsDspslObjctLst
        : []
    ).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        propertyNumber: parsePropertySeq(
          r.maemulSer ?? r.dspslGdsSeq ?? r.mulSer ?? r.dspslObjctSeq,
        ),
        address: nullIfBlank(r.userSt) || nullIfBlank(r.st),
        appraisedPrice: parseAmount(
          r.aeeEvlAmt ?? r.gamevalAmt ?? r.nvltEvalAmt,
        ),
        saleDate: formatYmd(r.dspslDxdyYmd ?? r.maeGiil),
        failedBidCount: parseFailedBidCount(
          r.flbdNcnt ?? r.yuchalCnt ?? r.usflbdNcnt,
        ),
        auctionRound: parseAuctionRound(r) ?? undefined,
        minimumSalePrice: parseAmount(r.lwsDspslPrc ?? r.minmaePrice),
        depositRate: parseBidDepositRate(
          r.grntRt ?? r.ipchalGrntRt ?? r.bidGrntRt ?? r.grntRate,
        ),
        depositAmount: parseBidDepositAmount(
          r.grntAmt ?? r.ipchalGrntAmt ?? r.bidGrntAmt ?? r.grntAm,
        ),
        exclusiveAreaM2:
          parseExclusiveAreaM2([
            {
              minArea: r.minArea,
              maxArea: r.maxArea,
              objctArDts: r.objctArDts,
            },
          ]) ?? undefined,
      };
    });

    let schedule = extractScheduleLists(data).map((row) =>
      parseScheduleRow(row as Record<string, unknown>),
    );

    let searchRows: Array<Record<string, unknown>> | null = null;
    try {
      searchRows = await this.searchPropertyRaw(courtCode, csNo);
      const fromSearch = searchRows.map((row) => {
        const parsed = parsePropertyRow(row);
        return {
          ...parsed,
          address:
            nullIfBlank(row.dongSanAdr) ||
            nullIfBlank(row.userSt) ||
            nullIfBlank(row.st),
        };
      });

      if (fromSearch.length > 0) {
        schedule = [
          ...schedule,
          ...fromSearch.map((row) => ({
            propertyNumber: row.propertyNumber,
            saleDate: row.saleDate,
            appraisedPrice: row.appraisedPrice,
            minimumSalePrice: row.minimumSalePrice,
            depositRate: row.depositRate,
            depositAmount: row.depositAmount,
            failedBidCount: row.failedBidCount,
            auctionRound: row.auctionRound,
            resultCode: row.resultCode,
            exclusiveAreaM2: row.exclusiveAreaM2,
            notifyMinPrices: row.notifyMinPrices,
          })),
        ];

        if (items.length === 0) {
          items = fromSearch.map((row) => ({
            propertyNumber: row.propertyNumber,
            address: row.address,
            appraisedPrice: row.appraisedPrice,
            saleDate: row.saleDate,
            failedBidCount: row.failedBidCount,
            auctionRound: row.auctionRound,
            minimumSalePrice: row.minimumSalePrice,
            depositRate: row.depositRate,
            depositAmount: row.depositAmount,
            exclusiveAreaM2: row.exclusiveAreaM2,
            notifyMinPrices: row.notifyMinPrices,
          }));
        } else {
          items = items.map((item, index) => {
            const seq = item.propertyNumber ?? index + 1;
            const match =
              fromSearch.find((row) => row.propertyNumber === seq) ??
              fromSearch[index];
            if (!match) {
              return { ...item, propertyNumber: item.propertyNumber ?? seq };
            }
            return {
              ...item,
              propertyNumber: item.propertyNumber ?? match.propertyNumber ?? seq,
              address: item.address || match.address,
              appraisedPrice: item.appraisedPrice ?? match.appraisedPrice,
              saleDate: item.saleDate ?? match.saleDate,
              failedBidCount: item.failedBidCount ?? match.failedBidCount,
              auctionRound: item.auctionRound ?? match.auctionRound,
              minimumSalePrice:
                match.minimumSalePrice ?? item.minimumSalePrice,
              depositRate: match.depositRate ?? item.depositRate,
              depositAmount: match.depositAmount ?? item.depositAmount,
              exclusiveAreaM2: match.exclusiveAreaM2 ?? item.exclusiveAreaM2,
              notifyMinPrices: match.notifyMinPrices ?? item.notifyMinPrices,
            };
          });
        }
      }
    } catch {
      // 물건 검색 fallback 실패는 무시
    }

    try {
      const enriched = await this.enrichItemsWithDetailPricing(
        courtCode,
        csNo,
        searchRows,
        items,
        schedule,
      );
      items = enriched.items;
      schedule = enriched.schedule;
    } catch {
      // 물건상세 가격 조회 실패는 사건 생성을 막지 않음
    }

    let exclusiveAreaM2: number | undefined;
    try {
      exclusiveAreaM2 = await this.resolveExclusiveAreaM2(
        courtCode,
        csNo,
        searchRows,
        propertyNumber,
      );
    } catch {
      // 전용면적 조회 실패는 사건 생성을 막지 않음
    }

    return {
      found: true,
      status: raw.status ?? null,
      message: raw.message ?? null,
      caseInfo: {
        courtCode: nullIfBlank(basis.cortOfcCd),
        courtName: nullIfBlank(basis.cortOfcNm),
        caseNumber: nullIfBlank(basis.csNo),
        userCaseNumber:
          nullIfBlank(basis.userCsNo) || nullIfBlank(basis.userReltCsNo),
        caseName: nullIfBlank(basis.csNm),
      },
      items,
      schedule,
      exclusiveAreaM2,
    } satisfies CourtAuctionCasePayload;
  }
}

let singleton: CourtAuctionClient | null = null;

export function getCourtAuctionClient() {
  if (!singleton) singleton = new CourtAuctionClient();
  return singleton;
}

export {
  buildTakyungCaseNumber,
  defaultAuctionYear,
  normalizeCaseNumber,
  parseTakyungCaseNumber,
} from '@/lib/auction/caseNumberFormat';
