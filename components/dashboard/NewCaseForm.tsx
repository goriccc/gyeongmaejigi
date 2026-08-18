'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';
import { parseNumberInput, formatComma } from '@/lib/format';
import { readJsonSafe } from '@/lib/http/readJsonSafe';
import {
  buildTakyungCaseNumber,
  formatYmd,
  parseTakyungCaseNumber,
} from '@/lib/auction/caseNumberFormat';
import {
  resolveBidDeposit,
  type BidDepositRate,
} from '@/lib/auction/bidDeposit';
import { briefingNeedsRefetch } from '@/lib/field/briefingCache';
import { fetchFieldBriefingClient } from '@/lib/field/fetchFieldBriefingClient';
import { BiddingCaseDetailsFields } from '@/components/dashboard/BiddingCaseDetailsFields';
import type { FieldBriefingSnapshot } from '@/types/case';

type CourtOption = { code: string; label: string };

type LookupResult = {
  found: boolean;
  caseNumber?: string;
  courtCode?: string;
  courtName?: string;
  address?: string;
  appraisalValue?: number;
  auctionDate?: string;
  auctionRound?: number;
  minimumSalePrice?: number;
  bidDepositAmount?: number;
  bidDepositRate?: BidDepositRate;
  exclusiveAreaM2?: number;
  latitude?: number;
  longitude?: number;
  propertyNumber?: number;
  error?: string;
};

type Props = {
  onClose: () => void;
};

