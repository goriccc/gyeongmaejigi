import { stripHtml } from '@/lib/auction/caseNumberFormat';

const AREA_SUFFIX_RE = /(\d+(?:\.\d+)?)\s*㎡\s*$/;

/** "철근콘크리트구조 49.67㎡" 등에서 전용면적(㎡) 추출 */
export function parseExclusiveAreaFromText(value: unknown): number | null {
  const text = stripHtml(value);
  if (!text) return null;
  const match = text.match(AREA_SUFFIX_RE);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseNumericArea(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  const text = stripHtml(value).replace(/,/g, '');
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) && num > 0 ? num : null;
}

type AreaSource = {
  minArea?: unknown;
  maxArea?: unknown;
  objctArDts?: unknown;
  pjbBuldList?: unknown;
  bldSdtrDtlDts?: unknown;
  rletDvsDts?: unknown;
};

/** 물건 검색·상세 API 필드에서 전용면적(㎡) 해석 — 상세(전유) 우선 */
export function parseExclusiveAreaM2(sources: AreaSource[]): number | null {
  for (const source of sources) {
    if (source.rletDvsDts === '전유' && source.bldSdtrDtlDts) {
      const fromExclusive = parseExclusiveAreaFromText(source.bldSdtrDtlDts);
      if (fromExclusive) return fromExclusive;
    }
  }

  for (const source of sources) {
    const fromPjb = parseExclusiveAreaFromText(source.pjbBuldList);
    if (fromPjb) return fromPjb;

    const fromObjct = parseNumericArea(source.objctArDts);
    if (fromObjct) return fromObjct;

    const maxArea = parseNumericArea(source.maxArea);
    const minArea = parseNumericArea(source.minArea);
    if (maxArea) return maxArea;
    if (minArea) return minArea;
  }

  for (const source of sources) {
    const fromBld = parseExclusiveAreaFromText(source.bldSdtrDtlDts);
    if (fromBld) return fromBld;
  }

  return null;
}
