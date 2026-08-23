'use client';

import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { RepaymentMethodGuideModal } from '@/components/ui/RepaymentMethodGuideModal';
import { ResultPanel } from '@/components/ui/ResultPanel';
import { Badge } from '@/components/ui/Badge';
import { RegionEligibilityMap } from '@/components/RegionEligibilityMap';
import { calcEntryMatch } from '@/lib/calc/entryMatch';
import {
  normalizeRegZone,
  type HouseCount,
  type RegZone,
} from '@/lib/calc/acquisitionTax';
import { CREDIT_MAP, type CreditState } from '@/lib/calc/ltv';
import type { StressDsrMode } from '@/lib/calc/dsr';
import { STRESS_DSR_NOTICE } from '@/lib/calc/dsr';
import type { DsrRepaymentMethod } from '@/lib/calc/entryMatch';
import { fmtWon, formatComma, parseNumberInput } from '@/lib/format';
import { useCases } from '@/lib/hooks/useCases';
import { useDebouncedSave } from '@/lib/hooks/useDebouncedSave';
import { afterEntryMatchSaved } from '@/lib/stage';
import { loadEntryProfile, saveEntryProfile } from '@/lib/entryProfile';
import { normalizeCaseTrack } from '@/lib/caseUtils';
import { ko } from '@/messages/ko';

type PropType = '아파트' | '다세대' | '다가구';
type LenderType = '1금융권' | '2금융권';

const STRESS_MODE_LABEL: Record<StressDsrMode, string> = {
  policy: '정책기본',
  none: '스트레스 제외',
};

function normalizeStressMode(
  mode?: string | null,
): StressDsrMode {
  return mode === 'none' ? 'none' : 'policy';
}

const REPAYMENT_LABEL: Record<DsrRepaymentMethod, string> = {
  equalPrincipal: '원금균등',
  equalPayment: '원리금균등',
};

function defaultContractRatePct(credit: CreditState): string {
  return String(+(CREDIT_MAP[credit].rate * 100).toFixed(1));
}

const LENDER_DSR: Record<LenderType, number> = {
  '1금융권': 0.4,
  '2금융권': 0.5,
};

const REG_ZONE_LABEL: Record<RegZone, string> = {
  none: '비규제지역',
  adjusted: '규제지역 (조정대상지역·투기과열지구)',
};

const REG_ZONE_BADGE: Record<RegZone, 'neutral' | 'mid' | 'warn'> = {
  none: 'neutral',
  adjusted: 'warn',
};

const HOUSE_LABELS: Record<HouseCount, string> = {
  0: '무주택',
  1: '1주택',
  2: '2주택',
  3: '3주택 이상',
};

function MapSummaryPanel({
  seedMoneyLabel,
  houseCount,
  creditState,
  sudogwon,
  regZone,
  lowPriceException,
  dispositionPlanned,
  firstTimeBuyer,
  realDemand,
  bidCapacityLabel,
  ltvLabel,
  taxLabel,
}: {
  seedMoneyLabel: string;
  houseCount: HouseCount;
  creditState: CreditState;
  sudogwon: boolean;
  regZone: RegZone;
  lowPriceException: boolean;
  dispositionPlanned: boolean;
  firstTimeBuyer: boolean;
  realDemand: boolean;
  bidCapacityLabel: string;
  ltvLabel: string;
  taxLabel: string;
}) {
  return (
    <div className="map-summary">
      <div className="ms-title">현재 입력한 기본정보</div>
      <div className="ms-row">
        <span>시드머니</span>
        <span>{seedMoneyLabel}</span>
      </div>
      <div className="ms-row">
        <span>주택수</span>
        <span>{HOUSE_LABELS[houseCount]}</span>
      </div>
      <div className="ms-row">
        <span>신용 상태</span>
        <span>{CREDIT_MAP[creditState].label}</span>
      </div>
      <div className="ms-row">
        <span>소재지 권역</span>
        <span>{sudogwon ? '수도권' : '지방'}</span>
      </div>
      <div className="ms-row">
        <span>규제구분</span>
        <span>{REG_ZONE_LABEL[regZone]}</span>
      </div>
      <div className="ms-row">
        <span>저가주택 특례</span>
        <span>{lowPriceException ? '해당함' : '해당 없음'}</span>
      </div>
      <div className="ms-row">
        <span>처분조건부</span>
        <span>{dispositionPlanned ? '해당함' : '해당 없음'}</span>
      </div>
      <div className="ms-row">
        <span>생애최초</span>
        <span>{firstTimeBuyer ? '해당함' : '해당 없음'}</span>
      </div>
      <div className="ms-row" style={{ borderBottom: 'none' }}>
        <span>서민·실수요자</span>
        <span>{realDemand ? '해당함' : '해당 없음'}</span>
      </div>
      <div className="ms-title" style={{ marginTop: 14 }}>
        계산 결과
      </div>
      <div className="ms-row">
        <span>실투자 가능 낙찰가</span>
        <span>{bidCapacityLabel}</span>
      </div>
      <div className="ms-row">
        <span>적용 LTV</span>
        <span>{ltvLabel}</span>
      </div>
      <div className="ms-row">
        <span>예상 취득세</span>
        <span>{taxLabel}</span>
      </div>
    </div>
  );
}

