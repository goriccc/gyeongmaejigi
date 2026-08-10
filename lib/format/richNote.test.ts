import { describe, expect, it } from 'vitest';
import {
  normalizeRichNoteMarkers,
  parseRichNote,
  richNoteHasRawMarkers,
} from './richNote';

describe('parseRichNote', () => {
  it('볼드 **핵심** 파싱', () => {
    expect(parseRichNote('앞에 **핵심문구** 뒤에')).toEqual([
      { type: 'text', value: '앞에 ' },
      { type: 'key', value: '핵심문구' },
      { type: 'text', value: ' 뒤에' },
    ]);
  });

  it('경고 !!…!! 파싱', () => {
    expect(parseRichNote('안내 !!위험!! 끝')).toEqual([
      { type: 'text', value: '안내 ' },
      { type: 'warn', value: '위험' },
      { type: 'text', value: ' 끝' },
    ]);
  });

  it('스크린샷형 인수권리 note', () => {
    const note =
      '결론은 맞습니다 — **낙찰가가 임차보증금(2억6,600만원)+집행비용 추정치를 넘으면** 인수 부담이 없습니다. !!다만 보조 판단은 성립하지 않습니다.!! !!【경고】 하한선을 지키세요.';
    const segs = parseRichNote(note);
    expect(segs.some((s) => s.type === 'key' && s.value.includes('낙찰가가'))).toBe(
      true,
    );
    expect(segs.filter((s) => s.type === 'warn')).toHaveLength(2);
    expect(richNoteHasRawMarkers(note)).toBe(false);
  });

  it('미닫힘 !! 는 끝까지 경고', () => {
    expect(parseRichNote('정상 !!경고만 있음')).toEqual([
      { type: 'text', value: '정상 ' },
      { type: 'warn', value: '경고만 있음' },
    ]);
  });

  it('【경고】 단독도 경고', () => {
    expect(parseRichNote('앞에 【경고】 주의')).toEqual([
      { type: 'text', value: '앞에 ' },
      { type: 'warn', value: '【경고】 주의' },
    ]);
  });

  it('전각 별표 정규화', () => {
    const raw = '값 ＊＊핵심＊＊ 끝';
    expect(normalizeRichNoteMarkers(raw)).toContain('**핵심**');
    expect(parseRichNote(raw)).toEqual([
      { type: 'text', value: '값 ' },
      { type: 'key', value: '핵심' },
      { type: 'text', value: ' 끝' },
    ]);
  });

  it('말소기준권리 샘플', () => {
    const note =
      '을구 말소되지 않은 권리 중 **2023.1.17. 농협캐피탈 근저당권(채권최고액 2억4,360만원)** 이 최선순위로 보입니다.';
    expect(richNoteHasRawMarkers(note)).toBe(false);
    expect(parseRichNote(note)[1]).toEqual({
      type: 'key',
      value: '2023.1.17. 농협캐피탈 근저당권(채권최고액 2억4,360만원)',
    });
  });
});
