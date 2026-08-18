'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Section } from '@/components/ui/Section';
import {
  calcBuildingVatFromStandards,
  calcLandStandardPrice,
  buildingVatRateVerdictFromAmount,
  buildingVatVerdictBadgeTone,
  buildingVatVerdictLabel,
  propertySizeLabel,
  resolvePropertySizeClass,
  type BuildingVatCalcMode,
  type PropertySizeMode,
} from '@/lib/calc/buildingVat';
import { WonExactAmt, WonExactLeadDisplay } from '@/components/bid/WonExactDisplay';
import { formatComma, parseNumberInput, pct } from '@/lib/format';
import { ko } from '@/messages/ko';

export type BuildingVatSectionState = {
  propertySizeMode: PropertySizeMode;
  exclusiveAreaM2: string;
  buildingVatCalcMode: BuildingVatCalcMode;
  buildingVatWon: string;
  landAreaM2: string;
  landUnitPricePerM2: string;
  buildingStandardPrice: string;
};

type Props = {
  sellPriceWon: number;
  caseExclusiveAreaM2?: number;
  state: BuildingVatSectionState;
  onChange: (patch: Partial<BuildingVatSectionState>) => void;
  resolvedBuildingVatWon: number;
};

function parseAreaInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseWonInput(value: string): number | undefined {
  const n = parseNumberInput(value);
  return n > 0 ? n : undefined;
}

export function buildingVatStateFromSaved(
  saved?: {
    propertySizeMode?: PropertySizeMode;
    exclusiveAreaM2?: number;
    buildingVatCalcMode?: BuildingVatCalcMode;
    buildingVatWon?: number;
    buildingVatMan?: number;
    landAreaM2?: number;
    landUnitPricePerM2?: number;
    buildingStandardPrice?: number;
  },
  caseExclusiveAreaM2?: number,
): BuildingVatSectionState {
  const area = saved?.exclusiveAreaM2 ?? caseExclusiveAreaM2;
  return {
    propertySizeMode: saved?.propertySizeMode ?? 'auto',
    exclusiveAreaM2: area != null ? String(area) : '',
    buildingVatCalcMode: saved?.buildingVatCalcMode ?? 'direct',
    buildingVatWon:
      saved?.buildingVatWon != null
        ? formatComma(saved.buildingVatWon)
        : saved?.buildingVatMan != null
          ? formatComma(saved.buildingVatMan * 10_000)
          : '',
    landAreaM2:
      saved?.landAreaM2 != null ? String(saved.landAreaM2) : '',
    landUnitPricePerM2:
      saved?.landUnitPricePerM2 != null
        ? formatComma(saved.landUnitPricePerM2)
        : '',
    buildingStandardPrice:
      saved?.buildingStandardPrice != null
        ? formatComma(saved.buildingStandardPrice)
        : '',
  };
}

