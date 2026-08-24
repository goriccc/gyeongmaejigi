import type { RegZone } from './acquisitionTax';

/** 스트레스 DSR 모드 — 한도 산정용 */
export type StressDsrMode = 'policy' | 'none';

/**
 * 금리유형. 1차는 변동형 기본.
 * 혼합·주기는 고정기간 비중에 따라 가산이 완화된다.
 */
export type MortgageRateType = 'floating' | 'hybrid' | 'periodic';

export type HybridFixedShare = 'low' | 'mid' | 'high';

/**
 * 2026.7.1~12.31 은행연합회·금융위 행정지도 기준.
 * 수도권·규제지역 주담대: 스트레스금리 3.0% × 3단계 100%
 * 지방·비규제 주담대: 스트레스금리 1.5% × 2단계 유예 50% → 0.75%p
 */
export const STRESS_DSR_NOTICE =
  '2026.7~12 · 지방 비규제 주담대는 2단계 유예(0.75%p) · 수도권·규제는 3.0%p';

export type StressDsrBreakdown = {
  /** 고시 스트레스금리 (연, 비율) */
  stressRate: number;
  /** 단계별 기본적용비율 0~1 */
  stageRatio: number;
  /** 대출유형별 적용비율 0~1 */
  productRatio: number;
  /** 최종 심사가산(%p → 비율) = stressRate × stageRatio × productRatio */
  premium: number;
  /** 수도권 또는 규제지역 주담대 테이블 사용 여부 */
  usesCapitalTable: boolean;
  label: string;
  notice: string;
};

function productRatioFor(
  rateType: MortgageRateType,
  hybridFixedShare: HybridFixedShare = 'mid',
): number {
  if (rateType === 'floating') return 1;
  if (rateType === 'periodic') {
    // 주기형: 변동주기 비중이 클수록 높음 — 1차 단순화
    if (hybridFixedShare === 'high') return 0;
    if (hybridFixedShare === 'mid') return 0.6;
    return 1;
  }
  // 혼합형: 고정기간 비중
  if (hybridFixedShare === 'high') return 0; // 만기 70%+ 고정 ≈ 미적용
  if (hybridFixedShare === 'mid') return 0.6;
  return 1;
}

/**
 * 지역·규제·금리유형에 따른 스트레스 DSR 가산 분해.
 * 경락대출은 담보대출이므로 신용대출 1억 예외와 무관하게 적용한다.
 */
export function stressDsrBreakdown(input: {
  sudogwon: boolean;
  regZone?: RegZone;
  rateType?: MortgageRateType;
  hybridFixedShare?: HybridFixedShare;
}): StressDsrBreakdown {
  const rateType = input.rateType ?? 'floating';
  const usesCapitalTable =
    Boolean(input.sudogwon) || input.regZone === 'adjusted';

  const stressRate = usesCapitalTable ? 0.03 : 0.015;
  const stageRatio = usesCapitalTable ? 1 : 0.5;
  const productRatio = productRatioFor(
    rateType,
    input.hybridFixedShare ?? 'mid',
  );
  const premium = stressRate * stageRatio * productRatio;

  const regionLabel = usesCapitalTable
    ? input.sudogwon
      ? '수도권'
      : '규제지역'
    : '지방·비규제';
  const typeLabel =
    rateType === 'floating'
      ? '변동형'
      : rateType === 'hybrid'
        ? '혼합형'
        : '주기형';
  const pct = (premium * 100).toFixed(premium % 0.01 === 0 ? 1 : 2);

  return {
    stressRate,
    stageRatio,
    productRatio,
    premium,
    usesCapitalTable,
    label: `${regionLabel}·${typeLabel} · +${pct}%p`,
    notice: usesCapitalTable
      ? '수도권·규제지역 주담대: 스트레스 3.0% × 3단계 100%'
      : '지방 비규제 주담대: 스트레스 1.5% × 2단계 50%(유예) = 0.75%p',
  };
}

/**
 * @deprecated stressDsrBreakdown 사용. 하위호환용.
 * 수도권·규제 3.0%p / 지방·비규제 0.75%p (변동형 기준).
 */
