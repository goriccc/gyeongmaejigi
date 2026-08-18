'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { ResultPanel } from '@/components/ui/ResultPanel';
import { RiskRow } from '@/components/ui/RiskRow';
import { Badge } from '@/components/ui/Badge';
import { BounceDots } from '@/components/ui/BounceDots';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { resolveBidLoanRate, resolveBidMargin, yieldLabelText, yieldTierClass, DEFAULT_BID_MARGIN } from '@/lib/calc/bidCalculator';
import { convergeBid } from '@/lib/calc/bidConverge';
import {
  BuildingVatSection,
  buildingVatStateFromSaved,
  type BuildingVatSectionState,
} from '@/components/bid/BuildingVatSection';
import { WonExactAmt, WonExactLeadDisplay } from '@/components/bid/WonExactDisplay';
import {
  resolveBuildingVatWon,
  resolvePropertySizeClass,
  farmTaxApplies,
  buildingVatRateVerdictFromAmount,
  buildingVatVerdictLabel,
} from '@/lib/calc/buildingVat';
import {
  sumConditionalCostsWon,
  type ConditionalCostsWon,
} from '@/lib/calc/costItems';
import { formatComma, parseNumberInput, pct } from '@/lib/format';
import { useCases } from '@/lib/hooks/useCases';
import { useDebouncedSave } from '@/lib/hooks/useDebouncedSave';
import { afterBidCalcSaved } from '@/lib/stage';
import { normalizeCaseTrack } from '@/lib/caseUtils';
import type { HousingBondApiResult } from '@/app/api/housing-bond/route';
import type { BidOutcome, CaseFile } from '@/types/case';
import { inferBrokerFeeRegion } from '@/lib/geo/inferBrokerFeeRegion';
import { DEFAULT_MISC_OTHER_WON } from '@/data/taxTable';
import { formatTradingBusinessTransferTaxMeta } from '@/lib/calc/tradingTax';
import { loadEntryProfile } from '@/lib/entryProfile';
import type { EntryMatchInputs } from '@/types/case';
import { ko } from '@/messages/ko';

type BidCalcSaved = NonNullable<CaseFile['bidCalcInputs']>;

type ConditionalCostKey = 'unpaid' | 'evict' | 'miscOther' | 'repair' | 'force';

const CONDITIONAL_COST_KEYS: ConditionalCostKey[] = [
  'unpaid',
  'evict',
  'miscOther',
  'repair',
  'force',
];

function defaultConditionalWonFields(): Record<ConditionalCostKey, string> {
  return {
    unpaid: '',
    evict: '',
    miscOther: formatComma(DEFAULT_MISC_OTHER_WON),
    repair: '',
    force: '',
  };
}

function wonFieldFromSaved(
  saved: BidCalcSaved | undefined,
  key: ConditionalCostKey,
): string {
  if (!saved) {
    return key === 'miscOther' ? formatComma(DEFAULT_MISC_OTHER_WON) : '';
  }
  const map: Record<ConditionalCostKey, number | undefined> = {
    unpaid: saved.unpaidMgmtFeeMan,
    evict: saved.evictionCostMan,
    miscOther: saved.miscOtherCostMan,
    repair: saved.repairCostMan,
    force: saved.forceExecCostMan,
  };
  const man = map[key];
  if (man != null) return formatComma(man * 10_000);
  return key === 'miscOther' ? formatComma(DEFAULT_MISC_OTHER_WON) : '';
}

function conditionalWonFieldsFromSaved(
  saved: BidCalcSaved | undefined,
): Record<ConditionalCostKey, string> {
  if (!saved) return defaultConditionalWonFields();
  return {
    unpaid: wonFieldFromSaved(saved, 'unpaid'),
    evict: wonFieldFromSaved(saved, 'evict'),
    miscOther: wonFieldFromSaved(saved, 'miscOther'),
    repair: wonFieldFromSaved(saved, 'repair'),
    force: wonFieldFromSaved(saved, 'force'),
  };
}

