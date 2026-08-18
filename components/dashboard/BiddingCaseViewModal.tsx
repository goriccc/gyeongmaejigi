'use client';

import { useMemo } from 'react';
import { ko } from '@/messages/ko';
import { formatComma } from '@/lib/format';
import { parseTakyungCaseNumber } from '@/lib/auction/caseNumberFormat';
import { resolveBidDeposit } from '@/lib/auction/bidDeposit';
import { BiddingCaseDetailsFields } from '@/components/dashboard/BiddingCaseDetailsFields';
import type { CaseFile } from '@/types/case';

type Props = {
  caseFile: CaseFile;
  onClose: () => void;
};

export function BiddingCaseViewModal({ caseFile, onClose }: Props) {
  const parsedCase = useMemo(
    () => parseTakyungCaseNumber(caseFile.caseNumber),
    [caseFile.caseNumber],
  );

  const bidDeposit = useMemo(
    () =>
      resolveBidDeposit({
        appraisalValue: caseFile.appraisalValue,
        minimumSalePrice: caseFile.minimumSalePrice,
        depositRate: caseFile.bidDepositRate ?? 10,
      }),
    [caseFile.appraisalValue, caseFile.minimumSalePrice, caseFile.bidDepositRate],
  );

  const address = caseFile.address?.trim() || caseFile.name.trim();
  const courtLabel = caseFile.courtName?.trim() || caseFile.courtCode || '—';
  const briefing = caseFile.fieldBriefing;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-wide case-view-modal">
        <h3>{ko.caseView.title}</h3>
        <div className="case-view-body">
          <div className="field">
            <label>{ko.caseForm.court}</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className="case-readonly"
              value={courtLabel}
            />
          </div>

          <div className="field">
            <label>{ko.caseForm.caseNumber}</label>
            <div className="case-number-row case-number-row-view">
              <div className="case-number-fields">
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="case-number-year case-readonly"
                  value={parsedCase?.year ?? ''}
                  aria-label={ko.caseForm.caseYear}
                />
                <span className="case-number-type" aria-hidden>
                  {ko.caseForm.caseType}
                </span>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="case-number-serial case-readonly"
                  value={parsedCase?.serial ?? caseFile.caseNumber}
                  aria-label={ko.caseForm.caseSerial}
                />
                <span className="case-number-type case-number-label" aria-hidden>
                  {ko.caseForm.propertyNumber}
                </span>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="case-number-property case-readonly"
                  value={String(caseFile.propertyNumber ?? 1)}
                  aria-label={ko.caseForm.propertyNumber}
                />
              </div>
            </div>
          </div>

          <BiddingCaseDetailsFields
            readOnly
            values={{
              address,
              exclusiveAreaM2: caseFile.exclusiveAreaM2,
              buildYear: briefing?.buildYear,
              householdCount: briefing?.householdCount,
              buildingCount: briefing?.buildingCount,
              appraisalDisplay:
                caseFile.appraisalValue > 0
                  ? formatComma(caseFile.appraisalValue)
                  : '—',
              auctionRound: caseFile.auctionRound,
              minSalePriceDisplay: caseFile.minimumSalePrice
                ? formatComma(caseFile.minimumSalePrice)
                : '—',
              bidDepositDisplay:
                bidDeposit.amount > 0
                  ? `${formatComma(bidDeposit.amount)} (${bidDeposit.rate}%)`
                  : '—',
              bidDepositHigh: bidDeposit.rate === 20,
              auctionDate: caseFile.auctionDate,
            }}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {ko.caseView.close}
          </button>
        </div>
      </div>
    </div>
  );
}
