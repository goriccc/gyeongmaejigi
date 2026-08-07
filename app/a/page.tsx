'use client';

import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { ResultPanel } from '@/components/ui/ResultPanel';
import { Badge } from '@/components/ui/Badge';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { calcEntryMatch } from '@/lib/calc/entryMatch';
import { CREDIT_MAP, type CreditState } from '@/lib/calc/ltv';
import { fmtWon, formatComma, parseNumberInput } from '@/lib/format';
import { useCases } from '@/lib/hooks/useCases';
import { useDebouncedSave } from '@/lib/hooks/useDebouncedSave';
import { afterEntryMatchSaved } from '@/lib/stage';
import { ko } from '@/messages/ko';

type PropType = '아파트' | '다세대' | '다가구';
type LenderType = '1금융권' | '2금융권';

const LENDER_DSR: Record<LenderType, number> = {
  '1금융권': 0.4,
  '2금융권': 0.5,
};

export default function EntryMatchPage() {
  const { activeCase, updateCase } = useCases();
  const saved = activeCase?.entryMatchInputs;

  const [seedMoney, setSeedMoney] = useState(
    saved?.seedMoney ? formatComma(saved.seedMoney / 10000) : '8,000',
  );
  const [houseCount, setHouseCount] = useState<0 | 1 | 2>(
    saved?.houseCount ?? 0,
  );
  const [creditState, setCreditState] = useState<CreditState>(
    saved?.creditState ?? '보통',
  );
  const [propType, setPropType] = useState<PropType>(
    saved?.propType ?? '아파트',
  );
  const [annualIncome, setAnnualIncome] = useState('5,500');
  const [lenderType, setLenderType] = useState<LenderType>(
    saved?.lenderType ?? '2금융권',
  );

  useEffect(() => {
    const s = activeCase?.entryMatchInputs;
    if (!s) return;
    setSeedMoney(formatComma(s.seedMoney / 10000));
    setHouseCount(s.houseCount);
    setCreditState(s.creditState);
    setPropType(s.propType);
    setLenderType(s.lenderType);
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => {
    return calcEntryMatch({
      seedMoney: parseNumberInput(seedMoney) * 10000,
      houseCount,
      creditState,
      annualIncome: parseNumberInput(annualIncome) * 10000,
      dsrRate: LENDER_DSR[lenderType],
    });
  }, [seedMoney, houseCount, creditState, annualIncome, lenderType]);

  const savePayload = useMemo(
    () => ({
      seedMoney: parseNumberInput(seedMoney) * 10000,
      houseCount,
      creditState,
      propType,
      lenderType,
      result,
    }),
    [seedMoney, houseCount, creditState, propType, lenderType, result],
  );

  useDebouncedSave(
    savePayload,
    500,
    (payload) => {
      if (!activeCase) return;
      updateCase(activeCase.id, {
        entryMatchInputs: {
          seedMoney: payload.seedMoney,
          houseCount: payload.houseCount,
          creditState: payload.creditState,
          propType: payload.propType,
          lenderType: payload.lenderType,
        },
        entryMatchResult: {
          bidCapacity: payload.result.bidCapacity,
          ltvApplied: payload.result.ltvApplied,
          dsrCapacity: payload.result.dsrCapacity,
        },
        stage: afterEntryMatchSaved(activeCase.stage),
      });
    },
    Boolean(activeCase),
    activeCase?.id,
  );

  return (
    <>
      <div className="chapter-mark">제1장 · 진입 매칭</div>
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
        <div className="banner">{ko.common.noActiveCase}</div>
      ) : null}

      <Section title="기본 정보">
        <div className="grid2">
          <div className="field">
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
          <div className="field">
            <label htmlFor="houseCount">현재 주택수</label>
            <select
              id="houseCount"
              value={houseCount}
              onChange={(e) =>
                setHouseCount(Number(e.target.value) as 0 | 1 | 2)
              }
            >
              <option value={0}>무주택</option>
              <option value={1}>1주택</option>
              <option value={2}>2주택 이상</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="creditState">
              신용 상태{' '}
              <span className="range-val">{CREDIT_MAP[creditState].label}</span>
            </label>
            <select
              id="creditState"
              value={creditState}
              onChange={(e) => setCreditState(e.target.value as CreditState)}
            >
              <option value="우수">우수</option>
              <option value="보통">보통</option>
              <option value="주의">주의</option>
            </select>
            <p className="field-hint">
              LTV·DSR 계산용 추정 금리입니다. 실제 대출조건은 제4장에서 직접
              입력합니다.
            </p>
          </div>
          <div className="field">
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
          <div className="field">
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
                setAnnualIncome(e.target.value === '' ? '' : formatComma(n));
              }}
            />
          </div>
          <div className="field">
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
        </div>
      </Section>

      <ResultPanel
        mark="계산 결과 (실시간 계산)"
        figure={fmtWon(result.bidCapacity)}
        caption="낙찰가 기준 실투자 가능액 (자기자본 + 경락대출 기준, LTV·DSR 중 더 낮은 쪽 적용)"
        rows={[
          {
            label: '적용 LTV',
            value: `${(result.ltvApplied * 100).toFixed(0)}%`,
          },
          {
            label: 'DSR 대출한도 (소득 기준)',
            value: fmtWon(result.dsrCapacity),
          },
          {
            label: '실제 적용 대출한도',
            value: (
              <>
                {fmtWon(result.loanCapacity)}{' '}
                <Badge tone={result.binding === 'LTV' ? 'mid' : 'warn'}>
                  {result.binding} 제약
                </Badge>
              </>
            ),
          },
          { label: '추천 물건 규모', value: result.sizeGuide },
          {
            label: '예상 취득세',
            value: `${fmtWon(result.taxAmount)} (${(result.taxRate * 100).toFixed(1)}%)`,
          },
          {
            label: '규제지역 여부',
            value: <Badge tone="warn">조정대상지역 확인 필요</Badge>,
          },
        ]}
      />

      <Disclaimer>
        DSR은 원리금균등분할 · 심사만기 10년 가정으로 계산한 근사치입니다. 실제
        대출기관의 심사만기·상환방식에 따라 달라질 수 있으니 참고용으로만
        활용하세요. 이 결과는 자격 요건 계산이며, 특정 지역·물건에 대한 투자
        추천이 아닙니다. 규제지역 여부·중과 세율은 실제 소재지 고시에 따라
        달라지니 최종 판단은 본인 몫입니다.
      </Disclaimer>
    </>
  );
}
