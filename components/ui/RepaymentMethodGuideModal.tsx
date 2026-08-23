'use client';

import { useEffect, useId, useMemo } from 'react';
import type { DsrRepaymentMethod } from '@/lib/calc/entryMatch';
import {
  repaymentChartSeries,
  repaymentCompareSnapshot,
} from '@/lib/calc/repaymentCompare';

type Props = {
  open: boolean;
  onClose: () => void;
  selectedMethod?: DsrRepaymentMethod;
};

const DEMO_PRINCIPAL = 100_000_000;
const DEMO_RATE = 0.05;
const DEMO_YEARS = 10;

function fmtMan(won: number): string {
  const man = Math.round(won / 10_000);
  return `${man.toLocaleString('ko-KR')}만 원`;
}

function RepaymentChart() {
  const months = DEMO_YEARS * 12;
  const { principalLine, paymentLine } = useMemo(
    () => repaymentChartSeries(DEMO_PRINCIPAL, DEMO_RATE, months),
    [],
  );

  const width = 360;
  const height = 168;
  const pad = { top: 12, right: 12, bottom: 28, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allValues = [...principalLine, ...paymentLine];
  const yMin = Math.floor(Math.min(...allValues) / 10_000 / 5) * 5 * 10_000;
  const yMax = Math.ceil(Math.max(...allValues) / 10_000 / 5) * 5 * 10_000;
  const ySpan = yMax - yMin || 1;

  const xAt = (i: number) =>
    pad.left + (i / (principalLine.length - 1)) * plotW;
  const yAt = (v: number) =>
    pad.top + plotH - ((v - yMin) / ySpan) * plotH;

  const principalPath = principalLine
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(' ');
  const paymentPath = paymentLine
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(' ');

  const yTicks = [yMax, (yMax + yMin) / 2, yMin];

  return (
    <figure className="repay-guide-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="원금균등은 시간이 지날수록 월 상환액이 줄고, 원리금균등은 일정한 선을 유지하는 그래프"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={yAt(tick)}
              x2={width - pad.right}
              y2={yAt(tick)}
              className="repay-guide-grid"
            />
            <text
              x={pad.left - 6}
              y={yAt(tick) + 4}
              textAnchor="end"
              className="repay-guide-axis"
            >
              {Math.round(tick / 10_000)}
            </text>
          </g>
        ))}
        <text
          x={pad.left + plotW / 2}
          y={height - 6}
          textAnchor="middle"
          className="repay-guide-axis"
        >
          1회차 → {months}회차
        </text>
        <path d={paymentPath} className="repay-guide-line repay-guide-line-payment" />
        <path
          d={principalPath}
          className="repay-guide-line repay-guide-line-principal"
        />
      </svg>
      <figcaption className="repay-guide-chart-legend">
        <span className="repay-guide-legend-item">
          <i className="repay-guide-swatch repay-guide-swatch-principal" />
          원금균등
        </span>
        <span className="repay-guide-legend-item">
          <i className="repay-guide-swatch repay-guide-swatch-payment" />
          원리금균등
        </span>
      </figcaption>
    </figure>
  );
}

export function RepaymentMethodGuideModal({
  open,
  onClose,
  selectedMethod = 'equalPrincipal',
}: Props) {
  const titleId = useId();

  const snap = useMemo(
    () => repaymentCompareSnapshot(DEMO_PRINCIPAL, DEMO_RATE, DEMO_YEARS),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const interestDiff = snap.totalInterestPayment - snap.totalInterestPrincipal;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="modal modal-wide repay-guide-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="repay-guide-head">
          <div>
            <h3 id={titleId}>원금균등 vs 원리금균등</h3>
            <p className="repay-guide-lead">
              DSR 한도는 선택한 방식의 <strong>월 상환액</strong>으로
              역산합니다. 같은 소득·금리라도 방식에 따라 입찰 상한이 달라집니다.
            </p>
          </div>
          <button
            type="button"
            className="repay-guide-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <p className="repay-guide-demo-note">
          아래 표·그래프는 이해를 돕기 위한 예시입니다. (1억 · 연 5% · 10년)
        </p>

        <div className="repay-guide-table-wrap">
          <table className="repay-guide-table">
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">원금균등</th>
                <th scope="col">원리금균등</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">1회차 상환액</th>
                <td>{fmtMan(snap.firstMonthPrincipal)}</td>
                <td>{fmtMan(snap.monthlyPayment)}</td>
              </tr>
              <tr>
                <th scope="row">{DEMO_YEARS / 2}년차(중간)</th>
                <td>{fmtMan(snap.midMonthPrincipal)}</td>
                <td>{fmtMan(snap.monthlyPayment)}</td>
              </tr>
              <tr>
                <th scope="row">마지막 회차</th>
                <td>{fmtMan(snap.lastMonthPrincipal)}</td>
                <td>{fmtMan(snap.monthlyPayment)}</td>
              </tr>
              <tr className="repay-guide-table-accent">
                <th scope="row">총 이자</th>
                <td>{fmtMan(snap.totalInterestPrincipal)}</td>
                <td>{fmtMan(snap.totalInterestPayment)}</td>
              </tr>
              <tr>
                <th scope="row">총 상환액</th>
                <td>{fmtMan(snap.totalRepayPrincipal)}</td>
                <td>{fmtMan(snap.totalRepayPayment)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="repay-guide-diff">
          총 이자 차이{' '}
          <strong>{fmtMan(interestDiff)}</strong>
          <span className="repay-guide-diff-sub">
            (원리금균등이 더 많음)
          </span>
        </p>

        <RepaymentChart />

        <div className="repay-guide-cards">
          <div
            className={`repay-guide-card${
              selectedMethod === 'equalPrincipal'
                ? ' repay-guide-card-active'
                : ''
            }`}
          >
            <div className="repay-guide-card-title">원금균등</div>
            <p>
              매달 같은 원금 + 줄어드는 이자.{' '}
              <strong>초반 부담은 크지만</strong> 갈수록 가벼워지고 총 이자가
              적습니다.
            </p>
            <p className="repay-guide-card-foot">
              DSR 심사: <strong>1회차(최대) 월상환</strong> 기준 → 한도가 더
              보수적. 경매지기 기본값.
            </p>
          </div>
          <div
            className={`repay-guide-card${
              selectedMethod === 'equalPayment'
                ? ' repay-guide-card-active'
                : ''
            }`}
          >
            <div className="repay-guide-card-title">원리금균등</div>
            <p>
              매달 같은 금액.{' '}
              <strong>자금 계획은 쉽지만</strong> 총 이자는 더 많습니다.
            </p>
            <p className="repay-guide-card-foot">
              DSR 심사: <strong>고정 월상환</strong> 기준 → 같은 조건에서 한도가
              더 높게 나올 수 있음 (은행·2금융 일부).
            </p>
          </div>
        </div>

        <p className="repay-guide-footnote">
          이 화면의 입찰 상한은 DSR 산정금리·30년 만기 기준입니다. 실제 대출
          조건은 중개사·은행 확인이 필요합니다.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
