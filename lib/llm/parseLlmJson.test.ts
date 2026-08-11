import { describe, expect, it } from 'vitest';
import {
  extractJsonText,
  parseLlmJson,
  repairLlmJson,
} from './parseLlmJson';

describe('parseLlmJson', () => {
  it('extracts fenced JSON', () => {
    const raw = '설명\n```json\n{"a":1}\n```\n끝';
    expect(extractJsonText(raw)).toBe('{"a":1}');
  });

  it('parses valid JSON', () => {
    const data = parseLlmJson<{ crisisFlag: boolean }>(
      '{"crisisFlag": false}',
    );
    expect(data.crisisFlag).toBe(false);
  });

  it('repairs unescaped newlines in strings', () => {
    const broken = `{
  "body": "첫 줄
둘째 줄"
}`;
    const data = parseLlmJson<{ body: string }>(broken);
    expect(data.body).toBe('첫 줄\n둘째 줄');
  });

  it('repairs trailing commas in arrays', () => {
    const broken = `{
  "nextActions": [
    "행동1",
    "행동2",
  ]
}`;
    const data = parseLlmJson<{ nextActions: string[] }>(broken);
    expect(data.nextActions).toEqual(['행동1', '행동2']);
  });

  it('repairs eviction-like payload with multiline replyDraft', () => {
    const broken = `{
  "crisisFlag": false,
  "crisisNote": null,
  "resistLevel": "mid",
  "situationSummary": "요약",
  "replyDrafts": [
    { "tone": "차분한 톤", "message": "안녕하세요.
협조 부탁드립니다." },
    { "tone": "단호한 톤", "message": "일정 회신 바랍니다." }
  ],
  "nextActions": [
    "이사 일정 확인",
    "문자로 재확인",
  ],
  "speakerClarity": "clear"
}`;
    const data = parseLlmJson<{
      replyDrafts: Array<{ tone: string; message: string }>;
      nextActions: string[];
    }>(broken);
    expect(data.replyDrafts[0].message).toContain('\n');
    expect(data.nextActions).toHaveLength(2);
  });

  it('repairLlmJson normalizes smart quotes', () => {
    const repaired = repairLlmJson('{"msg": \u201chello\u201d}');
    expect(JSON.parse(repaired)).toEqual({ msg: 'hello' });
  });
});
