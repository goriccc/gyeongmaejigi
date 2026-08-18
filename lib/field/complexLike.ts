import { looksLikeComplexName } from '@/lib/field/complexName';
import type { LiquidityKind } from '@/lib/field/tradeLiquidity';

export type PropType = '아파트' | '다세대' | '다가구';

/** 건축대장 주용도·기타용도로 실거래 조회 유형을 맞춘다 */
export function inferPropTypeFromLedger(
  titles: Array<{ mainPurpsCdNm?: string | null; etcPurps?: string | null }>,
  fallback: PropType,
): PropType {
  const blob = titles
    .map((t) => `${t.mainPurpsCdNm ?? ''} ${t.etcPurps ?? ''}`)
    .join(' ');
  if (/다세대/.test(blob)) return '다세대';
  if (/다가구/.test(blob)) return '다가구';
  if (/아파트/.test(blob)) return '아파트';
  return fallback;
}

export function isComplexLike(input: {
  propType: PropType;
  name: string;
  uniqueDongs: number;
  titleBuildings: number;
}): boolean {
  if (input.propType === '아파트') return true;
  if (input.titleBuildings >= 2) return true;
  if (input.uniqueDongs >= 2) return true;
  if (looksLikeComplexName(input.name)) return true;
  return false;
}

export function liquidityKindFor(
  propType: PropType,
  complexLike: boolean,
): LiquidityKind | null {
  if (propType === '아파트') return 'apt';
  if (complexLike) return 'complexOther';
  return null;
}
