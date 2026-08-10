/**
 * 스트레스 DSR 가산금리 (연, 비율).
 * 수도권 +3%p (2025.10.29~), 지방 +1.5%p (2026년 기준).
 */
export function stressDsrPremium(isSudogwon: boolean): number {
  return isSudogwon ? 0.03 : 0.015;
}

/**
 * 연금현재가치 공식으로 DSR 기준 최대 대출원금을 산정합니다.
 * @param annualIncome - 연소득(원)
 * @param dsrRate - DSR 한도 비율 (예: 0.4, 0.5)
 * @param rate - 가정 금리(연, 비율) — 스트레스 가산을 포함한 값을 전달하세요
 * @param years - 심사만기(년). 경락잔금대출(담보) 기본 30년
 * @returns DSR 대출한도(원)
 */
export function dsrLoanCapacity(
  annualIncome: number,
  dsrRate: number,
  rate: number,
  years = 30,
): number {
  const maxAnnualRepay = annualIncome * dsrRate;
  if (rate <= 0) return maxAnnualRepay * years;
  return (maxAnnualRepay * (1 - Math.pow(1 + rate, -years))) / rate;
}