function parseWonField(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = parseNumberInput(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function conditionalWonFromFields(
  fields: Record<ConditionalCostKey, string>,
): ConditionalCostsWon {
  const out: ConditionalCostsWon = {};
  for (const key of CONDITIONAL_COST_KEYS) {
    const won = parseWonField(fields[key]);
    if (won != null) out[key] = won;
  }
  return out;
}

function conditionalManForSave(
  fields: Record<ConditionalCostKey, string>,
  farmTaxWonAuto?: number,
): Pick<
  BidCalcSaved,
  | 'unpaidMgmtFeeMan'
  | 'evictionCostMan'
  | 'farmTaxMan'
  | 'miscOtherCostMan'
  | 'repairCostMan'
  | 'forceExecCostMan'
> {
  const out: Pick<
    BidCalcSaved,
    | 'unpaidMgmtFeeMan'
    | 'evictionCostMan'
    | 'farmTaxMan'
    | 'miscOtherCostMan'
    | 'repairCostMan'
    | 'forceExecCostMan'
  > = {};
  const unpaid = parseWonField(fields.unpaid);
  if (unpaid != null) out.unpaidMgmtFeeMan = unpaid / 10_000;
  const evict = parseWonField(fields.evict);
  if (evict != null) out.evictionCostMan = evict / 10_000;
  const miscOther = parseWonField(fields.miscOther);
  if (miscOther != null) out.miscOtherCostMan = miscOther / 10_000;
  if (farmTaxWonAuto != null && farmTaxWonAuto > 0) {
    out.farmTaxMan = Math.round(farmTaxWonAuto / 10_000);
  }
  const repair = parseWonField(fields.repair);
  if (repair != null) out.repairCostMan = repair / 10_000;
  const force = parseWonField(fields.force);
  if (force != null) out.forceExecCostMan = force / 10_000;
  return out;
}

function clampBidMarginPct(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_BID_MARGIN;
  return Math.min(20, Math.max(3, Math.round(n * 100) / 100));
}

function parseWonInputField(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = parseNumberInput(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseAreaField(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function buildingVatSavedFromState(state: BuildingVatSectionState) {
  const exclusiveAreaM2 = parseAreaField(state.exclusiveAreaM2);
  const buildingVatWon = parseWonInputField(state.buildingVatWon);
  const landAreaM2 = parseAreaField(state.landAreaM2);
  const landUnitPricePerM2 = parseNumberInput(state.landUnitPricePerM2);
  const buildingStandardPrice = parseNumberInput(state.buildingStandardPrice);
  return {
    propertySizeMode: state.propertySizeMode,
    exclusiveAreaM2,
    buildingVatCalcMode: state.buildingVatCalcMode,
    buildingVatWon,
    buildingVatMan:
      buildingVatWon != null ? Math.round(buildingVatWon / 10_000) : undefined,
    landAreaM2,
    landUnitPricePerM2: landUnitPricePerM2 > 0 ? landUnitPricePerM2 : undefined,
    buildingStandardPrice:
      buildingStandardPrice > 0 ? buildingStandardPrice : undefined,
  };
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
  const [marginDraft, setMarginDraft] = useState(() =>
    resolveBidMargin(saved?.margin).toFixed(2),
  );
  const [conditionalWonFields, setConditionalWonFields] = useState<
    Record<ConditionalCostKey, string>
  >(() => conditionalWonFieldsFromSaved(saved));
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
  const [buildingVatState, setBuildingVatState] =
    useState<BuildingVatSectionState>(() =>
      buildingVatStateFromSaved(saved, activeCase?.exclusiveAreaM2),
    );
  useEffect(() => {
    const s = activeCase?.bidCalcInputs;
    if (s) {
      setSellPrice(formatComma(s.sellPrice));
      setMonths(String(s.months));
      setLoanRate(resolveBidLoanRate(s.loanRate));
      const nextMargin = resolveBidMargin(s.margin);
      setMargin(nextMargin);
      setMarginDraft(nextMargin.toFixed(2));
      setConditionalWonFields(conditionalWonFieldsFromSaved(s));
      setOfficialPrice(
        s.officialPrice ? formatComma(s.officialPrice) : '',
      );
      setBuildingVatState(
        buildingVatStateFromSaved(s, activeCase?.exclusiveAreaM2),
      );
    } else {
      setBuildingVatState(
        buildingVatStateFromSaved(undefined, activeCase?.exclusiveAreaM2),
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

  const entryInputs = useMemo((): EntryMatchInputs | null => {
    if (activeCase?.entryMatchInputs) return activeCase.entryMatchInputs;
    return loadEntryProfile()?.inputs ?? null;
  }, [activeCase?.entryMatchInputs]);

  const entryProfileConfigured = entryInputs != null;

  const sellPriceWon = parseNumberInput(sellPrice);

  const exclusiveAreaResolved = useMemo(() => {
    return (
      parseAreaField(buildingVatState.exclusiveAreaM2) ??
      activeCase?.exclusiveAreaM2
    );
  }, [buildingVatState.exclusiveAreaM2, activeCase?.exclusiveAreaM2]);

  const propertySizeClass = useMemo(
    () =>
      resolvePropertySizeClass(
        buildingVatState.propertySizeMode,
        exclusiveAreaResolved,
      ),
    [buildingVatState.propertySizeMode, exclusiveAreaResolved],
  );

  const buildingVatSaved = useMemo(
    () => buildingVatSavedFromState(buildingVatState),
    [buildingVatState],
  );

  const buildingVatWon = useMemo(() => {
    const directWon = buildingVatSaved.buildingVatWon;
    return resolveBuildingVatWon({
      propertySize: propertySizeClass,
      sellPrice: sellPriceWon,
      calcMode: buildingVatState.buildingVatCalcMode,
      directVatWon: directWon,
      landAreaM2: buildingVatSaved.landAreaM2,
      landUnitPricePerM2: buildingVatSaved.landUnitPricePerM2,
      buildingStandardPrice: buildingVatSaved.buildingStandardPrice,
    });
  }, [
    propertySizeClass,
    sellPriceWon,
    buildingVatState.buildingVatCalcMode,
    buildingVatSaved,
  ]);

  const otherConditionalWon = useMemo(
    () => conditionalWonFromFields(conditionalWonFields),
    [conditionalWonFields],
  );

  const otherConditionalExtra = useMemo(
    () => sumConditionalCostsWon(otherConditionalWon),
    [otherConditionalWon],
  );

  const converged = useMemo(() => {
    const m = Math.min(6, Math.max(1, parseFloat(months) || 6));
    return convergeBid({
      sellPrice: sellPriceWon,
      months: m,
      loanRate: loanRate / 100,
      margin: margin / 100,
      conditionalExtra: otherConditionalExtra,
      buildingVat: buildingVatWon,
      propertySize: propertySizeClass,
      exclusiveAreaM2: exclusiveAreaResolved,
      propertySizeMode: buildingVatState.propertySizeMode,
      conditionalWon: otherConditionalWon,
      housingBond: housingBondCost,
      brokerFeeRegion: {
        regionId: brokerFeeRegionResolved.regionId,
        regionProfile: brokerFeeRegionResolved.profile,
      },
      entryInputs,
    });
  }, [
    sellPriceWon,
    months,
    loanRate,
    margin,
    otherConditionalExtra,
    buildingVatWon,
    propertySizeClass,
    exclusiveAreaResolved,
    buildingVatState.propertySizeMode,
    otherConditionalWon,
    housingBondCost,
    brokerFeeRegionResolved,
    entryInputs,
  ]);

  const bid = converged;
  const costs = converged.costs;
  const yieldTierTone = yieldTierClass(bid.netYield);
  const actualPreTaxMarginPct =
    bid.effectiveSellPrice > 0
      ? (bid.grossProfit / bid.effectiveSellPrice) * 100
      : 0;

  const farmTaxAutoApplies = useMemo(
    () =>
      farmTaxApplies(
        propertySizeClass,
        exclusiveAreaResolved,
        buildingVatState.propertySizeMode,
      ),
    [
      propertySizeClass,
      exclusiveAreaResolved,
      buildingVatState.propertySizeMode,
    ],
  );

  const farmTaxWon = useMemo(() => {
    if (!farmTaxAutoApplies) return 0;
    const farmItem = costs.items.find((i) => i.key === 'farm');
    return farmItem?.amount ?? 0;
  }, [farmTaxAutoApplies, costs.items]);

  function setConditionalWonField(key: ConditionalCostKey, raw: string) {
    const n = parseNumberInput(raw);
    setConditionalWonFields((prev) => ({
      ...prev,
      [key]: raw.trim() === '' ? '' : formatComma(n),
    }));
  }

  function renderCostAmount(item: (typeof costs.items)[number]) {
    if (item.key === 'farm') {
      if (farmTaxWon <= 0) {
        return ko.bidCalc.farmTaxExempt;
      }
      return <WonExactLeadDisplay meta="0.2%" amount={farmTaxWon} />;
    }
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
            className="loan-input conditional-won-input"
            value={conditionalWonFields[key]}
            onChange={(e) => setConditionalWonField(key, e.target.value)}
            placeholder="0"
            aria-label={`${item.name} (원)`}
          />
          <span className="manwon-unit">원</span>
        </span>
      );
    }
    if (item.amount == null) return undefined;
    if (item.rate != null) {
      return <WonExactLeadDisplay meta={pct(item.rate)} amount={item.amount} />;
    }
    return <WonExactAmt amount={item.amount} />;
  }

  const savePayload = useMemo(
    () => ({
      sellPrice: sellPriceWon,
      months: Math.min(6, Math.max(1, parseFloat(months) || 6)),
      loanRate,
      margin,
      conditionalMan: conditionalManForSave(
        conditionalWonFields,
        farmTaxAutoApplies ? farmTaxWon : undefined,
      ),
      officialPrice: officialPriceWon > 0 ? officialPriceWon : undefined,
      buildingVat: buildingVatSaved,
      exclusiveAreaM2: buildingVatSaved.exclusiveAreaM2,
      bidPrice: bid.bidPrice,
      effectiveSellPrice: bid.effectiveSellPrice,
      financeFreeDetailed: bid.financeFreeDetailed,
      housingBondBurden: housingBondCost?.customerBurden,
    }),
    [
      sellPriceWon,
      months,
      loanRate,
      margin,
      conditionalWonFields,
      officialPriceWon,
      buildingVatSaved,
      farmTaxAutoApplies,
      farmTaxWon,
      bid.bidPrice,
      bid.effectiveSellPrice,
      bid.financeFreeDetailed,
      housingBondCost?.customerBurden,
    ],
  );

  const persistBidCalc = useCallback(
    (payload: typeof savePayload) => {
      if (!activeCase) return;
      updateCase(activeCase.id, {
        bidCalcInputs: {
          sellPrice: payload.sellPrice,
          months: payload.months,
          loanRate: payload.loanRate,
          margin: payload.margin,
          unpaidMgmtFeeMan: payload.conditionalMan.unpaidMgmtFeeMan,
          evictionCostMan: payload.conditionalMan.evictionCostMan,
          miscOtherCostMan: payload.conditionalMan.miscOtherCostMan,
          farmTaxMan: payload.conditionalMan.farmTaxMan,
          repairCostMan: payload.conditionalMan.repairCostMan,
          forceExecCostMan: payload.conditionalMan.forceExecCostMan,
          officialPrice: payload.officialPrice,
          propertySizeMode: payload.buildingVat.propertySizeMode,
          exclusiveAreaM2: payload.buildingVat.exclusiveAreaM2,
          buildingVatCalcMode: payload.buildingVat.buildingVatCalcMode,
          buildingVatWon: payload.buildingVat.buildingVatWon,
          buildingVatMan: payload.buildingVat.buildingVatMan,
          landAreaM2: payload.buildingVat.landAreaM2,
          landUnitPricePerM2: payload.buildingVat.landUnitPricePerM2,
          buildingStandardPrice: payload.buildingVat.buildingStandardPrice,
          bidPrice: payload.bidPrice,
          effectiveSellPrice: payload.effectiveSellPrice,
          financeFreeDetailed: payload.financeFreeDetailed,
          housingBondBurden: payload.housingBondBurden,
        },
        ...(payload.exclusiveAreaM2 != null
          ? { exclusiveAreaM2: payload.exclusiveAreaM2 }
          : {}),
        stage: afterBidCalcSaved(activeCase.stage),
      });
    },
    [activeCase, updateCase],
  );

  const savePayloadRef = useRef(savePayload);
  savePayloadRef.current = savePayload;
  const persistRef = useRef(persistBidCalc);
  persistRef.current = persistBidCalc;

  useDebouncedSave(
    savePayload,
    500,
    (payload) => persistBidCalc(payload),
    Boolean(activeCase),
    activeCase?.id,
  );

  useEffect(() => {
    return () => {
      persistRef.current(savePayloadRef.current);
    };
  }, [activeCase?.id]);

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

      <div className="banner banner-soft">
        {entryProfileConfigured ? (
          <>
            {ko.bidCalc.entryProfileApplied}{' '}
            <Badge tone={bid.loanBadgeTone}>{bid.loanBadge}</Badge>
          </>
        ) : (
          <>
            {ko.bidCalc.entryProfileDefault}{' '}
            <Link href="/">{ko.bidCalc.entryProfileLink}</Link>
          </>
        )}
      </div>

      <BuildingVatSection
        sellPriceWon={sellPriceWon}
        caseExclusiveAreaM2={activeCase?.exclusiveAreaM2}
        state={buildingVatState}
        onChange={(patch) =>
          setBuildingVatState((prev) => ({ ...prev, ...patch }))
        }
        resolvedBuildingVatWon={buildingVatWon}
      />

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
              {housingBondLoading ? (
                <>
                  {' '}
                  <BounceDots />
                </>
              ) : null}
              {housingBond && !housingBondLoading ? (
                housingBond.exempt ? (
                  ' · 매입 면제 구간'
                ) : (
                  <>
                    {' · 채권 '}
                    <WonExactAmt amount={housingBond.purchaseAmount} />
                    {' / 본인부담 '}
                    <WonExactAmt amount={housingBond.customerBurden} />
                    {` (${housingBond.basisDate})`}
                  </>
                )
              ) : null}
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
              {ko.bidCalc.targetMarginLabel}{' '}
              <span className={`range-val ${yieldTierTone}`}>
                {yieldLabelText(bid.netYield)}
              </span>
            </label>
            <div className="calc-range-slider-row">
              <input
                id="marginRange"
                type="range"
                min={3}
                max={20}
                step={0.01}
                value={margin}
                onChange={(e) => {
                  const next = clampBidMarginPct(parseFloat(e.target.value));
                  setMargin(next);
                  setMarginDraft(next.toFixed(2));
                }}
              />
              <label className="calc-range-direct" htmlFor="marginDirect">
                <input
                  id="marginDirect"
                  type="text"
                  inputMode="decimal"
                  value={marginDraft}
                  aria-label={`${ko.bidCalc.targetMarginLabel} 직접 입력`}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.]/g, '');
                    setMarginDraft(raw);
                    const n = parseFloat(raw);
                    if (Number.isFinite(n) && n >= 3 && n <= 20) {
                      setMargin(clampBidMarginPct(n));
                    }
                  }}
                  onBlur={() => {
                    const n = parseFloat(marginDraft);
                    const next = clampBidMarginPct(
                      Number.isFinite(n) ? n : margin,
                    );
                    setMargin(next);
                    setMarginDraft(next.toFixed(2));
                  }}
                />
                <span className="calc-range-direct-unit">%</span>
              </label>
            </div>
            <div className="range-ticks">
              <span>저마진 수익률 12% 이하</span>
              <span>고마진 수익률 21% 초과</span>
            </div>
            <p className="field-hint">{ko.bidCalc.targetMarginHint}</p>
          </div>
        </div>
      </Section>

      <ResultPanel
        mark="역산 결과 (실시간 계산)"
        figure={
          <>
            입찰가 : <WonExactAmt amount={bid.bidPrice} />
          </>
        }
        caption={
          bid.conditionalExtra > 0
            ? `2차 취득 산정 입찰가 — 조건부 비용 선반영 · ${ko.bidCalc.preTaxProfitHint}`
            : `2차 취득 산정 입찰가 · ${ko.bidCalc.preTaxProfitHint}`
        }
        rows={[
          {
            label: ko.bidCalc.ltvApplied,
            value: (
              <>
                {(bid.ltvApplied * 100).toFixed(0)}%{' '}
                <Badge tone={bid.loanBadgeTone}>{bid.loanBadge}</Badge>
              </>
            ),
          },
          {
            label: ko.bidCalc.marginTargetAmt,
            value: <WonExactAmt amount={bid.marginTargetAmt} />,
          },
          {
            label: ko.bidCalc.effectiveSellPrice,
            value: <WonExactAmt amount={bid.effectiveSellPrice} />,
          },
          ...(bid.buildingVat > 0
            ? [
                {
                  label: '건물분 부가세',
                  value: (() => {
                    const rate =
                      sellPriceWon > 0
                        ? bid.buildingVat / sellPriceWon
                        : 0;
                    const verdict = buildingVatRateVerdictFromAmount(
                      sellPriceWon,
                      bid.buildingVat,
                    );
                    const suffix = verdict
                      ? ` · ${buildingVatVerdictLabel(verdict)}`
                      : '';
                    return (
                      <WonExactLeadDisplay
                        meta={`${pct(rate)}${suffix}`}
                        amount={bid.buildingVat}
                        minus
                      />
                    );
                  })(),
                },
              ]
            : []),
          {
            label: '입찰가',
            value: <WonExactAmt amount={bid.bidPrice} minus />,
          },
          {
            label: ko.bidCalc.detailedCost,
            value: <WonExactAmt amount={bid.profitDetailedTotal} minus />,
          },
          {
            label: ko.bidCalc.preTaxProfit,
            value: (
              <>
                <WonExactAmt amount={bid.grossProfit} />{' '}
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--slate)',
                  }}
                >
                  ({ko.bidCalc.actualMarginRate}{' '}
                  {actualPreTaxMarginPct.toFixed(1)}%)
                </span>
              </>
            ),
          },
          {
            label: ko.bidCalc.transferTax,
            value: (
              <WonExactLeadDisplay
                meta={formatTradingBusinessTransferTaxMeta(bid.grossProfit)}
                amount={bid.transferTax}
                minus
              />
            ),
          },
          {
            label: ko.bidCalc.localIncomeTax,
            value: (
              <WonExactLeadDisplay meta="10%" amount={bid.localIncomeTax} minus />
            ),
          },
          {
            label: '세후 예상수익',
            value: (
              <span className={`bid-key-metric ${yieldTierTone}`}>
                <WonExactAmt amount={bid.netProfit} />
              </span>
            ),
          },
          {
            label: ko.bidCalc.investedCapital,
            value: <WonExactAmt amount={bid.invested} />,
          },
          {
            label: '실투자금 대비 수익률',
            value: (
              <span className={`bid-key-metric ${yieldTierTone}`}>
                약 {bid.netYield.toFixed(1)}%
              </span>
            ),
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
        note="항목별 상세 비용 합계를 입찰가 역산에 반영합니다. 취득세·이자 등은 낙찰가에 연동되어 고정점까지 반복 계산합니다."
      >
        {costs.items.map((item) => (
          <RiskRow
            key={item.key}
            name={item.name}
            note={
              item.key === 'farm'
                ? farmTaxWon > 0
                  ? `${item.note} · ${ko.bidCalc.farmTaxAutoNote}`
                  : `${item.note} · ${ko.bidCalc.farmTaxExemptNote}`
                : item.note
            }
            amount={renderCostAmount(item)}
            badge={item.kind === 'required' ? '필수' : '조건부'}
            badgeTone={item.kind === 'required' ? 'neutral' : 'mid'}
          />
        ))}

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

      <p className="field-hint">{ko.bidCalc.transferTaxHint}</p>

      <Disclaimer>{ko.bidCalc.pageDisclaimer}</Disclaimer>
    </>
  );
}
