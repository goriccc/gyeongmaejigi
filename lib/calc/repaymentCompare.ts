/** 교육용 상환방식 비교 (DSR 설명 팝업) */

export type RepaymentCompareSnapshot = {
  firstMonthPrincipal: number;
  midMonthPrincipal: number;
  lastMonthPrincipal: number;
  monthlyPayment: number;
  totalInterestPrincipal: number;
  totalInterestPayment: number;
  totalRepayPrincipal: number;
  totalRepayPayment: number;
};

export function monthlyEqualPayment(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (months <= 0) return 0;
  const r = annualRate / 12;
  if (r <= 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

export function monthlyEqualPrincipal(
  principal: number,
  annualRate: number,
  month: number,
  months: number,
): number {
  if (months <= 0 || month < 1) return 0;
  const r = annualRate / 12;
  const remaining =
    principal - (principal / months) * Math.max(0, month - 1);
  return principal / months + remaining * r;
}

export function totalInterestEqualPrincipal(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (months <= 0) return 0;
  const r = annualRate / 12;
  return (r * principal * (months + 1)) / 2;
}

export function totalInterestEqualPayment(
  principal: number,
  annualRate: number,
  months: number,
): number {
  const pmt = monthlyEqualPayment(principal, annualRate, months);
  return Math.max(0, pmt * months - principal);
}

export function repaymentCompareSnapshot(
  principal: number,
  annualRate: number,
  years: number,
): RepaymentCompareSnapshot {
  const months = years * 12;
  const monthlyPayment = monthlyEqualPayment(principal, annualRate, months);
  const totalInterestPrincipal = totalInterestEqualPrincipal(
    principal,
    annualRate,
    months,
  );
  const totalInterestPayment = totalInterestEqualPayment(
    principal,
    annualRate,
    months,
  );

  return {
    firstMonthPrincipal: monthlyEqualPrincipal(
      principal,
      annualRate,
      1,
      months,
    ),
    midMonthPrincipal: monthlyEqualPrincipal(
      principal,
      annualRate,
      Math.ceil(months / 2),
      months,
    ),
    lastMonthPrincipal: monthlyEqualPrincipal(
      principal,
      annualRate,
      months,
      months,
    ),
    monthlyPayment,
    totalInterestPrincipal,
    totalInterestPayment,
    totalRepayPrincipal: principal + totalInterestPrincipal,
    totalRepayPayment: principal + totalInterestPayment,
  };
}

/** 차트용 월별 상환액 샘플 (균등 간격) */
export function repaymentChartSeries(
  principal: number,
  annualRate: number,
  months: number,
  pointCount = 40,
): { principalLine: number[]; paymentLine: number[] } {
  const count = Math.max(2, Math.min(pointCount, months));
  const principalLine: number[] = [];
  const paymentLine: number[] = [];
  const pmt = monthlyEqualPayment(principal, annualRate, months);

  for (let i = 0; i < count; i++) {
    const month =
      i === count - 1 ? months : Math.round(1 + (i / (count - 1)) * (months - 1));
    principalLine.push(
      monthlyEqualPrincipal(principal, annualRate, month, months),
    );
    paymentLine.push(pmt);
  }

  return { principalLine, paymentLine };
}
