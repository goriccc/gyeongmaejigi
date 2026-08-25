'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { newLoanOfferId } from '@/data/defaultLoanOffers';
import { WonExactAmt } from '@/components/bid/WonExactDisplay';
import { loanCompareBidFromCase } from '@/lib/calc/bidFromCase';
import { rankLoanOffers } from '@/lib/calc/loanCompare';
import { formatComma, fmtWonExact, parseNumberInput } from '@/lib/format';
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
import { isRegisteredPostWin } from '@/lib/caseUtils';
import { afterLoanCompareSaved } from '@/lib/stage';
import { ko } from '@/messages/ko';

export default function LoanComparePage() {
  const router = useRouter();
  const { activeCase, updateCase } = useCases();
  const saved = activeCase?.bidCalcInputs;
  const postWinLoan = Boolean(
    activeCase && isRegisteredPostWin(activeCase) && activeCase.postWinGoals?.loanCompare,
  );
  const evictionOnlyPostWin = Boolean(
    activeCase && isRegisteredPostWin(activeCase) && !activeCase.postWinGoals?.loanCompare,
  );

  const [winningBidDraft, setWinningBidDraft] = useState(() =>
    activeCase?.winningBidWon
      ? formatComma(activeCase.winningBidWon)
      : saved?.bidPrice
        ? formatComma(saved.bidPrice)
        : '',
  );
  const [sellPriceDraft, setSellPriceDraft] = useState(() =>
    saved?.sellPrice && saved.sellPrice > 0 ? formatComma(saved.sellPrice) : '',
  );
  const [monthsDraft, setMonthsDraft] = useState(() =>
    String(saved?.months && saved.months > 0 ? saved.months : 6),
  );

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
    setWinningBidDraft(
      activeCase?.winningBidWon
        ? formatComma(activeCase.winningBidWon)
        : activeCase?.bidCalcInputs?.bidPrice
          ? formatComma(activeCase.bidCalcInputs.bidPrice)
          : '',
    );
    setSellPriceDraft(
      activeCase?.bidCalcInputs?.sellPrice && activeCase.bidCalcInputs.sellPrice > 0
        ? formatComma(activeCase.bidCalcInputs.sellPrice)
        : '',
    );
    setMonthsDraft(
      String(
        activeCase?.bidCalcInputs?.months && activeCase.bidCalcInputs.months > 0
          ? activeCase.bidCalcInputs.months
          : 6,
      ),
    );
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const postWinBasis = useMemo(() => {
    const winningBidWon = parseNumberInput(winningBidDraft);
    const sellPrice = parseNumberInput(sellPriceDraft);
    const months = Math.min(24, Math.max(1, parseInt(monthsDraft, 10) || 6));
    return {
      winningBidWon: winningBidWon > 0 ? winningBidWon : 0,
      sellPrice: sellPrice > 0 ? sellPrice : 0,
      months,
    };
  }, [winningBidDraft, sellPriceDraft, monthsDraft]);

  const bid = useMemo(() => {
    if (postWinLoan) {
      if (!(postWinBasis.winningBidWon > 0)) return null;
      return {
        bidPrice: postWinBasis.winningBidWon,
        sellPrice: postWinBasis.sellPrice,
        effectiveSellPrice:
          postWinBasis.sellPrice > 0
            ? postWinBasis.sellPrice
            : postWinBasis.winningBidWon,
        financeFreeDetailed: saved?.financeFreeDetailed ?? 0,
        months: postWinBasis.months,
      };
    }
    return loanCompareBidFromCase(activeCase);
  }, [postWinLoan, postWinBasis, saved?.financeFreeDetailed, activeCase]);

  const rankedLoans = useMemo(() => {
    if (!bid) return [];
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
      bid.months,
    );
  }, [loanRows, bid]);

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

  useDebouncedSave(
    postWinBasis,
    500,
    (payload) => {
      if (!activeCase || !postWinLoan) return;
      updateCase(activeCase.id, {
        winningBidWon: payload.winningBidWon > 0 ? payload.winningBidWon : undefined,
        bidCalcInputs: {
          ...saved,
          sellPrice: payload.sellPrice,
          months: payload.months,
          loanRate: saved?.loanRate ?? 5,
          prepayRate: saved?.prepayRate,
          margin: saved?.margin ?? 10,
          bidPrice: payload.winningBidWon,
          effectiveSellPrice:
            payload.sellPrice > 0 ? payload.sellPrice : payload.winningBidWon,
          financeFreeDetailed: saved?.financeFreeDetailed ?? 0,
        },
      });
    },
    postWinLoan && Boolean(activeCase),
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
        {postWinLoan
          ? ko.loanCompare.postWinLead
          : '명함을 주고받은 대출상담사들의 LTV·금리·중도상환수수료를 입력하면 제4장 입찰가 역산 결과 기준 세후 수익으로 자동 정렬됩니다.'}
      </p>

      {!activeCase ? (
        <div className="banner">{ko.common.noActiveCase}</div>
      ) : null}

      {evictionOnlyPostWin ? (
        <div className="banner">
          {ko.loanCompare.evictionOnly}{' '}
          <Link href="/e" className="btn-text">
            명도 코칭 →
          </Link>
        </div>
      ) : null}

      {activeCase && !postWinLoan && !evictionOnlyPostWin && !saved ? (
        <div className="banner">
          {ko.loanCompare.needD}{' '}
          <Link href="/d" className="btn-text">
            입찰가 계산 →
          </Link>
        </div>
      ) : null}

      {postWinLoan ? (
        <Section title={ko.loanCompare.postWinTitle} note={ko.loanCompare.postWinNote}>
          <div className="field">
            <label htmlFor="loan-winning-bid">{ko.loanCompare.winningBid}</label>
            <input
              id="loan-winning-bid"
              type="text"
              inputMode="numeric"
              value={winningBidDraft}
              onChange={(e) => {
                const raw = e.target.value;
                setWinningBidDraft(raw === '' ? '' : formatComma(parseNumberInput(raw)));
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="loan-expected-sell">{ko.loanCompare.expectedSell}</label>
            <input
              id="loan-expected-sell"
              type="text"
              inputMode="numeric"
              value={sellPriceDraft}
              onChange={(e) => {
                const raw = e.target.value;
                setSellPriceDraft(raw === '' ? '' : formatComma(parseNumberInput(raw)));
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="loan-hold-months">{ko.loanCompare.months}</label>
            <input
              id="loan-hold-months"
              type="text"
              inputMode="numeric"
              value={monthsDraft}
              onChange={(e) =>
                setMonthsDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 2))
              }
            />
          </div>
          {postWinBasis.sellPrice <= 0 ? (
            <p className="field-hint">{ko.loanCompare.noSellNote}</p>
          ) : null}
        </Section>
      ) : bid && saved ? (
        <Section title={ko.loanCompare.basisTitle} note={ko.loanCompare.basisNote}>
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
            {ko.loanCompare.editInD}
          </Link>
        </Section>
      ) : null}

      <Section
        title="대출상품 비교"
        note='회색 예시는 참고용 입니다. 입력을 시작하면 사라지고, 순위·수익은 입력값(미입력 칸은 예시값) 기준으로 계산됩니다.'
      >
        {!bid ? (
          <p className="field-hint">
            {postWinLoan
              ? ko.caseForm.winningBidRequired
              : ko.loanCompare.tableLocked}
          </p>
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

      {activeCase?.bidOutcome === 'won' &&
      activeCase.postWinGoals?.eviction !== false ? (
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
