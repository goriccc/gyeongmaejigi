'use client';

import { ko } from '@/messages/ko';
import { formatAuctionRoundLabel } from '@/lib/auction/auctionRound';
import {
  formatBuildYearLabel,
  formatScaleLabel,
} from '@/lib/field/briefingLabels';
import { formatExclusiveAreaM2 } from '@/lib/format';
import { BounceDots } from '@/components/ui/BounceDots';

export type BiddingCaseDetailsValues = {
  address: string;
  exclusiveAreaM2?: number;
  buildYear?: number | null;
  useAprDay?: string | null;
  householdCount?: number;
  buildingCount?: number;
  factsLoading?: boolean;
  appraisalDisplay: string;
  auctionRound?: number;
  minSalePriceDisplay: string;
  bidDepositDisplay: string;
  bidDepositHigh?: boolean;
  auctionDate: string;
};

type Props = {
  values: BiddingCaseDetailsValues;
  readOnly: boolean;
  onAddressChange?: (value: string) => void;
  onAddressBlur?: () => void;
  onAppraisalChange?: (value: string) => void;
  onMinSalePriceChange?: (value: string) => void;
  onAuctionDateChange?: (value: string) => void;
};

function ReadonlyFact({
  label,
  loading,
  value,
  missing,
}: {
  label: string;
  loading?: boolean;
  value: string | null | undefined;
  missing: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {loading ? (
        <div className="case-readonly case-fact-loading">
          <BounceDots />
        </div>
      ) : (
        <input
          type="text"
          readOnly
          tabIndex={-1}
          className="case-readonly"
          value={value || missing}
        />
      )}
    </div>
  );
}

export function BiddingCaseDetailsFields({
  values,
  readOnly,
  onAddressChange,
  onAddressBlur,
  onAppraisalChange,
  onMinSalePriceChange,
  onAuctionDateChange,
}: Props) {
  const scaleLabel = formatScaleLabel(
    values.householdCount,
    values.buildingCount,
  );
  const yearLabel =
    values.buildYear && values.buildYear > 0
      ? formatBuildYearLabel(values.buildYear, values.useAprDay)
      : null;

  return (
    <>
      <div className="field">
        <label htmlFor={readOnly ? undefined : 'case-address'}>
          {ko.caseForm.address}
        </label>
        <input
          id={readOnly ? undefined : 'case-address'}
          type="text"
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          className={readOnly ? 'case-readonly' : undefined}
          value={values.address}
          onChange={
            readOnly || !onAddressChange
              ? undefined
              : (e) => onAddressChange(e.target.value)
          }
          onBlur={readOnly ? undefined : onAddressBlur}
        />
      </div>

      <div className="case-form-grid">
        <div className="case-form-row case-form-row-facts">
          <div className="field">
            <label htmlFor={readOnly ? undefined : 'case-exclusive-area'}>
              {ko.caseForm.exclusiveArea}
            </label>
            <input
              id={readOnly ? undefined : 'case-exclusive-area'}
              type="text"
              readOnly
              tabIndex={-1}
              className="case-readonly"
              value={
                values.exclusiveAreaM2 != null && values.exclusiveAreaM2 > 0
                  ? formatExclusiveAreaM2(values.exclusiveAreaM2)
                  : ko.caseForm.exclusiveAreaMissing
              }
            />
          </div>
          <ReadonlyFact
            label={ko.caseForm.buildYear}
            loading={values.factsLoading}
            value={yearLabel}
            missing={ko.caseForm.buildYearMissing}
          />
          <ReadonlyFact
            label={ko.caseForm.complexScale}
            loading={values.factsLoading}
            value={scaleLabel}
            missing={ko.caseForm.complexScaleMissing}
          />
        </div>
        <div className="case-form-row">
          <div className="field">
            <label htmlFor={readOnly ? undefined : 'case-appraisal'}>
              {ko.caseForm.appraisal}
            </label>
            <input
              id={readOnly ? undefined : 'case-appraisal'}
              type="text"
              readOnly={readOnly}
              tabIndex={readOnly ? -1 : undefined}
              className={readOnly ? 'case-readonly' : undefined}
              value={values.appraisalDisplay}
              onChange={
                readOnly || !onAppraisalChange
                  ? undefined
                  : (e) => onAppraisalChange(e.target.value)
              }
            />
          </div>
          <div className="field">
            <label>{ko.caseForm.auctionRound}</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className="case-readonly"
              value={formatAuctionRoundLabel(values.auctionRound)}
            />
          </div>
        </div>
        <div className="case-form-row">
          <div className="field">
            <label htmlFor={readOnly ? undefined : 'case-min-price'}>
              {ko.caseForm.minimumSalePrice}
            </label>
            <input
              id={readOnly ? undefined : 'case-min-price'}
              type="text"
              readOnly={readOnly}
              tabIndex={readOnly ? -1 : undefined}
              className={readOnly ? 'case-readonly' : undefined}
              value={values.minSalePriceDisplay}
              onChange={
                readOnly || !onMinSalePriceChange
                  ? undefined
                  : (e) => onMinSalePriceChange(e.target.value)
              }
            />
          </div>
          <div className="field">
            <label>{ko.caseForm.bidDeposit}</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className={
                values.bidDepositHigh
                  ? 'case-readonly bid-deposit-input-high'
                  : 'case-readonly'
              }
              value={values.bidDepositDisplay}
            />
          </div>
        </div>
        <div className="case-form-row case-form-row-date">
          <div className="field">
            <label htmlFor={readOnly ? undefined : 'case-date'}>
              {ko.caseForm.auctionDate}
            </label>
            <input
              id={readOnly ? undefined : 'case-date'}
              type="date"
              readOnly={readOnly}
              tabIndex={readOnly ? -1 : undefined}
              className={readOnly ? 'case-readonly' : undefined}
              value={values.auctionDate}
              onChange={
                readOnly || !onAuctionDateChange
                  ? undefined
                  : (e) => onAuctionDateChange(e.target.value)
              }
            />
          </div>
        </div>
      </div>
      <p className="field-hint">{ko.caseForm.lookupHint}</p>
    </>
  );
}