export function BuildingVatSection({
  sellPriceWon,
  caseExclusiveAreaM2,
  state,
  onChange,
  resolvedBuildingVatWon,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(
    state.buildingVatCalcMode === 'standards',
  );

  const exclusiveArea = parseAreaInput(state.exclusiveAreaM2);
  const effectiveArea = exclusiveArea ?? caseExclusiveAreaM2;

  const propertySize = resolvePropertySizeClass(
    state.propertySizeMode,
    effectiveArea,
  );

  const previewFromStandards = useMemo(() => {
    if (state.buildingVatCalcMode !== 'standards' || sellPriceWon <= 0) {
      return null;
    }
    const landArea = parseAreaInput(state.landAreaM2);
    const landUnit = parseWonInput(state.landUnitPricePerM2);
    const buildingStd = parseWonInput(state.buildingStandardPrice);
    if (!landArea || !landUnit || !buildingStd) return null;
    const landStandard = calcLandStandardPrice(landArea, landUnit);
    return calcBuildingVatFromStandards({
      sellPrice: sellPriceWon,
      landStandardPrice: landStandard,
      buildingStandardPrice: buildingStd,
    });
  }, [
    state.buildingVatCalcMode,
    state.landAreaM2,
    state.landUnitPricePerM2,
    state.buildingStandardPrice,
    sellPriceWon,
  ]);

  const effectiveSell =
    propertySize === 'large'
      ? Math.max(0, sellPriceWon - resolvedBuildingVatWon)
      : sellPriceWon;

  const vatVerdict = buildingVatRateVerdictFromAmount(
    sellPriceWon,
    resolvedBuildingVatWon,
  );

  return (
    <Section
      title={ko.bidCalc.propertySizeTitle}
      note={ko.bidCalc.propertySizeNote}
    >
      <div className="property-size-mode">
        {(
          [
            ['auto', ko.bidCalc.propertySizeAuto],
            ['standard', ko.bidCalc.propertySizeStandard],
            ['large', ko.bidCalc.propertySizeLarge],
          ] as const
        ).map(([mode, label]) => (
          <label key={mode} className="property-size-option">
            <input
              type="radio"
              name="propertySizeMode"
              checked={state.propertySizeMode === mode}
              onChange={() => onChange({ propertySizeMode: mode })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="exclusiveAreaM2">{ko.bidCalc.exclusiveAreaLabel}</label>
        <input
          id="exclusiveAreaM2"
          type="text"
          inputMode="decimal"
          value={state.exclusiveAreaM2}
          placeholder={
            caseExclusiveAreaM2 != null
              ? String(caseExclusiveAreaM2)
              : '예) 84.99'
          }
          onChange={(e) =>
            onChange({
              exclusiveAreaM2: e.target.value.replace(/[^\d.,]/g, ''),
            })
          }
        />
        <p className="field-hint">{ko.bidCalc.exclusiveAreaHint}</p>
      </div>

      <div className="property-size-result">
        <Badge tone={propertySize === 'large' ? 'warn' : 'ok'}>
          {propertySizeLabel(propertySize)}
        </Badge>
        {state.propertySizeMode === 'auto' && effectiveArea != null ? (
          <span className="property-size-auto-note">
            {ko.bidCalc.propertySizeAutoApplied.replace(
              '{area}',
              String(effectiveArea),
            )}
          </span>
        ) : null}
      </div>

      {propertySize === 'large' ? (
        <div className="building-vat-panel">
          <div className="building-vat-summary">
            <div className="result-row">
              <span>{ko.bidCalc.buildingVatAmount}</span>
              <span
                className="building-vat-amount-row"
                style={{ fontFamily: 'var(--mono)' }}
              >
                {sellPriceWon > 0 ? (
                  <WonExactLeadDisplay
                    meta={pct(resolvedBuildingVatWon / sellPriceWon)}
                    amount={resolvedBuildingVatWon}
                  />
                ) : (
                  <WonExactAmt amount={resolvedBuildingVatWon} />
                )}
                {vatVerdict ? (
                  <Badge tone={buildingVatVerdictBadgeTone(vatVerdict)}>
                    {buildingVatVerdictLabel(vatVerdict)}
                  </Badge>
                ) : null}
              </span>
            </div>
            <div className="result-row">
              <span>{ko.bidCalc.effectiveSellPrice}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>
                <WonExactAmt amount={effectiveSell} />
              </span>
            </div>
          </div>

          <div className="building-vat-mode">
            <label className="property-size-option">
              <input
                type="radio"
                name="buildingVatCalcMode"
                checked={state.buildingVatCalcMode === 'direct'}
                onChange={() => {
                  onChange({ buildingVatCalcMode: 'direct' });
                  setDetailOpen(false);
                }}
              />
              <span>{ko.bidCalc.buildingVatDirect}</span>
            </label>
            <label className="property-size-option">
              <input
                type="radio"
                name="buildingVatCalcMode"
                checked={state.buildingVatCalcMode === 'standards'}
                onChange={() => {
                  onChange({ buildingVatCalcMode: 'standards' });
                  setDetailOpen(true);
                }}
              />
              <span>{ko.bidCalc.buildingVatStandards}</span>
            </label>
          </div>

          {state.buildingVatCalcMode === 'direct' ? (
            <div className="field">
              <label htmlFor="buildingVatWon">
                {ko.bidCalc.buildingVatDirectLabel}
              </label>
              <input
                id="buildingVatWon"
                type="text"
                inputMode="numeric"
                value={state.buildingVatWon}
                onChange={(e) => {
                  const n = parseNumberInput(e.target.value);
                  onChange({
                    buildingVatWon:
                      e.target.value === '' ? '' : formatComma(n),
                  });
                }}
                placeholder="17,520,000"
              />
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn-text building-vat-toggle"
                onClick={() => setDetailOpen((v) => !v)}
              >
                {detailOpen
                  ? ko.bidCalc.buildingVatDetailClose
                  : ko.bidCalc.buildingVatDetailOpen}
              </button>
              {detailOpen ? (
                <div className="building-vat-detail">
                  <div className="field">
                    <label htmlFor="landAreaM2">
                      {ko.bidCalc.landAreaLabel}
                    </label>
                    <input
                      id="landAreaM2"
                      type="text"
                      inputMode="decimal"
                      value={state.landAreaM2}
                      onChange={(e) =>
                        onChange({
                          landAreaM2: e.target.value.replace(/[^\d.,]/g, ''),
                        })
                      }
                      placeholder="61.67"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="landUnitPrice">
                      {ko.bidCalc.landUnitPriceLabel}
                    </label>
                    <input
                      id="landUnitPrice"
                      type="text"
                      value={state.landUnitPricePerM2}
                      onChange={(e) => {
                        const n = parseNumberInput(e.target.value);
                        onChange({
                          landUnitPricePerM2:
                            e.target.value === '' ? '' : formatComma(n),
                        });
                      }}
                      placeholder="4,124,000"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="buildingStandardPrice">
                      {ko.bidCalc.buildingStandardLabel}
                    </label>
                    <input
                      id="buildingStandardPrice"
                      type="text"
                      value={state.buildingStandardPrice}
                      onChange={(e) => {
                        const n = parseNumberInput(e.target.value);
                        onChange({
                          buildingStandardPrice:
                            e.target.value === '' ? '' : formatComma(n),
                        });
                      }}
                      placeholder="140,059,560"
                    />
                  </div>
                  <p className="field-hint">{ko.bidCalc.buildingVatLinks}</p>
                  {previewFromStandards ? (
                    <p className="field-hint">
                      산출 부가세 ({pct(previewFromStandards.vatRateOfSell)}){' '}
                      <WonExactAmt amount={previewFromStandards.vatAmount} />
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <p className="s-note">{ko.bidCalc.buildingVatDisclaimer}</p>
          <p className="field-hint">{ko.bidCalc.buildingVatVerdictHint}</p>
        </div>
      ) : null}
    </Section>
  );
}
