'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { ResultPanel } from '@/components/ui/ResultPanel';
import { RiskRow } from '@/components/ui/RiskRow';
import { calcBid, marginLabelText, resolveBidLoanRate, resolveBidMargin } from '@/lib/calc/bidCalculator';
import {
  calcCostItems,
  sumConditionalCostsWon,
  type ConditionalCostsWon,
} from '@/lib/calc/costItems';
import { fmtWon, formatComma, parseNumberInput, pct } from '@/lib/format';
import { useCases } from '@/lib/hooks/useCases';
import { useDebouncedSave } from '@/lib/hooks/useDebouncedSave';
import { afterBidCalcSaved } from '@/lib/stage';
import { normalizeCaseTrack } from '@/lib/caseUtils';
import type { HousingBondApiResult } from '@/app/api/housing-bond/route';
import type { BidOutcome, CaseFile } from '@/types/case';
import { inferBrokerFeeRegion } from '@/lib/geo/inferBrokerFeeRegion';
import { ko } from '@/messages/ko';

type BidCalcSaved = NonNullable<CaseFile['bidCalcInputs']>;

type ConditionalCostKey = 'unpaid' | 'farm' | 'repair' | 'force';

const CONDITIONAL_COST_KEYS: ConditionalCostKey[] = [
  'unpaid',
  'farm',
  'repair',
  'force',
];

function manwonFieldFromSaved(
  saved: BidCalcSaved | undefined,
  key: ConditionalCostKey,
): string {
  if (!saved) return '';
  const map: Record<ConditionalCostKey, number | undefined> = {
    unpaid: saved.unpaidMgmtFeeMan,
    farm: saved.farmTaxMan,
    repair: saved.repairCostMan,
    force: saved.forceExecCostMan,
  };
  const v = map[key];
  return v != null ? String(v) : '';
}

function manwonFieldsFromSaved(
  saved: BidCalcSaved | undefined,
): Record<ConditionalCostKey, string> {
  return {
    unpaid: manwonFieldFromSaved(saved, 'unpaid'),
    farm: manwonFieldFromSaved(saved, 'farm'),
    repair: manwonFieldFromSaved(saved, 'repair'),
    force: manwonFieldFromSaved(saved, 'force'),
  };
}

function parseManwonInput(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  return parseNumberInput(value);
}

function manwonToWon(value: string): number | undefined {
  const man = parseManwonInput(value);
  if (man == null) return undefined;
  return man * 10_000;
}

function conditionalWonFromManwon(
  fields: Record<ConditionalCostKey, string>,
): ConditionalCostsWon {
  const out: ConditionalCostsWon = {};
  for (const key of CONDITIONAL_COST_KEYS) {
    const won = manwonToWon(fields[key]);
    if (won != null) out[key] = won;
  }
  return out;
}

function conditionalManForSave(
  fields: Record<ConditionalCostKey, string>,
): Pick<
  BidCalcSaved,
  'unpaidMgmtFeeMan' | 'farmTaxMan' | 'repairCostMan' | 'forceExecCostMan'
> {
  const out: Pick<
    BidCalcSaved,
    'unpaidMgmtFeeMan' | 'farmTaxMan' | 'repairCostMan' | 'forceExecCostMan'
  > = {};
  const man = parseManwonInput(fields.unpaid);
  if (man != null) out.unpaidMgmtFeeMan = man;
  const farm = parseManwonInput(fields.farm);
  if (farm != null) out.farmTaxMan = farm;
  const repair = parseManwonInput(fields.repair);
  if (repair != null) out.repairCostMan = repair;
  const force = parseManwonInput(fields.force);
  if (force != null) out.forceExecCostMan = force;
  return out;
}

