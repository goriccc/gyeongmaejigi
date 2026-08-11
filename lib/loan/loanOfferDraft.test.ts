import { describe, expect, it } from 'vitest';
import {
  createInitialLoanDrafts,
  loanOffersForSave,
  loanRowHasInput,
  resolveLoanRow,
  templateForLoanRow,
} from './loanOfferDraft';

describe('loanOfferDraft', () => {
  it('빈 행은 placeholder 템플릿으로 계산', () => {
    const row = createInitialLoanDrafts(1)[0];
    const resolved = resolveLoanRow(row, templateForLoanRow(0));
    expect(resolved.name).toBe('김정아 · 전자상거래(근저당)');
    expect(resolved.ltv).toBe(75);
  });

  it('입력한 필드만 실제값, 나머지는 템플릿', () => {
    const row = createInitialLoanDrafts(1)[0];
    row.rate = '5.1';
    const resolved = resolveLoanRow(row, templateForLoanRow(0));
    expect(resolved.rate).toBe(5.1);
    expect(resolved.ltv).toBe(75);
  });

  it('입력 없는 행은 저장에서 제외', () => {
    const rows = createInitialLoanDrafts(2);
    rows[1].name = '직접 입력';
    expect(loanOffersForSave(rows)).toHaveLength(1);
    expect(loanRowHasInput(rows[0])).toBe(false);
  });
});
