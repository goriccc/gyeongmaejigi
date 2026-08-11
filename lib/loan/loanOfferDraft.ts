import {
  DEFAULT_LOAN_OFFERS,
  GENERIC_LOAN_TEMPLATE,
  type LoanOfferTemplate,
} from '@/data/defaultLoanOffers';
import type { LoanOffer } from '@/types/case';

/** UI 입력 상태 (빈 문자열 = placeholder·계산 시 템플릿 사용) */
export type LoanRowDraft = {
  id: string;
  name: string;
  ltv: string;
  rate: string;
  prepayRate: string;
  prepayPeriod: string;
};

export function templateForLoanRow(index: number): LoanOfferTemplate {
  return DEFAULT_LOAN_OFFERS[index] ?? GENERIC_LOAN_TEMPLATE;
}

export function createInitialLoanDrafts(count = 3): LoanRowDraft[] {
  return Array.from({ length: count }, () => emptyLoanRowDraft());
}

export function emptyLoanRowDraft(id?: string): LoanRowDraft {
  return {
    id: id ?? `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    ltv: '',
    rate: '',
    prepayRate: '',
    prepayPeriod: '',
  };
}

export function loanRowHasInput(row: LoanRowDraft): boolean {
  return (
    row.name.trim() !== '' ||
    row.ltv.trim() !== '' ||
    row.rate.trim() !== '' ||
    row.prepayRate.trim() !== '' ||
    row.prepayPeriod.trim() !== ''
  );
}

export function resolveLoanRow(
  row: LoanRowDraft,
  template: LoanOfferTemplate,
): LoanOffer {
  return {
    id: row.id,
    name: row.name.trim() || template.name,
    ltv: row.ltv.trim() ? parseFloat(row.ltv) || 0 : template.ltv,
    rate: row.rate.trim() ? parseFloat(row.rate) || 0 : template.rate,
    prepayRate: row.prepayRate.trim()
      ? parseFloat(row.prepayRate) || 0
      : template.prepayRate,
    prepayPeriod: row.prepayPeriod.trim()
      ? parseFloat(row.prepayPeriod) || 0
      : template.prepayPeriod,
  };
}

export function resolveLoanRows(rows: LoanRowDraft[]): LoanOffer[] {
  return rows.map((row, index) => resolveLoanRow(row, templateForLoanRow(index)));
}

/** 저장된 실제 데이터 → 입력칸 문자열 */
export function loanDraftsFromSaved(offers: LoanOffer[]): LoanRowDraft[] {
  return offers.map((o) => ({
    id: o.id,
    name: o.name,
    ltv: String(o.ltv),
    rate: String(o.rate),
    prepayRate: String(o.prepayRate),
    prepayPeriod: String(o.prepayPeriod),
  }));
}

/** 입력이 있는 행만 저장 (전부 placeholder면 빈 배열) */
export function loanOffersForSave(rows: LoanRowDraft[]): LoanOffer[] {
  return rows
    .map((row, index) =>
      loanRowHasInput(row) ? resolveLoanRow(row, templateForLoanRow(index)) : null,
    )
    .filter((row): row is LoanOffer => row != null);
}

export function sanitizeLoanDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}

export function sanitizeLoanIntegerInput(raw: string): string {
  return raw.replace(/\D/g, '');
}