export default function BidCalcPage() {
  const router = useRouter();
  const { activeCase, updateCase } = useCases();
  const saved = activeCase?.bidCalcInputs;

  const [sellPrice, setSellPrice] = useState(
    saved?.sellPrice
      ? formatComma(saved.sellPrice)
      : '580,000,000',
  );
  const [months, setMonths] = useState(String(saved?.months ?? 6));
  const [loanRate, setLoanRate] = useState(() =>
    resolveBidLoanRate(saved?.loanRate),
  );
  const [margin, setMargin] = useState(() => resolveBidMargin(saved?.margin));
  const [costRate, setCostRate] = useState(
    saved?.costRate != null ? `${(saved.costRate * 100).toFixed(1)}%` : '5.0%',
  );
  const [conditionalMan, setConditionalMan] = useState<
    Record<ConditionalCostKey, string>
  >(() => manwonFieldsFromSaved(saved));
  const [officialPrice, setOfficialPrice] = useState(
    saved?.officialPrice ? formatComma(saved.officialPrice) : '',
  );
  const [housingBond, setHousingBond] = useState<HousingBondApiResult | null>(
    null,
  );
  const [housingBondLoading, setHousingBondLoading] = useState(false);
  const [housingBondError, setHousingBondError] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const s = activeCase?.bidCalcInputs;
    if (s) {
      setSellPrice(formatComma(s.sellPrice));
      setMonths(String(s.months));
      setLoanRate(resolveBidLoanRate(s.loanRate));
      setMargin(resolveBidMargin(s.margin));
      setCostRate(`${(s.costRate * 100).toFixed(1)}%`);
      setConditionalMan(manwonFieldsFromSaved(s));
      setOfficialPrice(
        s.officialPrice ? formatComma(s.officialPrice) : '',
      );
    }
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const officialPriceWon = parseNumberInput(officialPrice);

  useEffect(() => {
    if (officialPriceWon <= 0) {
      setHousingBond(null);
      setHousingBondError(null);
      setHousingBondLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setHousingBondLoading(true);
      setHousingBondError(null);
      try {
        const params = new URLSearchParams({
          officialPrice: String(officialPriceWon),
        });
        if (activeCase?.address) {
          params.set('address', activeCase.address);
        }
        const res = await fetch(`/api/housing-bond?${params}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as HousingBondApiResult & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? '국민주택채권 계산 실패');
        }
        setHousingBond(data);
      } catch (e) {
        if (controller.signal.aborted) return;
        setHousingBond(null);
        setHousingBondError(
          e instanceof Error ? e.message : '국민주택채권 계산 실패',
        );
      } finally {
        if (!controller.signal.aborted) {
          setHousingBondLoading(false);
        }
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [officialPriceWon, activeCase?.address]);

  const housingBondCost = useMemo(() => {
    if (!housingBond || officialPriceWon <= 0) return null;
    return {
      customerBurden: housingBond.customerBurden,
      note: housingBond.note,
    };
  }, [housingBond, officialPriceWon]);

  const brokerFeeRegionResolved = useMemo(
    () =>
      inferBrokerFeeRegion({
        address: activeCase?.address,
        courtName: activeCase?.courtName,
      }),
    [activeCase?.address, activeCase?.courtName],
  );

  const conditionalWon = useMemo(
    () => conditionalWonFromManwon(conditionalMan),
    [conditionalMan],
  );

  const conditionalExtra = useMemo(
    () => sumConditionalCostsWon(conditionalWon),
    [conditionalWon],
  );

  const bid = useMemo(() => {
    const cost = parseFloat(costRate) / 100 || 0.05;
    return calcBid({
      sellPrice: parseNumberInput(sellPrice),
      months: Math.min(6, Math.max(1, parseFloat(months) || 6)),
      loanRate: loanRate / 100,
      margin: margin / 100,
      costRate: cost,
      conditionalExtra,
    });
  }, [sellPrice, months, loanRate, margin, costRate, conditionalExtra]);

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
      undefined,
      undefined,
      conditionalWon,
      housingBondCost,
      {
        regionId: brokerFeeRegionResolved.regionId,
        regionProfile: brokerFeeRegionResolved.profile,
      },
    );
  }, [
    bid,
    sellPrice,
    months,
    loanRate,
    costRate,
    conditionalWon,
    housingBondCost,
    brokerFeeRegionResolved,
  ]);

  function setConditionalManField(key: ConditionalCostKey, raw: string) {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 4);
    setConditionalMan((prev) => ({
      ...prev,
      [key]: digits,
    }));
  }

  function renderCostAmount(item: (typeof costs.items)[number]) {
    if (
      item.kind === 'conditional' &&
      CONDITIONAL_COST_KEYS.includes(item.key as ConditionalCostKey)
    ) {
      const key = item.key as ConditionalCostKey;
      return (
        <span className="manwon-field">
          <input
            type="text"
            inputMode="numeric"
            className="loan-input manwon-input"
            value={conditionalMan[key]}
            onChange={(e) => setConditionalManField(key, e.target.value)}
            placeholder="0"
            maxLength={4}
            aria-label={`${item.name} (만원)`}
          />
          <span className="manwon-unit">만원</span>
        </span>
      );
    }
    if (item.amount == null) return undefined;
    if (item.rate != null) {
      return `${fmtWon(item.amount)} (${pct(item.rate)})`;
    }
    return fmtWon(item.amount);
  }

  const savePayload = useMemo(
    () => ({
      sellPrice: parseNumberInput(sellPrice),
      months: Math.min(6, Math.max(1, parseFloat(months) || 6)),
      loanRate,
      margin,
      costRate: parseFloat(costRate) / 100 || 0.05,
      conditionalMan: conditionalManForSave(conditionalMan),
      officialPrice: officialPriceWon > 0 ? officialPriceWon : undefined,
    }),
    [
      sellPrice,
      months,
      loanRate,
      margin,
      costRate,
      conditionalMan,
      officialPriceWon,
    ],
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
          unpaidMgmtFeeMan: payload.conditionalMan.unpaidMgmtFeeMan,
          farmTaxMan: payload.conditionalMan.farmTaxMan,
          repairCostMan: payload.conditionalMan.repairCostMan,
          forceExecCostMan: payload.conditionalMan.forceExecCostMan,
          officialPrice: payload.officialPrice,
        },
        stage: afterBidCalcSaved(activeCase.stage),
      });
    },
    Boolean(activeCase),
    activeCase?.id,
  );

  function setBidOutcome(outcome: BidOutcome) {
    if (!activeCase) return;
    if (outcome === 'won') {
      updateCase(activeCase.id, { stage: 'F', bidOutcome: 'won' });
      router.push('/f');
      return;
    }
    updateCase(activeCase.id, { bidOutcome: outcome });
  }

  const showBidOutcome =
    activeCase &&
    normalizeCaseTrack(activeCase) === 'bidding' &&
    (activeCase.stage === 'D' || activeCase.bidCalcInputs);

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
            <label htmlFor="costRate">취득 비용률 (개략)</label>
            <input
              id="costRate"
              type="text"
              value={costRate}
              onChange={(e) => setCostRate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="officialPrice">공시가격 (시가표준액)</label>
            <input
              id="officialPrice"
              type="text"
              value={officialPrice}
              onChange={(e) => {
                const n = parseNumberInput(e.target.value);
                setOfficialPrice(e.target.value === '' ? '' : formatComma(n));
              }}
              placeholder="부동산공시가격 알리미 기준"
            />
            <p className="field-hint">
              국민주택채권 매입·할인비 자동 계산에 사용합니다. 할인율은
              당일(주말·공휴일은 직전 영업일) 주택도시기금 고시 기준입니다.
              {housingBondLoading ? ' 조회 중…' : null}
              {housingBond && !housingBondLoading
                ? housingBond.exempt
                  ? ' · 매입 면제 구간'
                  : ` · 채권 ${fmtWon(housingBond.purchaseAmount)} / 본인부담 ${fmtWon(housingBond.customerBurden)} (${housingBond.basisDate})`
                : null}
              {housingBondError ? ` · ${housingBondError}` : null}
            </p>
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
          <div className="field calc-range-field">
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
            <div className="range-ticks">
              <span>2.0%</span>
              <span>8.0%</span>
            </div>
            <p className="field-hint">
              제1장의 신용등급은 추정치였습니다. 여기서는 실제 받은(또는 예상)
              대출조건을 입력하세요.
            </p>
          </div>
          <div className="field calc-range-field">
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
            <div className="range-ticks">
              <span>저마진 3%</span>
              <span>고마진 15%</span>
            </div>
            <p className="field-hint calc-range-hint-spacer" />
          </div>
        </div>
      </Section>

      <ResultPanel
        mark="역산 결과 (실시간 계산)"
        figure={fmtWon(bid.bidPrice)}
        caption={
          bid.conditionalExtra > 0
            ? '2차 취득 산정 입찰가 — 조건부 비용을 선반영해 역산했습니다'
            : '2차 취득 산정 입찰가 (원단위 상세는 다운로드에서 확인)'
        }
        rows={[
          ...(bid.conditionalExtra > 0
            ? [
                {
                  label: '조건부 비용 선반영',
                  value: `−${fmtWon(bid.conditionalExtra)}`,
                },
              ]
            : []),
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
        note='취득 비용률(개략) 안에 들어가는 항목을 실제 %와 금액으로 풀어봤습니다. 조건부 항목은 만원 단위로 입력하면 입찰가 역산과 상세 합계에 함께 반영됩니다.'
      >
        {costs.items.map((item) => (
          <RiskRow
            key={item.key}
            name={item.name}
            note={item.note}
            amount={renderCostAmount(item)}
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
        {costs.conditionalTotal > 0 ? (
          <div className="result-row">
            <span>조건부 항목 합계</span>
            <span style={{ fontFamily: 'var(--mono)' }}>
              {fmtWon(costs.conditionalTotal)}
            </span>
          </div>
        ) : null}
        <div className="result-row">
          <span>상세 합계 (필수 + 조건부)</span>
          <span style={{ fontFamily: 'var(--mono)' }}>
            {fmtWon(costs.detailedTotal)}
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

      {showBidOutcome ? (
        <Section title={ko.bidOutcome.title} note={ko.bidOutcome.pendingHint}>
          {activeCase?.bidOutcome === 'won' ? (
            <p className="field-hint">{ko.bidOutcome.wonNote}</p>
          ) : null}
          <div className="bid-outcome-row">
            <button
              type="button"
              className={`btn${activeCase?.bidOutcome === 'won' ? ' btn-primary' : ' btn-outline'}`}
              onClick={() => setBidOutcome('won')}
            >
              {ko.bidOutcome.won}
            </button>
            <button
              type="button"
              className={`btn${activeCase?.bidOutcome === 'lost' ? ' btn-primary' : ' btn-outline'}`}
              onClick={() => setBidOutcome('lost')}
            >
              {ko.bidOutcome.lost}
            </button>
            <button
              type="button"
              className={`btn${activeCase?.bidOutcome === 'skipped' ? ' btn-primary' : ' btn-outline'}`}
              onClick={() => setBidOutcome('skipped')}
            >
              {ko.bidOutcome.skipped}
            </button>
          </div>
          {activeCase?.bidOutcome === 'won' ? (
            <div style={{ marginTop: 16 }}>
              <Link href="/f" className="btn btn-seal">
                {ko.common.promoteToF} →
              </Link>
            </div>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}
