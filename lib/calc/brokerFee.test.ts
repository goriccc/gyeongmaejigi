import { describe, expect, it } from 'vitest';
import {
  brokerFeeNote,
  brokerFeeRate,
  calcBrokerFee,
} from './brokerFee';

describe('calcBrokerFee (전국 주택 매매 상한)', () => {
  it('2억~9억 구간 0.4%', () => {
    const r = calcBrokerFee(580_000_000);
    expect(r.rate).toBe(0.004);
    expect(r.amount).toBe(2_320_000);
    expect(r.capApplied).toBe(false);
  });

  it('5천만~2억 구간 0.5%', () => {
    const r = calcBrokerFee(100_000_000);
    expect(r.rate).toBe(0.005);
    expect(r.amount).toBe(500_000);
  });

  it('5천만~2억 구간 한도 80만원', () => {
    const r = calcBrokerFee(180_000_000);
    expect(r.amount).toBe(800_000);
    expect(r.capApplied).toBe(true);
  });

  it('5천만 미만 한도 25만원', () => {
    const r = calcBrokerFee(40_000_000);
    expect(r.rate).toBe(0.006);
    expect(r.amount).toBe(240_000);
    expect(r.capApplied).toBe(false);
  });

  it('9억~12억 구간 0.5%', () => {
    expect(brokerFeeRate(1_000_000_000)).toBe(0.005);
    expect(calcBrokerFee(1_000_000_000).amount).toBe(5_000_000);
  });

  it('15억 이상 0.7%', () => {
    expect(brokerFeeRate(2_000_000_000)).toBe(0.007);
    expect(calcBrokerFee(2_000_000_000).amount).toBe(14_000_000);
  });

  it('note에 구간·한도·조례 표시', () => {
    const r = calcBrokerFee(180_000_000, {
      regionId: 'seoul',
    });
    expect(brokerFeeNote(r)).toContain('한도');
    expect(brokerFeeNote(r)).toContain('VAT');
    expect(brokerFeeNote(r)).toContain('서울특별시');
  });

  it('전북 조례명 표시', () => {
    const r = calcBrokerFee(580_000_000, { regionId: 'jeonbuk' });
    expect(brokerFeeNote(r)).toContain('전북');
    expect(brokerFeeNote(r)).toContain('전북특별자치도');
    expect(r.amount).toBe(2_320_000);
  });
});
