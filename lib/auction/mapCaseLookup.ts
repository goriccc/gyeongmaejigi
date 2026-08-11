import {
  formatDisplayCaseNumber,
  formatYmd,
  parseAmount,
  stripHtml,
} from '@/lib/auction/caseNumberFormat';
import { resolveBidDeposit } from '@/lib/auction/bidDeposit';
import { toAuctionRound } from '@/lib/auction/auctionRound';

export type CourtAuctionCasePayload = {
  found: boolean;
  status?: number | null;
  message?: string | null;
  caseInfo?: {
    courtCode?: string | null;
    courtName?: string | null;
    caseNumber?: string | null;
    userCaseNumber?: string | null;
    caseName?: string | null;
  } | null;
  items?: Array<{
    address?: string | null;
    appraisedPrice?: number | null;
    saleDate?: string | null;
    failedBidCount?: number | null;
    auctionRound?: number | null;
  }>;
  schedule?: Array<{
    saleDate?: string | null;
    appraisedPrice?: number | null;
    minimumSalePrice?: number | null;
    depositRate?: number | null;
    depositAmount?: number | null;
    failedBidCount?: number | null;
    auctionRound?: number | null;
    resultCode?: string | null;
    exclusiveAreaM2?: number | null;
  }>;
  /** 법원경매 물건검색·상세에서 해석한 전용면적(㎡) */
  exclusiveAreaM2?: number | null;
};

export type MappedAuctionCase = {
  courtCode: string;
  courtName: string;
  caseNumber: string;
  name: string;
  address: string;
  appraisalValue: number;
  auctionDate: string;
  auctionRound?: number;
  minimumSalePrice?: number;
  bidDepositAmount?: number;
  bidDepositRate?: 10 | 20;
  exclusiveAreaM2?: number;
};

/** 낙찰·유찰 등 명확히 종료된 기일만 제외 */
const CLOSED_RESULT_CODES = new Set(['0003311', '0003312', '0003313']);

function isClosedSchedule(
  row: NonNullable<CourtAuctionCasePayload['schedule']>[number],
) {
  const code = row.resultCode?.trim() ?? '';
  if (!code) return false;
  return CLOSED_RESULT_CODES.has(code);
}

function pickTargetSchedule(
  schedule: NonNullable<CourtAuctionCasePayload['schedule']>,
) {
  const sorted = [...schedule].sort((a, b) =>
    (a.saleDate ?? '').localeCompare(b.saleDate ?? ''),
  );
  if (!sorted.length) return null;

  const today = new Date().toISOString().slice(0, 10);

  const openFuture = sorted.find(
    (s) => s.saleDate && s.saleDate >= today && !isClosedSchedule(s),
  );
  if (openFuture) return openFuture;

  const openAny = sorted.filter((s) => !isClosedSchedule(s));
  if (openAny.length) return openAny[openAny.length - 1];

  return sorted[sorted.length - 1];
}

export function mapCourtAuctionCase(
  payload: CourtAuctionCasePayload,
  courtCode: string,
  courtName?: string,
  inputCaseNumber?: string,
): MappedAuctionCase | null {
  if (!payload.found || !payload.caseInfo) return null;

  const address =
    payload.items?.map((i) => i.address?.trim()).find(Boolean) ?? '';
  const caseNumber = formatDisplayCaseNumber(
    payload.caseInfo.caseNumber,
    payload.caseInfo.userCaseNumber,
    inputCaseNumber,
  );
  const name =
    address ||
    stripHtml(payload.caseInfo.caseName) ||
    caseNumber ||
    '경매 물건';

  const schedule = payload.schedule ?? [];
  const target = pickTargetSchedule(schedule);
  const itemFallback = payload.items?.find(
    (i) => (i.appraisedPrice ?? 0) > 0 || i.saleDate,
  );

  const appraisalValue =
    target?.appraisedPrice ??
    itemFallback?.appraisedPrice ??
    schedule
      .map((s) => s.appraisedPrice ?? 0)
      .filter((n) => n > 0)
      .at(-1) ??
    0;

  const auctionDate =
    target?.saleDate ?? itemFallback?.saleDate ?? schedule.find((s) => s.saleDate)?.saleDate ?? '';

  const minimumSalePrice =
    target?.minimumSalePrice ??
    schedule.map((s) => s.minimumSalePrice ?? 0).filter((n) => n > 0).at(-1);

  const auctionRound =
    target?.auctionRound ??
    payload.items
      ?.map((i) => i.auctionRound ?? undefined)
      .find((v) => v && v > 0) ??
    toAuctionRound(
      target?.failedBidCount ??
        payload.items
          ?.map((i) => i.failedBidCount ?? undefined)
          .find((v) => v !== undefined),
    );

  const deposit = resolveBidDeposit({
    appraisalValue,
    minimumSalePrice,
    depositAmount: target?.depositAmount,
    depositRate: target?.depositRate,
  });

  const exclusiveAreaM2 =
    payload.exclusiveAreaM2 ??
    payload.items
      ?.map((i) => (i as { exclusiveAreaM2?: number | null }).exclusiveAreaM2)
      .find((v) => v && v > 0) ??
    payload.schedule
      ?.map((s) => s.exclusiveAreaM2 ?? undefined)
      .find((v) => v && v > 0);

  return {
    courtCode: payload.caseInfo.courtCode?.trim() || courtCode,
    courtName: payload.caseInfo.courtName?.trim() || courtName || '',
    caseNumber,
    name,
    address,
    appraisalValue,
    auctionDate,
    auctionRound,
    minimumSalePrice: minimumSalePrice || undefined,
    bidDepositAmount: deposit.amount || undefined,
    bidDepositRate: deposit.rate,
    exclusiveAreaM2: exclusiveAreaM2 || undefined,
  };
}

export { formatYmd, parseAmount, stripHtml };
