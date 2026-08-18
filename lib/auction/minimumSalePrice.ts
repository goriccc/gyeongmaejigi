/** 매각 회차별 최저매각가 — API·상세 조회값이 없을 때만 보정 */

export function computeRoundMinimumPrice(
  appraisalValue: number,
  failedBidCount: number,
): number {
  if (appraisalValue <= 0 || failedBidCount < 0) return 0;
  return Math.round(appraisalValue * 0.8 ** failedBidCount);
}

export function resolveAuctionRound(input: {
  auctionRound?: number | null;
  failedBidCount?: number | null;
}): number | undefined {
  if (input.auctionRound != null && input.auctionRound > 0) {
    return input.auctionRound;
  }
  if (input.failedBidCount != null && input.failedBidCount >= 0) {
    return input.failedBidCount + 1;
  }
  return undefined;
}

function parseNotifyMinPrices(raw: unknown): number[] {
  if (!raw || typeof raw !== 'object') return [];
  const row = raw as Record<string, unknown>;
  const out: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const v = row[`notifyMinmaePrice${i}`];
    if (v == null || v === '') continue;
    const n = Number(String(v).replace(/[^\d]/g, ''));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

export function extractNotifyMinPrices(source: unknown): number[] {
  if (Array.isArray(source)) {
    for (const row of source) {
      const prices = parseNotifyMinPrices(row);
      if (prices.length) return prices;
    }
    return [];
  }
  return parseNotifyMinPrices(source);
}

/**
 * 법원경매 물건내역·상세 API 값을 우선합니다.
 * minmaePrice가 감정가와 같을 때만 유찰 횟수 기준 80% 보정을 씁니다.
 */
export function resolveMinimumSalePrice(input: {
  appraisalValue: number;
  auctionRound?: number | null;
  failedBidCount?: number | null;
  apiMinPrice?: number | null;
  notifyMinPrices?: number[];
}): number | undefined {
  const { appraisalValue } = input;
  const apiMin = input.apiMinPrice ?? 0;

  if (apiMin > 0 && (appraisalValue <= 0 || apiMin < appraisalValue * 0.99)) {
    return apiMin;
  }

  if (appraisalValue <= 0) {
    return apiMin > 0 ? apiMin : undefined;
  }

  const failed =
    input.failedBidCount ??
    (input.auctionRound != null && input.auctionRound > 0
      ? input.auctionRound - 1
      : 0);

  const notifyForRound = input.notifyMinPrices?.[failed];
  if (notifyForRound && notifyForRound > 0) return notifyForRound;

  const expected = computeRoundMinimumPrice(appraisalValue, failed);
  return expected > 0 ? expected : undefined;
}
