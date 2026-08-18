import {
  formatDisplayCaseNumber,
  formatYmd,
  parseAmount,
  stripHtml,
} from '@/lib/auction/caseNumberFormat';
import { resolveBidDeposit } from '@/lib/auction/bidDeposit';
import { resolveMinimumSalePrice } from '@/lib/auction/minimumSalePrice';
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
  }>;
  schedule?: Array<{
    propertyNumber?: number | null;
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
  propertyNumber: number;
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

type ScheduleRow = NonNullable<CourtAuctionCasePayload['schedule']>[number];

/** 낙찰·유찰 등 명확히 종료된 기일만 제외 */
const CLOSED_RESULT_CODES = new Set(['0003311', '0003312', '0003313']);

function isClosedSchedule(row: ScheduleRow) {
  const code = row.resultCode?.trim() ?? '';
  if (!code) return false;
  return CLOSED_RESULT_CODES.has(code);
}

function coalesceAmount(
  primary?: number | null,
  secondary?: number | null,
): number | undefined {
  if (primary != null && primary > 0) return primary;
  if (secondary != null && secondary > 0) return secondary;
  return undefined;
}

function scheduleRowKey(row: ScheduleRow): string {
  return `${row.propertyNumber ?? 0}|${row.saleDate ?? ''}`;
}

/** 사건상세·물건검색 등에서 중복된 기일 행을 하나로 합칩니다. */
export function mergeScheduleEntries(schedule: ScheduleRow[]): ScheduleRow[] {
  const byKey = new Map<string, ScheduleRow>();

  for (const row of schedule) {
    const key = scheduleRowKey(row);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...row });
      continue;
    }
    byKey.set(key, {
      propertyNumber: prev.propertyNumber ?? row.propertyNumber,
      saleDate: prev.saleDate ?? row.saleDate,
      appraisedPrice: coalesceAmount(prev.appraisedPrice, row.appraisedPrice),
      minimumSalePrice: coalesceAmount(
        prev.minimumSalePrice,
        row.minimumSalePrice,
      ),
      depositRate: prev.depositRate ?? row.depositRate,
      depositAmount: coalesceAmount(prev.depositAmount, row.depositAmount),
      failedBidCount: prev.failedBidCount ?? row.failedBidCount,
      auctionRound: prev.auctionRound ?? row.auctionRound,
      resultCode: prev.resultCode ?? row.resultCode,
      exclusiveAreaM2: coalesceAmount(prev.exclusiveAreaM2, row.exclusiveAreaM2),
    });
  }

  return [...byKey.values()];
}