export function stressDsrPremium(
  isSudogwon: boolean,
  regZone: RegZone = 'none',
): number {
  return stressDsrBreakdown({ sudogwon: isSudogwon, regZone }).premium;
}

/** DSR 산정금리 = 약정(가정)금리 + 심사가산 */
export function dsrAssessmentRate(
  contractRate: number,
  premium: number,
): number {
  return Math.max(0, contractRate + premium);
}

/** DSR 심사 기본 만기(개월) · 경락잔금대출 */
export const DSR_TERM_MONTHS_DEFAULT = 360;

/** 거치기간 기본값(개월) — 은행 상담 관행 */
export const DSR_GRACE_MONTHS_DEFAULT = 12;

/** 거치기간 입력 허용 범위 */
export const DSR_GRACE_MONTHS_MIN = 0;
export const DSR_GRACE_MONTHS_MAX = 60;

export function clampGraceMonths(
  graceMonths: number,
  termMonths = DSR_TERM_MONTHS_DEFAULT,
): number {
  if (!Number.isFinite(graceMonths)) return DSR_GRACE_MONTHS_DEFAULT;
  const capped = Math.min(
    DSR_GRACE_MONTHS_MAX,
    Math.max(DSR_GRACE_MONTHS_MIN, Math.round(graceMonths)),
  );
  // 상환기간이 최소 1개월은 남도록
  return Math.min(capped, Math.max(0, termMonths - 1));
}

/**
 * 원리금균등 — 1원당 연평균 상환액 (총상환÷년수).
 */
export function dsrAnnualAvgRepayPerWonEqualPayment(
  assessmentRate: number,
  years = 30,
  graceMonths = DSR_GRACE_MONTHS_DEFAULT,
): number {
  const termMonths = Math.max(1, Math.round(years * 12));
  const grace = clampGraceMonths(graceMonths, termMonths);
  const repayMonths = termMonths - grace;
  if (repayMonths <= 0) return 0;

  const r = assessmentRate / 12;
  const pmtPerWon =
    r <= 0
      ? 1 / repayMonths
      : (r * Math.pow(1 + r, repayMonths)) /
        (Math.pow(1 + r, repayMonths) - 1);

  const totalRepayPerWon = grace * r + repayMonths * pmtPerWon;
  const yearsTotal = termMonths / 12;
  if (yearsTotal <= 0) return 0;
  return totalRepayPerWon / yearsTotal;
}

/**
 * 원금균등 — 1원당 연평균 상환액 (총상환÷년수).
 */
export function dsrAnnualAvgRepayPerWonEqualPrincipal(
  assessmentRate: number,
  years = 30,
  graceMonths = DSR_GRACE_MONTHS_DEFAULT,
): number {
  const termMonths = Math.max(1, Math.round(years * 12));
  const grace = clampGraceMonths(graceMonths, termMonths);
  const repayMonths = termMonths - grace;
  if (repayMonths <= 0) return 0;

  const r = assessmentRate / 12;
  const principalPerMonthPerWon = 1 / repayMonths;

  let balance = 1;
  let totalInterest = 0;

  for (let m = 0; m < grace; m++) {
    totalInterest += balance * r;
  }
  for (let m = 0; m < repayMonths; m++) {
    totalInterest += balance * r;
    balance -= principalPerMonthPerWon;
  }

  const yearsTotal = termMonths / 12;
  if (yearsTotal <= 0) return 0;
  return (1 + totalInterest) / yearsTotal;
}

/**
 * 원리금균등상환 — 전체상환기간 총상환액(원금+이자) 평균 기준 역산.
 * 거치기간에는 이자만, 이후 원리금균등. 거치 0이면 기존 연금현재가치와 동일.
 * @param assessmentRate - DSR 산정금리(스트레스 포함, 연 비율)
 * @param graceMonths - 기본 12(은행 관행). 무거치는 0을 명시하세요.
 */
export function dsrLoanCapacityEqualPayment(
  annualRepayCapacity: number,
  assessmentRate: number,
  years = 30,
  graceMonths = DSR_GRACE_MONTHS_DEFAULT,
): number {
  if (annualRepayCapacity <= 0) return 0;
  const annualAvgPerWon = dsrAnnualAvgRepayPerWonEqualPayment(
    assessmentRate,
    years,
    graceMonths,
  );
  if (annualAvgPerWon <= 0) return 0;
  return annualRepayCapacity / annualAvgPerWon;
}

