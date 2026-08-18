export function locationHintLines(address: string): string[] {
  const addr = address.trim();
  if (!addr) return [];
  const lines: string[] = [];

  if (/역\s*\d*\s*m|역세권|역\s*인근|역\s*앞|역\s*근처/.test(addr)) {
    lines.push('역세권 추정 — 유동인구·소음·야간 조명을 현장에서 확인');
  }
  if (/산\s*\d+|고개|언덕|경사|해발/.test(addr)) {
    lines.push('경사 구간 추정 — 주차·배수·겨울 결빙·보행 접근성 확인');
  }
  if (/리\s|\d+리\s|면\s|읍\s/.test(addr) && !/구\s|동\s/.test(addr)) {
    lines.push('외곽·읍면 추정 — 대중교통·마트·생활편의 접근성 확인');
  }
  return lines;
}
