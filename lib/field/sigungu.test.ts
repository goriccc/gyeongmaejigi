import { describe, expect, it } from 'vitest';
import { extractSigunguKey } from '@/lib/field/sigungu';

describe('extractSigunguKey', () => {
  it('시·구', () => {
    expect(extractSigunguKey('경기도 고양시 덕양구 행신동 123')).toBe(
      '고양시 덕양구',
    );
    expect(extractSigunguKey('경기도 화성시 동탄구 청계동 1')).toBe(
      '화성시 동탄구',
    );
  });

  it('광역시·구', () => {
    expect(
      extractSigunguKey('서울특별시 양천구 목동중앙남로16다길 46-10'),
    ).toBe('서울 양천구');
    expect(extractSigunguKey('인천광역시 서구 청라동 115-1')).toBe('인천 서구');
  });

  it('시만', () => {
    expect(extractSigunguKey('경기도 평택시 소사벌로 100')).toBe('평택시');
  });

  it('군', () => {
    expect(extractSigunguKey('경기도 양평군 양평읍 1')).toBe('양평군');
  });

  it('빈 주소', () => {
    expect(extractSigunguKey('')).toBe('지역미상');
  });
});
