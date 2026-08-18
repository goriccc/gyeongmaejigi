import { looksLikeComplexName } from '@/lib/field/complexName';
import type { LiquidityKind } from '@/lib/field/tradeLiquidity';

export type PropType = '아파트' | '다세대' | '다가구';

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
