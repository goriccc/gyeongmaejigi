import { parseBidDepositAmount, parseBidDepositRate } from '@/lib/auction/bidDeposit';
import { parseAuctionRound, parseFailedBidCount, toAuctionRound } from '@/lib/auction/auctionRound';
import { formatYmd, parseAmount, stripHtml } from '@/lib/auction/caseNumberFormat';
import { parseExclusiveAreaM2 } from '@/lib/auction/exclusiveArea';

export type PropertyDetailPricing = {
  appraisedPrice?: number;
  minimumSalePrice?: number;
  depositRate?: 10 | 20 | null;
  depositAmount?: number;
  failedBidCount?: number;
  auctionRound?: number;
  saleDate?: string;
  exclusiveAreaM2?: number;
};

function nullIfBlank(value: unknown): string | null {
  const text = stripHtml(value);
  return text || null;
}

function pickCurrentMinimumFromDxdyList(
  rows: Array<Record<string, unknown>>,
  saleDate: string,
): number | undefined {
  const match = rows.find((row) => {
    if (nullIfBlank(row.auctnDxdyKndCd) !== '01') return false;
    return formatYmd(row.dxdyYmd) === saleDate;
  });
  const fromMatch = parseAmount(match?.tsLwsDspslPrc);
  if (fromMatch && fromMatch > 0) return fromMatch;

  const today = new Date().toISOString().slice(0, 10);
  const open = rows
    .filter((row) => {
      if (nullIfBlank(row.auctnDxdyKndCd) !== '01') return false;
      const ymd = formatYmd(row.dxdyYmd);
      const min = parseAmount(row.tsLwsDspslPrc);
      const rslt = nullIfBlank(row.auctnDxdyRsltCd);
      return ymd >= today && min != null && min > 0 && !rslt;
    })
    .sort((a, b) =>
      formatYmd(a.dxdyYmd).localeCompare(formatYmd(b.dxdyYmd)),
    );

  const fromOpen = parseAmount(open[0]?.tsLwsDspslPrc);
  return fromOpen && fromOpen > 0 ? fromOpen : undefined;
}

function pickPbancMinimum(
  dx: Record<string, unknown>,
  failedBidCount: number | null,
): number | undefined {
  const keys = [
    'fstPbancLwsDspslPrc',
    'scndPbancLwsDspslPrc',
    'thrdPbancLwsDspslPrc',
    'fothPbancLwsDspslPrc',
  ] as const;
  for (const key of keys) {
    const v = parseAmount(dx[key]);
    if (v && v > 0) return v;
  }
  if (failedBidCount != null && failedBidCount >= 0) {
    const idx = Math.min(failedBidCount, keys.length - 1);
    const v = parseAmount(dx[keys[idx]]);
    if (v && v > 0) return v;
  }
  return undefined;
}

/** 물건상세(PGJ15BM01) — 법원경매정보 물건내역과 동일한 최저가·보증금 */
export function parsePropertyDetailPricing(
  data: Record<string, unknown>,
): PropertyDetailPricing | null {
  const result = data.dma_result as Record<string, unknown> | undefined;
  if (!result) return null;

  const dx = result.dspslGdsDxdyInfo as Record<string, unknown> | undefined;
  if (!dx) return null;

  const appraisedPrice = parseAmount(dx.aeeEvlAmt) ?? undefined;
  const failedBidCount = parseFailedBidCount(dx.flbdNcnt ?? dx.yuchalCnt);
  const auctionRound =
    parseAuctionRound(dx) ?? toAuctionRound(failedBidCount) ?? undefined;
  const saleDate = formatYmd(dx.dspslDxdyYmd) || undefined;
  const depositRate = parseBidDepositRate(
    dx.prchDposRate ?? dx.grntRt ?? dx.ipchalGrntRt ?? dx.bidGrntRt,
  );
  const depositAmount =
    parseBidDepositAmount(
      dx.grntAmt ?? dx.ipchalGrntAmt ?? dx.prchDposAmt ?? dx.bidGrntAmt,
    ) ?? undefined;

  const dxdyList = Array.isArray(result.gdsDspslDxdyLst)
    ? (result.gdsDspslDxdyLst as Array<Record<string, unknown>>)
    : [];

  let minimumSalePrice =
    (saleDate
      ? pickCurrentMinimumFromDxdyList(dxdyList, saleDate)
      : undefined) ??
    parseAmount(dx.lwsDspslPrc ?? dx.tsLwsDspslPrc) ??
    pickPbancMinimum(dx, failedBidCount) ??
    undefined;

  const objects = Array.isArray(result.gdsDspslObjctLst)
    ? (result.gdsDspslObjctLst as Array<Record<string, unknown>>)
    : [];
  const buildingDetails = Array.isArray(result.bldSdtrDtlLstAll)
    ? (result.bldSdtrDtlLstAll as Array<
        Array<Record<string, unknown>> | Record<string, unknown>
      >)
    : [];

  const areaSources: Array<Record<string, unknown>> = [];
  for (const obj of objects) {
    areaSources.push({
      pjbBuldList: obj.pjbBuldList,
      objctArDts: obj.objctArDts,
      rletDvsDts: obj.rletDvsDts,
    });
  }
  for (const entry of buildingDetails) {
    const rows = Array.isArray(entry) ? entry : [entry];
    for (const row of rows) {
      areaSources.push({
        rletDvsDts: row.rletDvsDts,
        bldSdtrDtlDts: row.bldSdtrDtlDts,
      });
    }
  }
  const exclusiveAreaM2 = parseExclusiveAreaM2(areaSources) ?? undefined;

  if (
    minimumSalePrice == null &&
    appraisedPrice == null &&
    depositRate == null &&
    depositAmount == null
  ) {
    return null;
  }

  return {
    appraisedPrice,
    minimumSalePrice,
    depositRate,
    depositAmount,
    failedBidCount: failedBidCount ?? undefined,
    auctionRound,
    saleDate,
    exclusiveAreaM2,
  };
}
