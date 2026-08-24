import { describe, expect, it } from 'vitest';
import { calcEntryMatch } from './entryMatch';
import {
  acquisitionTaxRate,
  firstTimeTaxDeduction,
} from './acquisitionTax';
import {
  dsrAnnualRepayCapacity,
  dsrLoanCapacity,
  dsrLoanCapacityEqualPrincipal,
  stressDsrPremium,
} from './dsr';
import {
  applyLtvWithCredit,
  applyLtvWithPolicy,
  baseLTV,
  loanAmountCap,
  ltvCap,
} from './ltv';
import { regionStatus, regionInvestPossible, regionInvestTitleLabels } from '@/data/regulatedRegions';

describe('baseLTV / applyLtvWithCredit', () => {
  it('주택수별 기준 LTV', () => {
    expect(baseLTV(0)).toBe(0.7);
    expect(baseLTV(1)).toBe(0.6);
    expect(baseLTV(2)).toBe(0.4);
  });

  it('신용 보정 후 클램프', () => {
    expect(applyLtvWithCredit(0, 0.05)).toBe(0.75);
    expect(applyLtvWithCredit(2, -0.05)).toBeCloseTo(0.35);
  });
});

describe('ltvCap (2025.6.27 + 10.15)', () => {
  it('수도권 1주택 이상 → 원칙 LTV 0 (저가특례 포함)', () => {
    expect(ltvCap(true, 'none', 1, false, false, 0.5, false, false)).toBe(0);
    expect(ltvCap(true, 'adjusted', 2, false, false, 0.4, false, false)).toBe(
      0,
    );
    expect(ltvCap(true, 'none', 1, true, false, 0.4, false, false)).toBe(0);
    expect(ltvCap(true, 'none', 1, true, false, 0.5, false, false)).toBe(0);
  });

  it('처분조건부 → 규제 40% / 비규제 70%', () => {
    expect(ltvCap(true, 'adjusted', 1, false, true, 0.5, false, false)).toBe(
      0.4,
    );
    expect(ltvCap(true, 'none', 1, false, true, 0.5, false, false)).toBe(0.7);
  });

  it('지방 1주택 이상 → 상한 없음(1)', () => {
    expect(ltvCap(false, 'none', 1, false, false, 0.5, false, false)).toBe(1);
  });

  it('무주택 규제지역 40%', () => {
    expect(
      ltvCap(true, 'adjusted', 0, false, false, 0.5, false, false),
    ).toBe(0.4);
  });

  it('생애최초 · 서민실수요자 우대', () => {
    expect(ltvCap(true, 'adjusted', 0, false, false, 0.5, true, false)).toBe(
      0.7,
    );
    expect(ltvCap(false, 'none', 0, false, false, 0.5, true, false)).toBe(0.8);
    expect(ltvCap(true, 'adjusted', 0, false, false, 0.5, false, true)).toBe(
      0.6,
    );
  });

  it('정책 상한 0이면 클램프보다 우선', () => {
    expect(
      applyLtvWithPolicy(2, 0, true, 'none', false, false, 0.5, false, false),
    ).toBe(0);
  });
});

describe('loanAmountCap / firstTimeTaxDeduction / stressDsr', () => {
  it('수도권 시가 구간별 캡', () => {
    expect(loanAmountCap(true, 1_000_000_000)).toBe(600_000_000);
    expect(loanAmountCap(true, 2_000_000_000)).toBe(400_000_000);
    expect(loanAmountCap(true, 3_000_000_000)).toBe(200_000_000);
    expect(loanAmountCap(false, 1_000_000_000)).toBe(Number.POSITIVE_INFINITY);
  });

  it('생애최초 취득세 감면 200만원 한도', () => {
    expect(firstTimeTaxDeduction(true, 500_000_000, 5_000_000)).toBe(
      2_000_000,
    );
    expect(firstTimeTaxDeduction(true, 500_000_000, 1_000_000)).toBe(
      1_000_000,
    );
    expect(firstTimeTaxDeduction(true, 1_300_000_000, 5_000_000)).toBe(0);
    expect(firstTimeTaxDeduction(false, 500_000_000, 5_000_000)).toBe(0);
  });

  it('스트레스 DSR 지역 분기 (2026 하반기)', () => {
    expect(stressDsrPremium(true)).toBe(0.03);
    expect(stressDsrPremium(false)).toBe(0.0075);
    expect(stressDsrPremium(false, 'adjusted')).toBe(0.03);
  });
});

