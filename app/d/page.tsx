'use client';

import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { ResultPanel } from '@/components/ui/ResultPanel';
import { RiskRow } from '@/components/ui/RiskRow';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { calcBid, marginLabelText } from '@/lib/calc/bidCalculator';
import { calcCostItems } from '@/lib/calc/costItems';
import { rankLoanOffers } from '@/lib/calc/loanCompare';
import { fmtWon, formatComma, parseNumberInput, pct } from '@/lib/format';
import { useCases } from '@/lib/hooks/useCases';
import { useDebouncedSave } from '@/lib/hooks/useDebouncedSave';
import { afterBidCalcSaved } from '@/lib/stage';
import type { LoanOffer } from '@/types/case';
import { ko } from '@/messages/ko';

const DEFAULT_LOANS: LoanOffer[] = [
  {
    id: '1',
    name: '김정아 · 전자상거래(근저당)',
    ltv: 75,
    rate: 4.6,
    prepayRate: 0.48,
    prepayPeriod: 36,
  },
  {
    id: '2',
    name: '천유진 · 개인대출(중도3년)',
    ltv: 90,
    rate: 5.2,
    prepayRate: 1.0,
    prepayPeriod: 36,
  },
  {
    id: '3',
    name: '박현숙 · 일반사업자',
    ltv: 85,
    rate: 4.8,
    prepayRate: 1.0,
    prepayPeriod: 24,
  },
];

