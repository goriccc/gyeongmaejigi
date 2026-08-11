'use client';

import { useMemo } from 'react';
import { ko } from '@/messages/ko';
import { formatComma } from '@/lib/format';
import { parseTakyungCaseNumber } from '@/lib/auction/caseNumberFormat';
import { resolveBidDeposit } from '@/lib/auction/bidDeposit';
import { formatAuctionRoundLabel } from '@/lib/auction/auctionRound';
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
              </div>
            </div>
          </div>

          <div className="field">
            <label>{ko.caseForm.address}</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className="case-readonly"
              value={address}
            />
          </div>

          <div className="case-form-grid">
            <div className="case-form-row">
              <div className="field">
                <label>{ko.caseForm.appraisal}</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="case-readonly"
                  value={
                    caseFile.appraisalValue > 0
                      ? formatComma(caseFile.appraisalValue)
                      : '—'
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
                  value={formatAuctionRoundLabel(caseFile.auctionRound)}
                />
              </div>
            </div>
            <div className="case-form-row">
              <div className="field">
                <label>{ko.caseForm.minimumSalePrice}</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="case-readonly"
                  value={
                    caseFile.minimumSalePrice
                      ? formatComma(caseFile.minimumSalePrice)
                      : '—'
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
                    bidDeposit.rate === 20
                      ? 'case-readonly bid-deposit-input-high'
                      : 'case-readonly'
                  }
                  value={
                    bidDeposit.amount > 0
                      ? `${formatComma(bidDeposit.amount)} (${bidDeposit.rate}%)`
                      : '—'
                  }
                />
              </div>
            </div>
            <div className="case-form-row case-form-row-date">
              <div className="field">
                <label>{ko.caseForm.auctionDate}</label>
                <input
                  type="date"
                  readOnly
                  tabIndex={-1}
                  className="case-readonly"
                  value={caseFile.auctionDate}
                />
              </div>
            </div>
          </div>

          <p className="field-hint">{ko.caseForm.lookupHint}</p>
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
