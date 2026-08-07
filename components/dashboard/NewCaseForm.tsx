'use client';

import { useState } from 'react';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';
import { parseNumberInput, formatComma } from '@/lib/format';

type Props = {
  onClose: () => void;
};

export function NewCaseForm({ onClose }: Props) {
  const { createCase } = useCases();
  const [name, setName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [appraisal, setAppraisal] = useState('');
  const [auctionDate, setAuctionDate] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !caseNumber.trim() || !auctionDate) {
      setError('필수 항목을 모두 입력해 주세요.');
      return;
    }
    const value = parseNumberInput(appraisal);
    if (value <= 0) {
      setError('감정가를 올바르게 입력해 주세요.');
      return;
    }
    createCase({
      name: name.trim(),
      caseNumber: caseNumber.trim(),
      appraisalValue: value,
      auctionDate,
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3>{ko.caseForm.title}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="case-name">{ko.caseForm.name}</label>
            <input
              id="case-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="화성시 동탄 ○○아파트"
            />
          </div>
          <div className="field">
            <label htmlFor="case-number">{ko.caseForm.caseNumber}</label>
            <input
              id="case-number"
              type="text"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder={ko.caseForm.caseNumberPh}
            />
          </div>
          <div className="field">
            <label htmlFor="case-appraisal">{ko.caseForm.appraisal}</label>
            <input
              id="case-appraisal"
              type="text"
              value={appraisal}
              onChange={(e) => {
                const n = parseNumberInput(e.target.value);
                setAppraisal(e.target.value === '' ? '' : formatComma(n));
              }}
              placeholder="667,000,000"
            />
          </div>
          <div className="field">
            <label htmlFor="case-date">{ko.caseForm.auctionDate}</label>
            <input
              id="case-date"
              type="date"
              value={auctionDate}
              onChange={(e) => setAuctionDate(e.target.value)}
            />
          </div>
          {error ? (
            <p className="notice-inline" style={{ color: 'var(--seal)' }}>
              {error}
            </p>
          ) : null}
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">
              {ko.caseForm.submit}
            </button>
            <button type="button" className="btn-text" onClick={onClose}>
              {ko.caseForm.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