function newId() {
  return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function BidCalcPage() {
  const { activeCase, updateCase } = useCases();
  const saved = activeCase?.bidCalcInputs;

  const [sellPrice, setSellPrice] = useState(
    saved?.sellPrice
      ? formatComma(saved.sellPrice)
      : '580,000,000',
  );
  const [months, setMonths] = useState(String(saved?.months ?? 6));
  const [loanRate, setLoanRate] = useState(saved?.loanRate ?? 4.5);
  const [margin, setMargin] = useState(saved?.margin ?? 5.5);
  const [costRate, setCostRate] = useState(
    saved?.costRate != null ? `${(saved.costRate * 100).toFixed(1)}%` : '5.0%',
  );
  const [loans, setLoans] = useState<LoanOffer[]>(
    activeCase?.loanOffers?.length ? activeCase.loanOffers : DEFAULT_LOANS,
  );

  useEffect(() => {
    const s = activeCase?.bidCalcInputs;
    if (s) {
      setSellPrice(formatComma(s.sellPrice));
      setMonths(String(s.months));
      setLoanRate(s.loanRate);
      setMargin(s.margin);
      setCostRate(`${(s.costRate * 100).toFixed(1)}%`);
    }
    if (activeCase?.loanOffers?.length) {
      setLoans(activeCase.loanOffers);
    } else if (activeCase) {
      setLoans(DEFAULT_LOANS);
    }
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bid = useMemo(() => {
    const cost = parseFloat(costRate) / 100 || 0.05;
    return calcBid({
      sellPrice: parseNumberInput(sellPrice),
      months: Math.min(6, Math.max(1, parseFloat(months) || 6)),
      loanRate: loanRate / 100,
      margin: margin / 100,
      costRate: cost,
    });
  }, [sellPrice, months, loanRate, margin, costRate]);

  const costs = useMemo(() => {
    const cost = parseFloat(costRate) / 100 || 0.05;
    return calcCostItems(
      bid.bidPrice,
      parseNumberInput(sellPrice),
      bid.interestCost,
      bid.loanPrincipal,
      Math.min(6, Math.max(1, parseFloat(months) || 6)),
      loanRate / 100,
      cost,
    );
  }, [bid, sellPrice, months, loanRate, costRate]);

  const rankedLoans = useMemo(() => {
    return rankLoanOffers(
      loans.map((l) => ({
        ...l,
        ltv: l.ltv / 100,
        rate: l.rate / 100,
        prepayRate: l.prepayRate / 100,
      })),
      bid.bidPrice,
      bid.grossProfit,
      Math.min(6, Math.max(1, parseFloat(months) || 6)),
    );
  }, [loans, bid, months]);

  const savePayload = useMemo(
    () => ({
      sellPrice: parseNumberInput(sellPrice),
      months: Math.min(6, Math.max(1, parseFloat(months) || 6)),
      loanRate,
      margin,
      costRate: parseFloat(costRate) / 100 || 0.05,
      loans,
    }),
    [sellPrice, months, loanRate, margin, costRate, loans],
  );

  useDebouncedSave(
    savePayload,
    500,
    (payload) => {
      if (!activeCase) return;
      updateCase(activeCase.id, {
        bidCalcInputs: {
          sellPrice: payload.sellPrice,
          months: payload.months,
          loanRate: payload.loanRate,
          margin: payload.margin,
          costRate: payload.costRate,
        },
        loanOffers: payload.loans,
        stage: afterBidCalcSaved(activeCase.stage),
      });
    },
    Boolean(activeCase),
    activeCase?.id,
  );

  function updateLoan(id: string, patch: Partial<LoanOffer>) {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function addLoan() {
    setLoans((prev) => [
      ...prev,
      {
        id: newId(),
        name: '새 상담사',
        ltv: 70,
        rate: 4.5,
        prepayRate: 0.5,
        prepayPeriod: 36,
      },
    ]);
  }

  function promoteToE() {
    if (!activeCase) return;
    updateCase(activeCase.id, { stage: 'E' });
  }

  return (
    <>
      <div className="chapter-mark">제4장 · 입찰가 계산</div>
      <h1 className="page-title">
        목표수익률로
        <br />
        입찰가를 <em>역산</em>합니다.
      </h1>
      <p className="page-sub">
        예측이 아니라 계산입니다. 임장으로 확인한 매도가와 목표마진을 넣으면
        원단위 입찰가와 세후 예상수익이 나옵니다.
      </p>

      {!activeCase ? (
        <div className="banner">{ko.common.noActiveCase}</div>
      ) : null}

      <Section>
        <div className="calc-layout">
          <div>
            <div className="field">
              <label htmlFor="sellPrice">매도가 (임장 확정 기준가)</label>
              <input
                id="sellPrice"
                type="text"
                value={sellPrice}
                onChange={(e) => {
                  const n = parseNumberInput(e.target.value);
                  setSellPrice(e.target.value === '' ? '' : formatComma(n));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="months">매도잔금기간 (개월)</label>
              <input
                id="months"
                type="number"
                min={1}
                max={6}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="loanRate">
                대출이자율{' '}
                <span className="range-val">{loanRate.toFixed(1)}%</span>
              </label>
              <input
                id="loanRate"
                type="range"
                min={2}
                max={8}
                step={0.1}
                value={loanRate}
                onChange={(e) => setLoanRate(parseFloat(e.target.value))}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10.5px',
                  color: 'var(--slate)',
                  marginTop: 6,
                }}
              >
                <span>2.0%</span>
                <span>8.0%</span>
              </div>
              <p className="field-hint">
                제1장의 신용등급은 추정치였습니다. 여기서는 실제 받은(또는 예상)
                대출조건을 입력하세요.
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="marginRange">
              목표 마진{' '}
              <span className="range-val">
                {marginLabelText(margin)} ({margin}%)
              </span>
            </label>
            <input
              id="marginRange"
              type="range"
              min={3}
              max={15}
              step={0.5}
              value={margin}
              onChange={(e) => setMargin(parseFloat(e.target.value))}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10.5px',
                color: 'var(--slate)',
                marginTop: 6,
              }}
            >
              <span>저마진 3%</span>
              <span>고마진 15%</span>
            </div>
            <div className="field" style={{ marginTop: 26 }}>
              <label htmlFor="costRate">취득 비용률 (개략)</label>
              <input
                id="costRate"
                type="text"
                value={costRate}
                onChange={(e) => setCostRate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Section>

      <ResultPanel
        mark="역산 결과 (실시간 계산)"
        figure={fmtWon(bid.bidPrice)}
        caption="2차 취득 산정 입찰가 (원단위 상세는 다운로드에서 확인)"
        rows={[
          { label: '세전 목표수익', value: fmtWon(bid.grossProfit) },
          {
            label: '세후 예상수익 (매매사업자 기준)',
            value: fmtWon(bid.netProfit),
          },
          {
            label: '실투자금 대비 수익률',
            value: `약 ${bid.netYield.toFixed(1)}%`,
          },
        ]}
      />

      <Section
        title={
          <>
            비용 항목 상세{' '}
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--slate)',
                fontWeight: 400,
              }}
            >
              (실시간 계산)
            </span>
          </>
        }
        note='취득 비용률(개략) 안에 들어가는 항목을 실제 %와 금액으로 풀어봤습니다. "조건부" 항목은 물건 확인 전엔 %가 정해지지 않아 금액을 표시하지 않습니다.'
      >
        {costs.items.map((item) => (
          <RiskRow
            key={item.key}
            name={item.name}
            note={item.note}
            amount={
              item.amount != null
                ? item.rate != null
                  ? `${fmtWon(item.amount)} (${pct(item.rate)})`
                  : fmtWon(item.amount)
                : undefined
            }
            badge={item.kind === 'required' ? '필수' : '조건부'}
            badgeTone={item.kind === 'required' ? 'neutral' : 'mid'}
          />
        ))}

        <div
          className="result-row"
          style={{
            borderTop: '1px solid var(--ink)',
            marginTop: 6,
            paddingTop: 16,
            fontWeight: 600,
          }}
        >
          <span>필수 항목 합계 (상세)</span>
          <span style={{ fontFamily: 'var(--mono)' }}>
            {fmtWon(costs.requiredTotal)}
          </span>
        </div>
        <div className="result-row">
          <span>취득 비용률(개략) 적용 금액</span>
          <span style={{ fontFamily: 'var(--mono)' }}>
            {fmtWon(costs.approxTotal)}
          </span>
        </div>
        <div className="result-row">
          <span>차이 (개략 − 상세)</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{fmtWon(costs.diff)}</span>
        </div>
        <p className="s-note" style={{ marginTop: 10 }}>
          개략 비용률과 상세 합계가 차이 나는 만큼, 실제 V11 계산기처럼 그
          차액의 일부를 입찰가에 재반영하면 더 정교한 값이 나옵니다.
        </p>
      </Section>

      <Section
        title="대출상품 비교"
        note='낙찰 후 명함을 주고받은 대출상담사들의 조건을 입력하면 순수익 기준으로 자동 정렬됩니다. 중도상환수수료는 "적용기간 이내 상환시 수수료율, 그 이후 체감"하는 실제 방식으로 계산됩니다.'
      >
        <table className="loan-table">
          <thead>
            <tr>
              <th>상담사 / 상품</th>
              <th>LTV</th>
              <th>금리</th>
              <th>중도상환수수료율</th>
              <th>적용기간</th>
              <th>세후 수익</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rankedLoans.map((row) => {
              const original = loans.find((l) => l.id === row.id)!;
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      type="text"
                      className="loan-input loan-name"
                      value={original.name}
                      onChange={(e) =>
                        updateLoan(row.id, { name: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="loan-input"
                      style={{ width: 44 }}
                      value={original.ltv}
                      onChange={(e) =>
                        updateLoan(row.id, {
                          ltv: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    %
                  </td>
                  <td>
                    <input
                      type="text"
                      className="loan-input"
                      style={{ width: 44 }}
                      value={original.rate}
                      onChange={(e) =>
                        updateLoan(row.id, {
                          rate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    %
                  </td>
                  <td>
                    <input
                      type="text"
                      className="loan-input"
                      style={{ width: 44 }}
                      value={original.prepayRate}
                      onChange={(e) =>
                        updateLoan(row.id, {
                          prepayRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    %
                  </td>
                  <td>
                    <input
                      type="text"
                      className="loan-input"
                      style={{ width: 38 }}
                      value={original.prepayPeriod}
                      onChange={(e) =>
                        updateLoan(row.id, {
                          prepayPeriod: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    개월
                  </td>
                  <td className="loan-profit">{fmtWon(row.netProfit)}</td>
                  <td>
                    {row.isBest ? (
                      <span className="rank-1">최적</span>
                    ) : (
                      <span className="rank-n">{row.rank}위</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="s-note" style={{ marginTop: 10 }}>
          중도상환수수료 = 대출원금 × 수수료율 × (적용기간 − 보유개월) ÷
          적용기간 (0 미만이면 수수료 없음)
        </p>
        <button
          type="button"
          className="btn-text"
          style={{ marginTop: 16 }}
          onClick={addLoan}
        >
          + 대출상담사 조건 추가
        </button>
      </Section>

      {activeCase?.stage === 'D' ? (
        <div style={{ marginTop: 28 }}>
          <button type="button" className="btn btn-seal" onClick={promoteToE}>
            {ko.common.promoteToE}
          </button>
        </div>
      ) : null}

      <Disclaimer>
        1년 이상 실제 입찰 경험으로 검증된 계산식을 사용합니다. 세율·요율은
        매년 갱신되며, 최종 세무 판단은 세무사 확인을 권합니다.
      </Disclaimer>
    </>
  );
}