/**
 * 원금균등상환 — 전체상환기간 총상환액(원금+이자) 평균 기준 역산.
 * 거치기간에는 이자만, 이후 원금균등. 1회차 최대월상환 역산보다
 * 실제 은행 DSR 승인액에 가깝다.
 * @param graceMonths - 기본 12(은행 관행). 무거치는 0을 명시하세요.
 */
export function dsrLoanCapacityEqualPrincipal(
  annualRepayCapacity: number,
  assessmentRate: number,
  years = 30,
  graceMonths = DSR_GRACE_MONTHS_DEFAULT,
): number {
  if (annualRepayCapacity <= 0) return 0;
  const annualAvgPerWon = dsrAnnualAvgRepayPerWonEqualPrincipal(
    assessmentRate,
    years,
    graceMonths,
  );
  if (annualAvgPerWon <= 0) return 0;
  return annualRepayCapacity / annualAvgPerWon;
}

/**
 * 대출원금에 대한 연평균 상환액(원금+이자 총액 ÷ 총년수).
 */
export function dsrAnnualAvgRepay(
  principal: number,
  assessmentRate: number,
  years = 30,
  graceMonths = DSR_GRACE_MONTHS_DEFAULT,
  method: 'equalPrincipal' | 'equalPayment' = 'equalPrincipal',
): number {
  if (principal <= 0) return 0;
  const perWon =
    method === 'equalPayment'
      ? dsrAnnualAvgRepayPerWonEqualPayment(
          assessmentRate,
          years,
          graceMonths,
        )
      : dsrAnnualAvgRepayPerWonEqualPrincipal(
          assessmentRate,
          years,
          graceMonths,
        );
  return principal * perWon;
}

/**
 * 스트레스DSR(%) = 연평균 상환액(스트레스 산정금리) ÷ 연소득.
 * 엑셀·은행 화면의 '스트레스DSR'과 동일 정의.
 */
export function stressDsrRatio(
  principal: number,
  annualIncome: number,
  assessmentRate: number,
  years = 30,
  graceMonths = DSR_GRACE_MONTHS_DEFAULT,
  method: 'equalPrincipal' | 'equalPayment' = 'equalPrincipal',
): number {
  if (annualIncome <= 0 || principal <= 0) return 0;
  return (
    dsrAnnualAvgRepay(
      principal,
      assessmentRate,
      years,
      graceMonths,
      method,
    ) / annualIncome
  );
}

/**
 * 연소득·DSR비율·거치기간으로 원금균등 최대대출한도를 산정합니다.
 * (기존 부채가 있으면 annualIncome*dsrRatio 대신 잔여 여력을 넘기세요)
 */
export function calcMaxLoanEqualPrincipal(
  income: number,
  dsrRatio: number,
  annualRate: number,
  graceMonths: number,
  termMonths = DSR_TERM_MONTHS_DEFAULT,
): number {
  return dsrLoanCapacityEqualPrincipal(
    dsrAnnualRepayCapacity(income, dsrRatio, 0),
    annualRate,
    termMonths / 12,
    graceMonths,
  );
}

/**
 * 연소득·DSR비율·기존 연간원리금으로 신규대출에 쓸 수 있는 연간 상환액.
 */
export function dsrAnnualRepayCapacity(
  annualIncome: number,
  dsrRate: number,
  existingAnnualDebt = 0,
): number {
  return Math.max(0, annualIncome * dsrRate - Math.max(0, existingAnnualDebt));
}

/**
 * @deprecated dsrLoanCapacityEqualPayment 사용.
 * 연금현재가치 공식으로 DSR 기준 최대 대출원금을 산정합니다.
 * (거치 0개월 · 총상환평균 = 기존 PV와 동일)
 */
export function dsrLoanCapacity(
  annualIncome: number,
  dsrRate: number,
  rate: number,
  years = 30,
): number {
  return dsrLoanCapacityEqualPayment(
    dsrAnnualRepayCapacity(annualIncome, dsrRate, 0),
    rate,
    years,
    0,
  );
}