function taxBadge(
  taxDeduction: number,
  dispositionPlanned: boolean,
  lowPriceException: boolean,
  taxRate: number,
) {
  if (taxDeduction > 0) {
    return (
      <Badge tone="ok">생애최초 감면 {fmtWon(taxDeduction)} 적용</Badge>
    );
  }
  if (dispositionPlanned) {
    return <Badge tone="ok">일시적 2주택 특례 적용</Badge>;
  }
  if (lowPriceException) {
    return <Badge tone="ok">저가주택 특례 적용</Badge>;
  }
  if (taxRate >= 0.08) {
    return <Badge tone="warn">다주택 중과</Badge>;
  }
  return null;
}

function readInitialInputs() {
  if (typeof window === 'undefined') return null;
  return loadEntryProfile()?.inputs ?? null;
}

export default function EntryMatchPage() {
  const { activeCase, updateCase } = useCases();
  const initial = readInitialInputs();

  const [seedMoney, setSeedMoney] = useState(
    initial?.seedMoney ? formatComma(initial.seedMoney / 10000) : '10,000',
  );
  const [houseCount, setHouseCount] = useState<HouseCount>(
    initial?.houseCount ?? 0,
  );
  const [creditState, setCreditState] = useState<CreditState>(
    initial?.creditState ?? '보통',
  );
  const [propType, setPropType] = useState<PropType>(
    initial?.propType ?? '아파트',
  );
  const [annualIncome, setAnnualIncome] = useState(
    initial?.annualIncome
      ? formatComma(initial.annualIncome / 10000)
      : '5,000',
  );
  const [lenderType, setLenderType] = useState<LenderType>(
    initial?.lenderType ?? '2금융권',
  );
  const [sudogwon, setSudogwon] = useState(initial?.sudogwon ?? true);
  const [regZone, setRegZone] = useState<RegZone>(() => {
    const isSudogwon = initial?.sudogwon ?? true;
    return isSudogwon ? normalizeRegZone(initial?.regZone) : 'none';
  });
  const [lowPriceException, setLowPriceException] = useState(
    initial?.lowPriceException ?? false,
  );
  const [dispositionPlanned, setDispositionPlanned] = useState(
    initial?.dispositionPlanned ?? false,
  );
  const [firstTimeBuyer, setFirstTimeBuyer] = useState(
    initial?.firstTimeBuyer ?? false,
  );
  const [realDemand, setRealDemand] = useState(initial?.realDemand ?? false);
  const [existingMonthlyDebt, setExistingMonthlyDebt] = useState(
    initial?.existingAnnualDebt
      ? formatComma(Math.round(initial.existingAnnualDebt / 12 / 10000))
      : '',
  );
  const [stressMode, setStressMode] = useState<StressDsrMode>(
    normalizeStressMode(initial?.stressMode),
  );
  const [contractRatePct, setContractRatePct] = useState(() =>
    initial?.contractRate != null
      ? String(+(initial.contractRate * 100).toFixed(2))
      : defaultContractRatePct(initial?.creditState ?? '보통'),
  );
  const [dsrRepaymentMethod, setDsrRepaymentMethod] =
    useState<DsrRepaymentMethod>(
      initial?.dsrRepaymentMethod ?? 'equalPrincipal',
    );
  const [repaymentGuideOpen, setRepaymentGuideOpen] = useState(false);

  useEffect(() => {
    const global = loadEntryProfile();
    const s = activeCase?.entryMatchInputs ?? global?.inputs;
    if (!s) return;
    setSeedMoney(formatComma(s.seedMoney / 10000));
    setHouseCount(s.houseCount);
    setCreditState(s.creditState);
    setPropType(s.propType);
    setLenderType(s.lenderType);
    setSudogwon(s.sudogwon ?? true);
    setRegZone(
      s.sudogwon === false ? 'none' : normalizeRegZone(s.regZone),
    );
    setLowPriceException(s.lowPriceException ?? false);
    setDispositionPlanned(s.dispositionPlanned ?? false);
    setFirstTimeBuyer(s.firstTimeBuyer ?? false);
    setRealDemand(s.realDemand ?? false);
    setAnnualIncome(
      formatComma((s.annualIncome ?? 50_000_000) / 10000),
    );
    setExistingMonthlyDebt(
      s.existingAnnualDebt
        ? formatComma(Math.round(s.existingAnnualDebt / 12 / 10000))
        : '',
    );
    setStressMode(normalizeStressMode(s.stressMode));
    setContractRatePct(
      s.contractRate != null
        ? String(+(s.contractRate * 100).toFixed(2))
        : defaultContractRatePct(s.creditState),
    );
    setDsrRepaymentMethod(s.dsrRepaymentMethod ?? 'equalPrincipal');
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sudogwon) setRegZone('none');
  }, [sudogwon]);

  // 특례 boolean — 최상단에서 한 번 계산 후 하위 전부 재사용
  const ftb = houseCount === 0 && firstTimeBuyer;
  const rd = houseCount === 0 && realDemand;
  // 처분예정: 1주택만 선택 가능 / 무주택·2주택+는 해당없음 고정
  const dispositionSelectable = houseCount === 1;
  const dispositionLockedOut = houseCount >= 2;
  const dispositionEffective = dispositionSelectable && dispositionPlanned;

  useEffect(() => {
    if (!dispositionSelectable && dispositionPlanned) {
      setDispositionPlanned(false);
    }
  }, [dispositionSelectable, dispositionPlanned]);

  const result = useMemo(() => {
    const existingAnnualDebt =
      parseNumberInput(existingMonthlyDebt) * 10000 * 12;
    const contractPct = parseFloat(contractRatePct.replace(/,/g, ''));
    const contractRate =
      Number.isFinite(contractPct) && contractPct > 0
        ? contractPct / 100
        : CREDIT_MAP[creditState].rate;
    return calcEntryMatch({
      seedMoney: parseNumberInput(seedMoney) * 10000,
      houseCount,
      creditState,
      annualIncome: parseNumberInput(annualIncome) * 10000,
      dsrRate: LENDER_DSR[lenderType],
      regZone,
      sudogwon,
      lowPriceException,
      dispositionPlanned: dispositionEffective,
      firstTimeBuyer: ftb,
      realDemand: rd,
      existingAnnualDebt,
      stressMode,
      rateType: 'floating',
      contractRate,
      dsrRepaymentMethod,
    });
  }, [
    seedMoney,
    houseCount,
    creditState,
    annualIncome,
    lenderType,
    regZone,
    sudogwon,
    lowPriceException,
    dispositionEffective,
    ftb,
    rd,
    existingMonthlyDebt,
    stressMode,
    contractRatePct,
    dsrRepaymentMethod,
  ]);

  const savePayload = useMemo(
    () => ({
      seedMoney: parseNumberInput(seedMoney) * 10000,
      houseCount,
      creditState,
      propType,
      lenderType,
      sudogwon,
      regZone,
      lowPriceException,
      dispositionPlanned: dispositionEffective,
      firstTimeBuyer: ftb,
      realDemand: rd,
      annualIncome: parseNumberInput(annualIncome) * 10000,
      existingAnnualDebt:
        parseNumberInput(existingMonthlyDebt) * 10000 * 12,
      stressMode,
      rateType: 'floating' as const,
      contractRate: (() => {
        const pct = parseFloat(contractRatePct.replace(/,/g, ''));
        return Number.isFinite(pct) && pct > 0
          ? pct / 100
          : CREDIT_MAP[creditState].rate;
      })(),
      dsrRepaymentMethod,
      result,
    }),
    [
      seedMoney,
      houseCount,
      creditState,
      propType,
      lenderType,
      sudogwon,
      regZone,
      lowPriceException,
      dispositionEffective,
      ftb,
      rd,
      annualIncome,
      existingMonthlyDebt,
      stressMode,
      contractRatePct,
      dsrRepaymentMethod,
      result,
    ],
  );

  useDebouncedSave(
    savePayload,
    500,
    (payload) => {
      saveEntryProfile(
        {
          seedMoney: payload.seedMoney,
          houseCount: payload.houseCount,
          creditState: payload.creditState,
          propType: payload.propType,
          lenderType: payload.lenderType,
          sudogwon: payload.sudogwon,
          regZone: payload.regZone,
          lowPriceException: payload.lowPriceException,
          dispositionPlanned: payload.dispositionPlanned,
          firstTimeBuyer: payload.firstTimeBuyer,
          realDemand: payload.realDemand,
          annualIncome: payload.annualIncome,
          existingAnnualDebt: payload.existingAnnualDebt || undefined,
          stressMode: payload.stressMode,
          rateType: payload.rateType,
          contractRate: payload.contractRate,
          dsrRepaymentMethod: payload.dsrRepaymentMethod,
        },
        {
          bidCapacity: payload.result.bidCapacity,
          ltvApplied: payload.result.ltvApplied,
          dsrCapacity: payload.result.dsrCapacity,
          dsrCapacityEqualPayment: payload.result.dsrCapacityEqualPayment,
          dsrCapacityEqualPrincipal: payload.result.dsrCapacityEqualPrincipal,
          assessmentRate: payload.result.assessmentRate,
          stressPremium: payload.result.stressPremium,
        },
      );

      if (!activeCase || normalizeCaseTrack(activeCase) === 'eviction') return;

      updateCase(activeCase.id, {
        entryMatchInputs: {
          seedMoney: payload.seedMoney,
          houseCount: payload.houseCount,
          creditState: payload.creditState,
          propType: payload.propType,
          lenderType: payload.lenderType,
          sudogwon: payload.sudogwon,
          regZone: payload.regZone,
          lowPriceException: payload.lowPriceException,
          dispositionPlanned: payload.dispositionPlanned,
          firstTimeBuyer: payload.firstTimeBuyer,
          realDemand: payload.realDemand,
          annualIncome: payload.annualIncome,
          existingAnnualDebt: payload.existingAnnualDebt || undefined,
          stressMode: payload.stressMode,
          rateType: payload.rateType,
          contractRate: payload.contractRate,
          dsrRepaymentMethod: payload.dsrRepaymentMethod,
        },
        entryMatchResult: {
          bidCapacity: payload.result.bidCapacity,
          ltvApplied: payload.result.ltvApplied,
          dsrCapacity: payload.result.dsrCapacity,
          dsrCapacityEqualPayment: payload.result.dsrCapacityEqualPayment,
          dsrCapacityEqualPrincipal: payload.result.dsrCapacityEqualPrincipal,
          assessmentRate: payload.result.assessmentRate,
          stressPremium: payload.result.stressPremium,
        },
        stage: afterEntryMatchSaved(activeCase.stage),
      });
    },
    true,
    activeCase?.id ?? 'global-profile',
  );

  const taxBadgeEl = taxBadge(
    result.taxDeduction,
    dispositionEffective,
    lowPriceException,
    result.taxRate,
  );

  return (
    <>
      <div className="chapter-mark">설정 · 투자 상담</div>
      <h1 className="page-title">
        지금, <em>얼마까지</em>
        <br />
        입찰할 수 있나요?
      </h1>
      <p className="page-sub">
        시드머니와 주택수를 넣으면 취득세 중과·LTV를 반영한 실투자 가능 범위를
        계산합니다. 특정 지역이나 물건을 추천하지 않습니다.
      </p>

      {!activeCase ? (
        <div className="banner banner-soft">{ko.entryProfile.noCaseHint}</div>
      ) : (
        <div className="banner banner-soft">{ko.entryProfile.globalHint}</div>
      )}

      <Section title="기본 정보">
        <div className="grid2">
          <div className="grid2-row">
            <div className="field">
              <div className="field-box">
                <label htmlFor="seedMoney">시드머니 (만원)</label>
                <input
                  id="seedMoney"
                  type="text"
                  value={seedMoney}
                  onChange={(e) => {
                    const n = parseNumberInput(e.target.value);
                    setSeedMoney(e.target.value === '' ? '' : formatComma(n));
                  }}
                />
              </div>
              <p className="field-hint" />
            </div>
            <div className="field">
              <div className="field-box">
                <label htmlFor="houseCount">현재 주택수</label>
                <select
                  id="houseCount"
                  value={houseCount}
                  onChange={(e) =>
                    setHouseCount(Number(e.target.value) as HouseCount)
                  }
                >
                  <option value={0}>무주택</option>
                  <option value={1}>1주택</option>
                  <option value={2}>2주택</option>
                  <option value={3}>3주택 이상</option>
                </select>
              </div>
              <p className="field-hint" />
            </div>
          </div>

          {houseCount === 0 ? (
            <div className="grid2-row">
              <div className="field">
                <div className="field-box">
                  <label htmlFor="firstTimeBuyer">
                    생애최초 주택구입자 여부{' '}
                    <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                      — 무주택자에게만 적용, 일반 무주택자보다 LTV 우대
                    </span>
                  </label>
                  <select
                    id="firstTimeBuyer"
                    value={firstTimeBuyer ? 'yes' : 'no'}
                    onChange={(e) => {
                      const on = e.target.value === 'yes';
                      setFirstTimeBuyer(on);
                      if (on) setRealDemand(false);
                    }}
                  >
                    <option value="no">해당 없음</option>
                    <option value="yes">
                      해당함 — LTV 수도권·규제지역 70% / 지방·비규제 80%
                    </option>
                  </select>
                </div>
                <p className="field-hint" />
              </div>
              <div className="field">
                <div className="field-box">
                  <label htmlFor="realDemand">
                    서민·실수요자 요건 충족{' '}
                    <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                      — 부부합산 연소득 9천만원 이하 · 주택가액 조정대상
                      8억/투기과열 9억 이하 · 무주택 세대주(생애최초 아닌
                      경우만 의미 있음)
                    </span>
                  </label>
                  <select
                    id="realDemand"
                    value={realDemand ? 'yes' : 'no'}
                    onChange={(e) => {
                      const on = e.target.value === 'yes';
                      setRealDemand(on);
                      if (on) setFirstTimeBuyer(false);
                    }}
                  >
                    <option value="no">해당 없음</option>
                    <option value="yes">해당함 — 규제지역 LTV 60% 적용</option>
                  </select>
                </div>
                <p className="field-hint">
                  주택가액 기준은 낙찰가 확정 전에는 자동 판정이 안 되니, 임장
                  후 예상 매도가 기준으로 직접 확인 후 선택하세요.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid2-row">
            <div className="field">
              <div className="field-box">
                <label htmlFor="creditState">
                  신용 상태{' '}
                  <span className="range-val">
                    {CREDIT_MAP[creditState].label}
                  </span>
                </label>
                <select
                  id="creditState"
                  value={creditState}
                  onChange={(e) => {
                    const next = e.target.value as CreditState;
                    setCreditState(next);
                    setContractRatePct(defaultContractRatePct(next));
                  }}
                >
                  <option value="우수">{CREDIT_MAP.우수.label}</option>
                  <option value="보통">{CREDIT_MAP.보통.label}</option>
                  <option value="주의">{CREDIT_MAP.주의.label}</option>
                </select>
              </div>
              <p className="field-hint">
                LTV 계산용 신용 보정입니다. DSR 금리는 아래 대출 여력에서
                직접 입력합니다.
              </p>
            </div>
            <div className="field">
              <div className="field-box">
                <label htmlFor="propType">관심 물건유형</label>
                <select
                  id="propType"
                  value={propType}
                  onChange={(e) => setPropType(e.target.value as PropType)}
                >
                  <option value="아파트">아파트</option>
                  <option value="다세대">다세대</option>
                  <option value="다가구">다가구</option>
                </select>
              </div>
              <p className="field-hint" />
            </div>
          </div>

          <div className="grid2-row">
            <div className="field">
              <div className="field-box">
                <label htmlFor="annualIncome">
                  연소득 (만원){' '}
                  <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                    — 소득금액증명서 소득금액 합계
                  </span>
                </label>
                <input
                  id="annualIncome"
                  type="text"
                  value={annualIncome}
                  onChange={(e) => {
                    const n = parseNumberInput(e.target.value);
                    setAnnualIncome(
                      e.target.value === '' ? '' : formatComma(n),
                    );
                  }}
                />
              </div>
              <p className="field-hint" />
            </div>
            <div className="field">
              <div className="field-box">
                <label htmlFor="lenderType">경락대출 취급기관</label>
                <select
                  id="lenderType"
                  value={lenderType}
                  onChange={(e) => setLenderType(e.target.value as LenderType)}
                >
                  <option value="1금융권">1금융권 (은행) · DSR 40%</option>
                  <option value="2금융권">
                    2금융권 (저축은행·캐피탈 등) · DSR 50%
                  </option>
                </select>
              </div>
              <p className="field-hint" />
            </div>
          </div>

          <div className="grid2-row">
            <div className="field">
              <div className="field-box">
                <label htmlFor="existingMonthlyDebt">
                  기존 대출 월 상환 (만원){' '}
                  <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                    — 선택 · DSR 잔여 여력
                  </span>
                </label>
                <input
                  id="existingMonthlyDebt"
                  type="text"
                  value={existingMonthlyDebt}
                  placeholder="0"
                  onChange={(e) => {
                    const n = parseNumberInput(e.target.value);
                    setExistingMonthlyDebt(
                      e.target.value === '' ? '' : formatComma(n),
                    );
                  }}
                />
              </div>
              <p className="field-hint">
                신용·기타 대출의 월 원리금 합계입니다. 없으면 비워 두세요.
              </p>
            </div>
            <div className="field">
              <div className="field-box">
                <label htmlFor="stressMode">스트레스 DSR 모드</label>
                <select
                  id="stressMode"
                  value={stressMode}
                  onChange={(e) =>
                    setStressMode(e.target.value as StressDsrMode)
                  }
                >
                  <option value="policy">
                    정책기본 — 고시 스트레스금리 가산 (입찰 전 권장)
                  </option>
                  <option value="none">
                    스트레스 제외 — 실제 대출금리만 (비교용)
                  </option>
                </select>
              </div>
              <p className="field-hint">{STRESS_DSR_NOTICE}</p>
            </div>
          </div>

          <div className="grid2-row">
            <div className="field">
              <div className="field-box">
                <label htmlFor="sudogwon">
                  물건 소재지 권역{' '}
                  <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                    — 2주택 이상 대출가능여부를 가르는 기준 (2025.6.27 대책)
                  </span>
                </label>
                <select
                  id="sudogwon"
                  value={sudogwon ? 'yes' : 'no'}
                  onChange={(e) => {
                    const next = e.target.value === 'yes';
                    setSudogwon(next);
                    if (!next) setRegZone('none');
                  }}
                >
                  <option value="yes">수도권 (서울·경기·인천)</option>
                  <option value="no">지방</option>
                </select>
              </div>
              <p className="field-hint">
                수도권은 조정대상지역 지정 여부와 무관하게 전역이 대상입니다.
              </p>
            </div>
            <div className="field">
              <div className="field-box">
                <label htmlFor="regZone">
                  물건 소재지 규제구분{' '}
                  <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                    —{' '}
                    <a
                      href="https://www.molit.go.kr"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--brass-deep)',
                        textDecoration: 'underline',
                      }}
                    >
                      국토부 규제지역 현황
                    </a>
                    에서 직접 확인 후 선택 (취득세 계산용)
                  </span>
                </label>
                <select
                  id="regZone"
                  value={regZone}
                  onChange={(e) => setRegZone(e.target.value as RegZone)}
                >
                  <option value="none">비규제지역</option>
                  <option value="adjusted">
                    규제지역 (조정대상지역·투기과열지구)
                  </option>
                </select>
              </div>
              <p className="field-hint">
                {sudogwon
                  ? '현재 규제지역(서울 전역, 경기 12곳+화성 동탄구·용인 기흥구·구리시)은 조정대상지역과 투기과열지구로 동시 지정되어 있어 계산상 구분이 없습니다.'
                  : '지방 소재는 규제지역 구분이 없어 비규제지역으로 자동 적용됩니다.'}
              </p>
            </div>
          </div>

          <div className="grid2-row">
            <div className="field">
              <div className="field-box">
                <label htmlFor="lowPriceException">
                  저가주택 특례 해당 여부{' '}
                  <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                    — 공시가격 수도권 1억원 / 지방 2억원 이하 (정비구역 제외)
                  </span>
                </label>
                <select
                  id="lowPriceException"
                  value={lowPriceException ? 'yes' : 'no'}
                  onChange={(e) =>
                    setLowPriceException(e.target.value === 'yes')
                  }
                >
                  <option value="no">해당 없음</option>
                  <option value="yes">
                    해당함 — 취득세 일반세율 적용 (대출 조건에는 영향 없음)
                  </option>
                </select>
              </div>
              <p className="field-hint">
                기준은 낙찰가가 아니라 공시가격입니다. 정비구역(재개발·재건축
                지정구역)은 특례 대상에서 제외되니 직접 확인 후 선택하세요.
                저가주택 특례는 취득세에만 적용되고, 수도권 다주택자
                대출금지는 예외 없이 그대로 적용됩니다.
              </p>
            </div>
            <div
              className={`field${dispositionLockedOut ? ' is-dimmed' : ''}`}
            >
              <div className="field-box">
                <label htmlFor="dispositionPlanned">
                  기존 주택 처분 예정 (일시적 2주택){' '}
                  <span style={{ fontWeight: 400, color: 'var(--slate)' }}>
                    — 대출은 6개월 내, 취득세는 조정대상지역 2년·지방 3년 내
                    처분 조건
                  </span>
                </label>
                <select
                  id="dispositionPlanned"
                  className={houseCount === 0 ? 'select-no-arrow' : undefined}
                  value={dispositionEffective ? 'yes' : 'no'}
                  disabled={!dispositionSelectable}
                  onChange={(e) =>
                    setDispositionPlanned(e.target.value === 'yes')
                  }
                >
                  <option value="no">해당 없음</option>
                  {dispositionSelectable ? (
                    <option value="yes">
                      해당함 — 무주택자와 동일하게 LTV·취득세 적용
                    </option>
                  ) : null}
                </select>
              </div>
              <p className="field-hint">
                {dispositionLockedOut
                  ? '2주택 이상에서는 일시적 2주택(처분조건부) 특례를 적용하지 않습니다.'
                  : houseCount === 0
                    ? '무주택자는 처분할 기존 주택이 없어 해당 없음만 선택할 수 있습니다.'
                    : '대출(6.27대책)은 6개월 내 처분 확약이 조건입니다. 취득세(일시적 2주택 특례)는 2026.8.3 세제개편으로 조정대상지역은 3년→2년으로 단축(2026.8.4 이후 신규취득분부터, 8.3 이전 취득·계약금지급분은 종전 3년 유지), 지방은 3년 그대로입니다. 세 기간이 서로 달라 6개월은 넘기고 2~3년 안에만 파는 경우 세금 혜택만 받고 대출 혜택은 못 받을 수 있으니 실제로는 취득 시점 기준으로 별도 확인이 필요합니다.'}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="대출 여력 (DSR)">
        <p className="s-note">
          스트레스금리는 실제 이자가 아닙니다. 한도 심사에만 쓰는 가상
          금리입니다.
        </p>
        <div className="dsr-rate-breakdown">
          <div className="dsr-rate-row dsr-rate-row-input">
            <label htmlFor="contractRatePct">실제 대출금리</label>
            <div className="dsr-rate-input-wrap">
              <input
                id="contractRatePct"
                type="text"
                inputMode="decimal"
                className="dsr-rate-input"
                value={contractRatePct}
                onChange={(e) =>
                  setContractRatePct(e.target.value.replace(/[^\d.]/g, ''))
                }
              />
              <span className="dsr-rate-input-suffix">%</span>
            </div>
          </div>
          <div className="dsr-rate-row">
            <span>+ 스트레스 가산</span>
            <span>
              {stressMode === 'none'
                ? '0.0%p'
                : `+${(result.stressPremium * 100).toFixed(
                    result.stressPremium % 0.01 === 0 ? 1 : 2,
                  )}%p`}
            </span>
          </div>
          <div className="dsr-rate-row dsr-rate-row-total">
            <span>DSR 산정금리</span>
            <span>{(result.assessmentRate * 100).toFixed(2)}%</span>
          </div>
        </div>
        <p className="field-hint" style={{ marginTop: 8, marginBottom: 16 }}>
          {result.stressLabel} · {result.stressNotice}
          {stressMode === 'policy' ? ` · ${STRESS_DSR_NOTICE}` : null}
        </p>

        <div className="dsr-capacity-toolbar">
          <span className="dsr-capacity-toolbar-label">상환방식 선택</span>
          <button
            type="button"
            className="dsr-help-link"
            onClick={() => setRepaymentGuideOpen(true)}
          >
            원금·원리금 차이
          </button>
        </div>

        <div className="dsr-capacity-grid">
          <button
            type="button"
            className={`dsr-capacity-card${
              dsrRepaymentMethod === 'equalPrincipal'
                ? ' dsr-capacity-card-selected'
                : ''
            }`}
            onClick={() => setDsrRepaymentMethod('equalPrincipal')}
          >
            <div className="dsr-capacity-title">
              원금균등 · {STRESS_MODE_LABEL[stressMode]}
            </div>
            <div className="dsr-capacity-figure">
              {fmtWon(result.dsrCapacityEqualPrincipal)}
            </div>
            <div className="dsr-capacity-meta">
              {dsrRepaymentMethod === 'equalPrincipal'
                ? '입찰 상한에 반영 · '
                : null}
              월 상환 가능{' '}
              {fmtWon(Math.round(result.annualRepayCapacity / 12))}
            </div>
          </button>
          <button
            type="button"
            className={`dsr-capacity-card${
              dsrRepaymentMethod === 'equalPayment'
                ? ' dsr-capacity-card-selected'
                : ''
            }`}
            onClick={() => setDsrRepaymentMethod('equalPayment')}
          >
            <div className="dsr-capacity-title">
              원리금균등 · {STRESS_MODE_LABEL[stressMode]}
            </div>
            <div className="dsr-capacity-figure dsr-capacity-figure-sub">
              {fmtWon(result.dsrCapacityEqualPayment)}
            </div>
            <div className="dsr-capacity-meta">
              {dsrRepaymentMethod === 'equalPayment'
                ? '입찰 상한에 반영 · '
                : null}
              일부 은행·2금융은 이 방식으로 더 높게 나올 수 있음
            </div>
          </button>
        </div>

        <div className="dsr-breakdown-block">
          <div className="dsr-breakdown-title">산출 근거</div>
          <div className="dsr-breakdown-body">
            <div className="dsr-rate-row">
              <span>연간 최대 상환 (소득 × DSR)</span>
              <span>{fmtWon(Math.round(result.annualRepayCapacity))}</span>
            </div>
            <div className="dsr-rate-row">
              <span>실제 대출금리</span>
              <span>{(result.contractRate * 100).toFixed(2)}%</span>
            </div>
            <div className="dsr-rate-row">
              <span>스트레스 모드</span>
              <span>{STRESS_MODE_LABEL[stressMode]}</span>
            </div>
            <div className="dsr-rate-row">
              <span>상환방식 (입찰 상한)</span>
              <span>{REPAYMENT_LABEL[dsrRepaymentMethod]}</span>
            </div>
            <div className="dsr-rate-row">
              <span>상환기간</span>
              <span>30년</span>
            </div>
          </div>
        </div>
      </Section>

      <ResultPanel
        mark="입찰 상한 (실시간)"
        figure={fmtWon(result.bidCapacity)}
        caption={
          <>
            {REPAYMENT_LABEL[dsrRepaymentMethod]} DSR ·{' '}
            {STRESS_MODE_LABEL[stressMode]} · LTV·절대금액 캡 중 가장 낮은 쪽
            적용
            {result.binding === 'DSR' ? (
              <>
                {' '}
                · 지금은 <strong>DSR</strong> 때문에 여기까지
              </>
            ) : result.binding === 'LTV' ? (
              <> · 지금은 LTV 때문에 여기까지</>
            ) : result.binding === 'CAP' ? (
              <> · 절대금액 캡 적용</>
            ) : null}
          </>
        }
        rows={[
          {
            label: '적용 LTV',
            value: (
              <>
                {(result.ltvApplied * 100).toFixed(0)}%
                {result.ltvUnverified ? (
                  <>
                    {' '}
                    <Badge tone="mid">미확정 참고치</Badge>
                  </>
                ) : null}
              </>
            ),
          },
          {
            label:
              dsrRepaymentMethod === 'equalPrincipal'
                ? 'DSR 한도 (원금균등)'
                : 'DSR 한도 (원리금균등)',
            value: fmtWon(
              dsrRepaymentMethod === 'equalPrincipal'
                ? result.dsrCapacityEqualPrincipal
                : result.dsrCapacityEqualPayment,
            ),
          },
          {
            label: 'DSR 산정금리',
            value: `${(result.assessmentRate * 100).toFixed(2)}% (실제 대출금리 ${(result.contractRate * 100).toFixed(2)}%)`,
          },
          {
            label: '실제 적용 대출한도',
            value: (
              <>
                {fmtWon(result.loanCapacity)}{' '}
                <Badge tone={result.loanBadgeTone}>{result.loanBadge}</Badge>
              </>
            ),
          },
          { label: '추천 물건 규모', value: result.sizeGuide },
          {
            label: '예상 취득세',
            value: (
              <>
                {fmtWon(result.taxAmount)} (
                {(result.taxRate * 100).toFixed(1)}%)
                {taxBadgeEl ? <> {taxBadgeEl}</> : null}
              </>
            ),
          },
          {
            label: '규제지역 여부 (선택값 기준)',
            value: (
              <Badge tone={REG_ZONE_BADGE[regZone]}>
                {REG_ZONE_LABEL[regZone]}
              </Badge>
            ),
          },
        ]}
      />

      <RegionEligibilityMap
        houseCount={houseCount}
        sudogwon={sudogwon}
        regZone={regZone}
        ltvApplied={result.ltvApplied}
        taxRate={result.taxRate}
        creditState={creditState}
        referencePrice={result.bidCapacity}
        lowPriceException={lowPriceException}
        dispositionPlanned={dispositionEffective}
        firstTimeBuyer={ftb}
        realDemand={rd}
        summary={
          <MapSummaryPanel
            seedMoneyLabel={`${seedMoney || '0'}만원`}
            houseCount={houseCount}
            creditState={creditState}
            sudogwon={sudogwon}
            regZone={regZone}
            lowPriceException={lowPriceException}
            dispositionPlanned={dispositionEffective}
            firstTimeBuyer={ftb}
            realDemand={rd}
            bidCapacityLabel={fmtWon(result.bidCapacity)}
            ltvLabel={`${(result.ltvApplied * 100).toFixed(0)}%`}
            taxLabel={`${fmtWon(result.taxAmount)} (${(result.taxRate * 100).toFixed(1)}%)`}
          />
        }
      />

      <RepaymentMethodGuideModal
        open={repaymentGuideOpen}
        onClose={() => setRepaymentGuideOpen(false)}
        selectedMethod={dsrRepaymentMethod}
      />
    </>
  );
}
