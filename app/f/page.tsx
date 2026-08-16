'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { newLoanOfferId } from '@/data/defaultLoanOffers';
import { WonExactAmt } from '@/components/bid/WonExactDisplay';
import { bidResultFromSaved } from '@/lib/calc/bidFromCase';
import { rankLoanOffers } from '@/lib/calc/loanCompare';
import { fmtWonExact } from '@/lib/format';
import {
  createInitialLoanDrafts,
  emptyLoanRowDraft,
  loanDraftsFromSaved,
  loanOffersForSave,
  loanRowHasInput,
  resolveLoanRows,
  sanitizeLoanDecimalInput,
  sanitizeLoanIntegerInput,
  templateForLoanRow,
  type LoanRowDraft,
} from '@/lib/loan/loanOfferDraft';
import { useCases } from '@/lib/hooks/useCases';
import { useDebouncedSave } from '@/lib/hooks/useDebouncedSave';
import { afterLoanCompareSaved } from '@/lib/stage';
import { ko } from '@/messages/ko';

export default function LoanComparePage() {
  const router = useRouter();
  const { activeCase, updateCase } = useCases();
  const saved = activeCase?.bidCalcInputs;

  const [loanRows, setLoanRows] = useState<LoanRowDraft[]>(() =>
    activeCase?.loanOffers?.length
      ? loanDraftsFromSaved(activeCase.loanOffers)
      : createInitialLoanDrafts(),
  );

  useEffect(() => {
    if (activeCase?.loanOffers?.length) {
      setLoanRows(loanDraftsFromSaved(activeCase.loanOffers));
    } else if (activeCase) {
      setLoanRows(createInitialLoanDrafts());
    }
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bid = useMemo(
    () => bidResultFromSaved(saved, activeCase?.exclusiveAreaM2),
    [saved, activeCase?.exclusiveAreaM2],
  );

  const rankedLoans = useMemo(() => {
    if (!bid || !saved) return [];
    const resolved = resolveLoanRows(loanRows).map((l) => ({
      ...l,
      ltv: l.ltv / 100,
      rate: l.rate / 100,
      prepayRate: l.prepayRate / 100,
    }));
    return rankLoanOffers(
      resolved,
      bid.bidPrice,
      bid.effectiveSellPrice,
      bid.financeFreeDetailed,
      saved.months,
    );
  }, [loanRows, bid, saved]);

  const rowIndexById = useMemo(
    () => new Map(loanRows.map((row, index) => [row.id, index])),
    [loanRows],
  );

  useDebouncedSave(
    loanRows,
    500,
    (payload) => {
      if (!activeCase) return;
      const patch: Parameters<typeof updateCase>[1] = {
        loanOffers: loanOffersForSave(payload),
      };
      if (activeCase.bidOutcome === 'won') {
        patch.stage = afterLoanCompareSaved(activeCase.stage);
      }
      updateCase(activeCase.id, patch);
    },
    Boolean(activeCase),
    activeCase?.id,
  );

  function updateLoanRow(id: string, patch: Partial<LoanRowDraft>) {
    setLoanRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addLoan() {
    setLoanRows((prev) => [...prev, emptyLoanRowDraft(newLoanOfferId())]);
  }

  function removeLoan(id: string) {
    setLoanRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  function goToEviction() {
    if (!activeCase) return;
    updateCase(activeCase.id, { stage: 'E', bidOutcome: 'won' });
    router.push('/e');
  }

  return (
    <>
      <div className="chapter-mark">제5장 · 대출상품 비교</div>
      <h1 className="page-title">
        낙찰 후 받은
        <br />
        <em>대출 조건</em>을 비교합니다.
      </h1>
      <p className="page-sub">
        명함을 주고받은 대출상담사들의 LTV·금리·중도상환수수료를 입력하면
        제4장 입찰가 역산 결과 기준 세후 수익으로 자동 정렬됩니다.
      </p>

      {!activeCase ? (
        <div className="banner">{ko.common.noActiveCase}</div>
      ) : null}

      {activeCase && !saved ? (
        <div className="banner">
          제4장에서 입찰가·매도가를 먼저 계산해 주세요.{' '}
          <Link href="/d" className="btn-text">
            입찰가 계산 →
          </Link>
        </div>
      ) : null}

      {bid && saved ? (
        <Section
          title="역산 기준 (제4장)"
          note="아래 수치는 제4장 입찰가 계산 결과입니다. 변경하려면 제4장으로 돌아가세요."
        >
          <div className="result-row">
            <span>입찰가</span>
            <WonExactAmt amount={bid.bidPrice} />
          </div>
          <div className="result-row">
            <span>매도가</span>
            <WonExactAmt amount={saved.sellPrice} />
          </div>
          <div className="result-row">
            <span>보유기간</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{saved.months}개월</span>
          </div>
          <Link href="/d" className="btn-text" style={{ marginTop: 12 }}>
            제4장에서 수정 →
          </Link>
        </Section>
      ) : null}

      <Section
        title="대출상품 비교"
        note='회색 예시는 참고용 입니다. 입력을 시작하면 사라지고, 순위·수익은 입력값(미입력 칸은 예시값) 기준으로 계산됩니다.'
      >
        {!saved ? (
          <p className="field-hint">입찰가 계산이 완료되면 비교표가 활성화됩니다.</p>
        ) : (
          <>
            <div className="loan-table-block">
              <div className="loan-table-toolbar">
                <button
                  type="button"
                  className="btn-text"
                  onClick={addLoan}
                >
                  + 대출상담사 조건 추가
                </button>
              </div>
              <table className="loan-table">
              <thead>
                <tr>
                  <th>상담사 / 상품</th>
                  <th>LTV</th>
                  <th>금리</th>
                  <th>중도상환수수료율</th>
                  <th>적용기간</th>
                  <th>세후 수익</th>
                  <th>순위</th>
                  <th aria-label="삭제" />
                </tr>
              </thead>
              <tbody>
                {rankedLoans.map((row) => {
                  const draft = loanRows.find((l) => l.id === row.id)!;
                  const rowIndex = rowIndexById.get(row.id) ?? 0;
                  const template = templateForLoanRow(rowIndex);
                  const isPlaceholder = !loanRowHasInput(draft);
                  return (
                    <tr
                      key={row.id}
                      className={isPlaceholder ? 'loan-row-placeholder' : undefined}
                    >
                      <td>
                        <input
                          type="text"
                          className="loan-input loan-name"
                          value={draft.name}
                          placeholder={template.name}
                          onChange={(e) =>
                            updateLoanRow(row.id, { name: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="loan-input"
                          style={{ width: 44 }}
                          value={draft.ltv}
                          placeholder={String(template.ltv)}
                          onChange={(e) =>
                            updateLoanRow(row.id, {
                              ltv: sanitizeLoanDecimalInput(e.target.value),
                            })
                          }
                        />
                        %
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="loan-input"
                          style={{ width: 44 }}
                          value={draft.rate}
                          placeholder={String(template.rate)}
                          onChange={(e) =>
                            updateLoanRow(row.id, {
                              rate: sanitizeLoanDecimalInput(e.target.value),
                            })
                          }
                        />
                        %
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="loan-input"
                          style={{ width: 44 }}
                          value={draft.prepayRate}
                          placeholder={String(template.prepayRate)}
                          onChange={(e) =>
                            updateLoanRow(row.id, {
                              prepayRate: sanitizeLoanDecimalInput(
                                e.target.value,
                              ),
                            })
                          }
                        />
                        %
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="loan-input"
                          style={{ width: 38 }}
                          value={draft.prepayPeriod}
                          placeholder={String(template.prepayPeriod)}
                          onChange={(e) =>
                            updateLoanRow(row.id, {
                              prepayPeriod: sanitizeLoanIntegerInput(
                                e.target.value,
                              ),
                            })
                          }
                        />
                        개월
                      </td>
                      <td className="loan-profit">{fmtWonExact(row.netProfit)}</td>
                      <td>
                        {row.isBest ? (
                          <span className="rank-1">최적</span>
                        ) : (
                          <span className="rank-n">{row.rank}위</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-text loan-row-delete"
                          onClick={() => removeLoan(row.id)}
                          disabled={loanRows.length <= 1}
                          aria-label={`${template.name} 삭제`}
                          title={
                            loanRows.length <= 1
                              ? '최소 1개 상품은 유지해야 합니다'
                              : '삭제'
                          }
                        >
                          {ko.dashboard.deleteLoanRow}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <p className="s-note loan-table-footnote">
              중도상환수수료 = 대출원금 × 수수료율 × (적용기간 − 보유개월) ÷
              적용기간 (0 미만이면 수수료 없음)
            </p>
          </>
        )}
      </Section>

      {activeCase?.bidOutcome === 'won' ? (
        <Section title="다음 단계">
          <p className="field-hint">{ko.bidOutcome.wonNote}</p>
          <div className="bid-outcome-row">
            <button type="button" className="btn btn-seal" onClick={goToEviction}>
              {ko.common.promoteToE} →
            </button>
          </div>
        </Section>
      ) : null}
    </>
  );
}