describe('acquisitionTaxRate', () => {
  it('6억 이하 1%', () => {
    expect(acquisitionTaxRate(210_000_000, 0, 'none')).toBeCloseTo(0.01);
  });

  it('매수 후 3주택: 비규제 8% / 규제 12%', () => {
    expect(acquisitionTaxRate(500_000_000, 2, 'none')).toBe(0.08);
    expect(acquisitionTaxRate(500_000_000, 2, 'adjusted')).toBe(0.12);
  });

  it('매수 후 4주택 이상: 전국 12%', () => {
    expect(acquisitionTaxRate(500_000_000, 3, 'none')).toBe(0.12);
    expect(acquisitionTaxRate(500_000_000, 3, 'adjusted')).toBe(0.12);
  });

  it('저가주택·처분조건부 특례면 중과 무시', () => {
    expect(
      acquisitionTaxRate(500_000_000, 2, 'adjusted', true, false),
    ).toBeCloseTo(0.01);
    expect(
      acquisitionTaxRate(500_000_000, 3, 'adjusted', false, true),
    ).toBeCloseTo(0.01);
  });
});

describe('regionStatus', () => {
  it('수도권 1주택 → blocked (저가특례여도 blocked)', () => {
    expect(regionStatus(true, 1, false, false)).toBe('blocked');
    expect(regionStatus(true, 1, true, false)).toBe('blocked');
  });

  it('처분조건부면 전국 ok', () => {
    expect(regionStatus(true, 2, false, true)).toBe('ok');
    expect(regionStatus(true, 2, false, true)).toBe('ok');
  });

  it('지방 2주택 → warn, 저가특례면 ok', () => {
    expect(regionStatus(false, 2, false, false)).toBe('warn');
    expect(regionStatus(false, 2, true, false)).toBe('ok');
  });
});

describe('regionInvestPossible', () => {
  it('표 기준 — 수도권·지방 가능/불가', () => {
    expect(regionInvestPossible(true, 0)).toBe(true);
    expect(regionInvestPossible(false, 0)).toBe(true);
    expect(regionInvestPossible(true, 1, true)).toBe(true);
    expect(regionInvestPossible(false, 1, true)).toBe(true);
    expect(regionInvestPossible(true, 1, false)).toBe(false);
    expect(regionInvestPossible(false, 1, false)).toBe(true);
    expect(regionInvestPossible(true, 2, false)).toBe(false);
    expect(regionInvestPossible(true, 2, true)).toBe(false);
    expect(regionInvestPossible(false, 2, false)).toBe(true);
    expect(regionInvestPossible(false, 3, false)).toBe(true);
  });

  it('제목 라벨 — 지방 다주택 취득세 표기', () => {
    expect(regionInvestTitleLabels(2, false, false)).toEqual({
      sudogwon: '불가',
      regional: '가능 (취득세 8%)',
    });
    expect(regionInvestTitleLabels(3, false, false)).toEqual({
      sudogwon: '불가',
      regional: '가능 (취득세 12%)',
    });
    expect(regionInvestTitleLabels(2, false, true)).toEqual({
      sudogwon: '불가',
      regional: '가능',
    });
    expect(regionInvestTitleLabels(0, false, false)).toEqual({
      sudogwon: '가능',
      regional: '가능',
    });
  });
});

describe('dsrLoanCapacity', () => {
  it('원리금균등 연금현재가치 (심사만기 30년)', () => {
    const cap = dsrLoanCapacity(55_000_000, 0.5, 0.045, 30);
    expect(cap).toBeGreaterThan(400_000_000);
    expect(cap).toBeLessThan(500_000_000);
  });

  it('원금균등(총상환평균)과 원리금균등이 동시에 산출된다', () => {
    const income = 50_000_000;
    const dsr = 0.5;
    const rate = 0.075;
    const annual = dsrAnnualRepayCapacity(income, dsr, 0);
    const eqPay = dsrLoanCapacity(income, dsr, rate, 30);
    const eqPrin = dsrLoanCapacityEqualPrincipal(annual, rate, 30, 12);
    expect(eqPrin).toBeGreaterThan(0);
    expect(eqPay).toBeGreaterThan(0);
  });
});

