/**
 * 연금현재가치 공식으로 DSR 기준 최대 대출원금을 산정합니다.
 * @param annualIncome - 연소득(원)
 * @param dsrRate - DSR 한도 비율 (예: 0.4, 0.5)
 * @param rate - 가정 금리(연, 비율)
 * @param years - 심사만기(년), 기본 10년
 * @returns DSR 대출한도(원)
 */
export function dsrLoanCapacity(
  annualIncome: number,
  dsrRate: number,
  rate: number,
  years = 10,
): number {
  const maxAnnualRepay = annualIncome * dsrRate;
  if (rate <= 0) return maxAnnualRepay * years;
  return (maxAnnualRepay * (1 - Math.pow(1 + rate, -years))) / rate;
}