export function NewCaseForm({ onClose }: Props) {
  const { createCase } = useCases();
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [courtsError, setCourtsError] = useState('');
  const [courtCode, setCourtCode] = useState('');
  const [caseYear, setCaseYear] = useState('');
  const [caseSerial, setCaseSerial] = useState('');
  const [propertyNumber, setPropertyNumber] = useState('1');
  const [address, setAddress] = useState('');
  const [appraisal, setAppraisal] = useState('');
  const [minSalePrice, setMinSalePrice] = useState('');
  const [minimumSalePrice, setMinimumSalePrice] = useState<number | undefined>();
  const [auctionRound, setAuctionRound] = useState<number | undefined>();
  const [bidDepositRate, setBidDepositRate] = useState<BidDepositRate>(10);
  const [auctionDate, setAuctionDate] = useState('');
  const [exclusiveAreaM2, setExclusiveAreaM2] = useState<number | undefined>();
  const [fieldBriefing, setFieldBriefing] = useState<FieldBriefingSnapshot | undefined>();
  const [factsLoading, setFactsLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  const [error, setError] = useState('');
  const serialRef = useRef<HTMLInputElement>(null);
  const propertyRef = useRef<HTMLInputElement>(null);
  const factsAbortRef = useRef<AbortController | null>(null);

  const fullCaseNumber = useMemo(
    () => buildTakyungCaseNumber(caseYear, caseSerial),
    [caseYear, caseSerial],
  );

  const courtName = useMemo(
    () => courts.find((c) => c.code === courtCode)?.label ?? '',
    [courts, courtCode],
  );

  const bidDeposit = useMemo(() => {
    const appraisalValue = parseNumberInput(appraisal);
    return resolveBidDeposit({
      appraisalValue,
      minimumSalePrice,
      depositRate: bidDepositRate,
    });
  }, [appraisal, minimumSalePrice, bidDepositRate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auction/courts');
        const data = await readJsonSafe<{ items?: CourtOption[]; error?: string }>(
          res,
        );
        if (!res.ok) {
          throw new Error(data.error || '법원 목록을 불러오지 못했습니다.');
        }
        if (!cancelled) {
          setCourts(data.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setCourtsError(
            err instanceof Error ? err.message : '법원 목록을 불러오지 못했습니다.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      factsAbortRef.current?.abort();
    };
  }, []);

  function applyParsedCaseNumber(value: string) {
    const parsed = parseTakyungCaseNumber(value);
    if (parsed) {
      setCaseYear(parsed.year);
      setCaseSerial(parsed.serial);
    }
  }

  const parsedPropertyNumber = useMemo(() => {
    const n = parseInt(propertyNumber, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [propertyNumber]);

  function resetLookupFields() {
    factsAbortRef.current?.abort();
    setLookedUp(false);
    setExclusiveAreaM2(undefined);
    setFieldBriefing(undefined);
    setFactsLoading(false);
  }

  async function loadPropertyFacts(nextAddress: string, nextArea?: number) {
    factsAbortRef.current?.abort();
    const trimmed = nextAddress.trim();
    if (!trimmed) {
      setFieldBriefing(undefined);
      setFactsLoading(false);
      return;
    }
    const ac = new AbortController();
    factsAbortRef.current = ac;
    setFactsLoading(true);
    try {
      const briefing = await fetchFieldBriefingClient(
        {
          address: trimmed,
          name: trimmed,
          exclusiveAreaM2: nextArea,
        },
        ac.signal,
      );
      if (ac.signal.aborted) return;
      setFieldBriefing(
        briefingNeedsRefetch(briefing) ? undefined : briefing,
      );
    } catch {
      if (ac.signal.aborted) return;
      setFieldBriefing(undefined);
    } finally {
      if (!ac.signal.aborted) setFactsLoading(false);
    }
  }

  async function lookupCase() {
    setError('');
    if (!courtCode) {
      setError('법원을 선택해 주세요.');
      return;
    }
    if (!caseYear.trim()) {
      setError('사건 연도를 입력해 주세요.');
      return;
    }
    if (!caseSerial.trim()) {
      setError('사건번호(일련번호)를 입력해 주세요.');
      return;
    }
    if (!fullCaseNumber) {
      setError('연도와 일련번호를 올바르게 입력해 주세요.');
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch('/api/auction/case', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courtCode,
          caseNumber: fullCaseNumber,
          courtName,
          propertyNumber: parsedPropertyNumber,
        }),
      });
      const data = await readJsonSafe<LookupResult>(res);
      if (!res.ok || !data.found) {
        throw new Error(data.error || '사건 정보를 불러오지 못했습니다.');
      }

      setAddress(data.address ?? '');
      applyParsedCaseNumber(data.caseNumber?.trim() || fullCaseNumber);
      setAppraisal(
        data.appraisalValue ? formatComma(data.appraisalValue) : '',
      );
      setMinimumSalePrice(data.minimumSalePrice);
      setMinSalePrice(
        data.minimumSalePrice ? formatComma(data.minimumSalePrice) : '',
      );
      setAuctionRound(data.auctionRound);
      setBidDepositRate(data.bidDepositRate ?? 10);
      setAuctionDate(formatYmd(data.auctionDate) ?? data.auctionDate ?? '');
      setExclusiveAreaM2(data.exclusiveAreaM2);
      setLatitude(data.latitude);
      setLongitude(data.longitude);
      if (data.propertyNumber != null && data.propertyNumber >= 1) {
        setPropertyNumber(String(data.propertyNumber));
      }
      setLookedUp(true);
      void loadPropertyFacts(data.address ?? '', data.exclusiveAreaM2);

      if (!data.appraisalValue || !data.auctionDate) {
        setError(
          '소재지는 불러왔으나 감정가·매각기일이 비어 있습니다. 직접 입력해 주세요.',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '사건 정보를 불러오지 못했습니다.',
      );
    } finally {
      setLookupLoading(false);
    }
  }

  function handleCaseYearKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      serialRef.current?.focus();
    }
  }

  function handleCaseSerialKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      propertyRef.current?.focus();
    }
  }

  function handleCasePropertyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void lookupCase();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courtCode || !fullCaseNumber) {
      setError('법원과 사건번호를 입력한 뒤 정보 불러오기를 실행해 주세요.');
      return;
    }
    if (!lookedUp || !address.trim()) {
      setError('먼저 경매 정보 불러오기를 완료해 주세요.');
      return;
    }
    if (!auctionDate) {
      setError('매각기일을 입력해 주세요.');
      return;
    }
    const value = parseNumberInput(appraisal);
    if (value <= 0) {
      setError('감정가를 올바르게 입력해 주세요.');
      return;
    }
    const minPrice = parseNumberInput(minSalePrice);

    createCase({
      name: address.trim(),
      track: 'bidding',
      courtCode,
      courtName,
      caseNumber: fullCaseNumber,
      propertyNumber: parsedPropertyNumber,
      address: address.trim() || undefined,
      latitude,
      longitude,
      appraisalValue: value,
      auctionDate,
      auctionRound,
      minimumSalePrice: minPrice > 0 ? minPrice : minimumSalePrice,
      bidDepositRate: bidDeposit.rate,
      bidDepositAmount: bidDeposit.amount,
      exclusiveAreaM2,
      fieldBriefing:
        fieldBriefing && !briefingNeedsRefetch(fieldBriefing)
          ? fieldBriefing
          : undefined,
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-wide">
        <h3>{ko.caseForm.title}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="case-court">{ko.caseForm.court}</label>
            <select
              id="case-court"
              value={courtCode}
              onChange={(e) => {
                setCourtCode(e.target.value);
                resetLookupFields();
              }}
            >
              <option value="">{ko.caseForm.courtPh}</option>
              {courts.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            {courtsError ? (
              <p className="field-hint" style={{ color: 'var(--seal)' }}>
                {courtsError}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="case-year">{ko.caseForm.caseNumber}</label>
            <div className="case-number-row">
              <div className="case-number-fields">
                <input
                  id="case-year"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  className="case-number-year"
                  value={caseYear}
                  onChange={(e) => {
                    setCaseYear(e.target.value.replace(/\D/g, '').slice(0, 4));
                    resetLookupFields();
                  }}
                  onKeyDown={handleCaseYearKeyDown}
                  aria-label={ko.caseForm.caseYear}
                />
                <span className="case-number-type" aria-hidden>
                  {ko.caseForm.caseType}
                </span>
                <input
                  ref={serialRef}
                  id="case-serial"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="case-number-serial"
                  value={caseSerial}
                  onChange={(e) => {
                    setCaseSerial(e.target.value.replace(/\D/g, '').slice(0, 6));
                    resetLookupFields();
                  }}
                  onKeyDown={handleCaseSerialKeyDown}
                  aria-label={ko.caseForm.caseSerial}
                />
                <span className="case-number-type case-number-label" aria-hidden>
                  {ko.caseForm.propertyNumber}
                </span>
                <input
                  ref={propertyRef}
                  id="case-property"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  className="case-number-property"
                  value={propertyNumber}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setPropertyNumber(raw);
                    resetLookupFields();
                  }}
                  onKeyDown={handleCasePropertyKeyDown}
                  aria-label={ko.caseForm.propertyNumber}
                />
              </div>
              <button
                type="button"
                id="case-lookup"
                className="btn btn-outline case-lookup-btn"
                onClick={() => void lookupCase()}
                disabled={lookupLoading}
              >
                {lookupLoading ? ko.caseForm.lookupLoading : ko.caseForm.lookup}
              </button>
            </div>
          </div>

          {lookedUp ? (
            <BiddingCaseDetailsFields
              readOnly={false}
              values={{
                address,
                exclusiveAreaM2,
                buildYear: fieldBriefing?.buildYear,
                householdCount: fieldBriefing?.householdCount,
                buildingCount: fieldBriefing?.buildingCount,
                factsLoading,
                appraisalDisplay: appraisal,
                auctionRound,
                minSalePriceDisplay: minSalePrice,
                bidDepositDisplay:
                  bidDeposit.amount > 0
                    ? `${formatComma(bidDeposit.amount)} (${bidDeposit.rate}%)`
                    : '—',
                bidDepositHigh: bidDeposit.rate === 20,
                auctionDate,
              }}
              onAddressChange={setAddress}
              onAppraisalChange={(value) => {
                const n = parseNumberInput(value);
                setAppraisal(value === '' ? '' : formatComma(n));
              }}
              onMinSalePriceChange={(value) => {
                const n = parseNumberInput(value);
                setMinSalePrice(value === '' ? '' : formatComma(n));
                setMinimumSalePrice(n > 0 ? n : undefined);
              }}
              onAuctionDateChange={setAuctionDate}
            />
          ) : (
            <p className="field-hint">{ko.caseForm.lookupLead}</p>
          )}

          {error ? (
            <p className="notice-inline" style={{ color: 'var(--seal)' }}>
              {error}
            </p>
          ) : null}

          <div className="modal-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!lookedUp || lookupLoading}
            >
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