describe('calcEntryMatch', () => {
  const base = {
    seedMoney: 80_000_000,
    creditState: '보통' as const,
    annualIncome: 55_000_000,
    dsrRate: 0.5,
    regZone: 'none' as const,
    lowPriceException: false,
    dispositionPlanned: false,
  };

  it('무주택 비규제 → LTV 제약', () => {
    const result = calcEntryMatch({
      ...base,
      houseCount: 0,
      sudogwon: true,
    });
    expect(result.binding).toBe('LTV');
    expect(result.ltvApplied).toBe(0.7);
  });

  it('수도권 1주택 → LTV 0·대출금지 배지', () => {
    const result = calcEntryMatch({
      ...base,
      houseCount: 1,
      sudogwon: true,
    });
    expect(result.ltvApplied).toBe(0);
    expect(result.loanCapacity).toBe(0);
    expect(result.loanBadge).toBe('수도권 다주택 대출금지');
  });

  it('수도권 저가특례 → 대출금지 유지·취득세만 특례', () => {
    const result = calcEntryMatch({
      ...base,
      houseCount: 1,
      sudogwon: true,
      lowPriceException: true,
    });
    expect(result.ltvApplied).toBe(0);
    expect(result.loanCapacity).toBe(0);
    expect(result.loanBadge).toBe('수도권 다주택 대출금지');
    expect(result.taxRate).toBeCloseTo(0.01);
  });

  it('처분조건부 → 무주택자 기준 LTV·취득세', () => {
    const result = calcEntryMatch({
      ...base,
      houseCount: 1,
      sudogwon: true,
      dispositionPlanned: true,
      regZone: 'none',
    });
    expect(result.ltvApplied).toBe(0.6);
    expect(result.loanBadge).toBe('처분조건부 · 무주택자 기준 적용');
    expect(result.taxRate).toBeCloseTo(0.01);
  });

  it('생애최초 → 우대 LTV·취득세 감면', () => {
    const result = calcEntryMatch({
      ...base,
      houseCount: 0,
      sudogwon: true,
      regZone: 'adjusted',
      firstTimeBuyer: true,
    });
    expect(result.ltvApplied).toBe(0.7);
    expect(result.loanBadge).toBe('생애최초 우대 LTV 적용');
    expect(result.taxDeduction).toBeGreaterThan(0);
  });

  it('원금균등(총상환평균)이 동일 조건에서 원리금균등보다 한도가 크다', () => {
    const baseInput = {
      seedMoney: 80_000_000,
      houseCount: 0 as const,
      creditState: '보통' as const,
      annualIncome: 55_000_000,
      dsrRate: 0.5,
      regZone: 'none' as const,
      sudogwon: true,
      lowPriceException: false,
      dispositionPlanned: false,
      graceMonths: 12,
    };
    const principal = calcEntryMatch({
      ...baseInput,
      dsrRepaymentMethod: 'equalPrincipal',
    });
    const payment = calcEntryMatch({
      ...baseInput,
      dsrRepaymentMethod: 'equalPayment',
    });
    expect(principal.dsrCapacity).toBeGreaterThan(payment.dsrCapacity);
    expect(principal.graceMonths).toBe(12);
  });

  it('기존부채가 있으면 DSR 한도 도달 시 스트레스DSR이 목표비율보다 낮다', () => {
    const result = calcEntryMatch({
      seedMoney: 500_000_000,
      houseCount: 0,
      creditState: '우수',
      annualIncome: 49_200_000,
      dsrRate: 0.5,
      sudogwon: true,
      existingAnnualDebt: 5_000_000,
      contractRate: 0.055,
      stressMode: 'policy',
      graceMonths: 12,
      dsrRepaymentMethod: 'equalPrincipal',
    });
    expect(result.binding).toBe('DSR');
    expect(result.stressDsrRatio).toBeLessThan(0.5);
    expect(result.stressDsrRatio).toBeGreaterThan(0.35);
  });
});
