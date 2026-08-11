/** 임장 구간별 경로 선 색 (지도 polyline용) */
export const ROUTE_LEG_COLORS = [
  '#8c6d34',
  '#2e4b3d',
  '#1a5276',
  '#5c4a72',
  '#8c2f26',
  '#33364a',
] as const;

export function getRouteLegColor(legIndex: number): string {
  return ROUTE_LEG_COLORS[legIndex % ROUTE_LEG_COLORS.length] ?? ROUTE_LEG_COLORS[0];
}