function pickTargetSchedule(schedule: ScheduleRow[]) {
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

function hasPricing(row: ScheduleRow): boolean {
  return (
    (row.minimumSalePrice ?? 0) > 0 ||
    (row.depositAmount ?? 0) > 0 ||
    row.depositRate != null
  );
}

/** 금번 회차·기일과 맞는 최저가·보증금 행 */
function pickPricingScheduleRow(
  schedule: ScheduleRow[],
  target: ScheduleRow | null,
  auctionRound?: number,
): ScheduleRow | null {
  if (target && hasPricing(target)) return target;

  if (target?.saleDate) {
    const sameDate = schedule.find(
      (s) => s.saleDate === target.saleDate && hasPricing(s),
    );
    if (sameDate) return sameDate;
  }

  if (auctionRound && auctionRound > 0) {
    const sameRound = schedule.find(
      (s) => s.auctionRound === auctionRound && hasPricing(s),
    );
    if (sameRound) return sameRound;

    const failed = auctionRound - 1;
    const byFailed = schedule.find(
      (s) => s.failedBidCount === failed && hasPricing(s),
    );
    if (byFailed) return byFailed;
  }

  const today = new Date().toISOString().slice(0, 10);
  const openFuture = [...schedule]
    .filter(
      (s) =>
        s.saleDate &&
        s.saleDate >= today &&
        !isClosedSchedule(s) &&
        hasPricing(s),
    )
    .sort((a, b) => (a.saleDate ?? '').localeCompare(b.saleDate ?? ''));
  if (openFuture.length) return openFuture[0];

  const open = schedule.filter((s) => !isClosedSchedule(s) && hasPricing(s));
  if (open.length) return open[open.length - 1];

  return target;
}

export function normalizePropertyNumber(value?: number | null): number {
  if (value == null || !Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

export function parsePropertySeq(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

function pickPropertyItem<
  T extends { propertyNumber?: number | null },
>(items: T[] | undefined, propertyNumber: number): T | undefined {
  if (!items?.length) return undefined;
  const bySeq = items.find((item) => item.propertyNumber === propertyNumber);
  if (bySeq) return bySeq;
  const idx = propertyNumber - 1;
  return items[idx] ?? items[0];
}

function filterScheduleForProperty(
  schedule: NonNullable<CourtAuctionCasePayload['schedule']>,
  propertyNumber: number,
) {
  const tagged = schedule.filter(
    (row) => row.propertyNumber === propertyNumber,
  );
  if (tagged.length) return tagged;
  if (propertyNumber === 1 && schedule.every((row) => row.propertyNumber == null)) {
    return schedule;
  }
  return [];
}

export function mapCourtAuctionCase(
  payload: CourtAuctionCasePayload,
  courtCode: string,
  courtName?: string,
  inputCaseNumber?: string,
  propertyNumberInput?: number,
): MappedAuctionCase | null {
  if (!payload.found || !payload.caseInfo) return null;

  const propertyNumber = normalizePropertyNumber(propertyNumberInput);
  const targetItem = pickPropertyItem(payload.items, propertyNumber);

  const address =
    targetItem?.address?.trim() ||
    payload.items?.map((i) => i.address?.trim()).find(Boolean) ||
    '';
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
  const propertySchedule = mergeScheduleEntries(
    filterScheduleForProperty(schedule, propertyNumber),
  );
  const target = propertySchedule.length
    ? pickTargetSchedule(propertySchedule)
    : null;

  const auctionRound =
    target?.auctionRound ??
    targetItem?.auctionRound ??
    toAuctionRound(
      target?.failedBidCount ?? targetItem?.failedBidCount,
    );

  const pricing = pickPricingScheduleRow(
    propertySchedule,
    target,
    auctionRound,
  );

  const appraisalValue =
    pricing?.appraisedPrice ??
    target?.appraisedPrice ??
    targetItem?.appraisedPrice ??
    0;

  const auctionDate =
    pricing?.saleDate ?? target?.saleDate ?? targetItem?.saleDate ?? '';

  const minimumSalePriceRaw =
    targetItem?.minimumSalePrice ??
    pricing?.minimumSalePrice ??
    target?.minimumSalePrice ??
    undefined;

  const minimumSalePrice = resolveMinimumSalePrice({
    appraisalValue,
    auctionRound,
    failedBidCount: target?.failedBidCount ?? targetItem?.failedBidCount,
    apiMinPrice: minimumSalePriceRaw,
    notifyMinPrices: targetItem?.notifyMinPrices,
  });

  const deposit = resolveBidDeposit({
    appraisalValue,
    minimumSalePrice,
    depositAmount:
      targetItem?.depositAmount ??
      pricing?.depositAmount ??
      target?.depositAmount,
    depositRate:
      targetItem?.depositRate ??
      pricing?.depositRate ??
      target?.depositRate,
  });

  const exclusiveAreaM2 =
    payload.exclusiveAreaM2 ??
    targetItem?.exclusiveAreaM2 ??
    propertySchedule.find((s) => s.exclusiveAreaM2 && s.exclusiveAreaM2 > 0)
      ?.exclusiveAreaM2;

  return {
    courtCode: payload.caseInfo.courtCode?.trim() || courtCode,
    courtName: payload.caseInfo.courtName?.trim() || courtName || '',
    caseNumber,
    propertyNumber,
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
