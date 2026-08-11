import { describe, expect, it } from 'vitest';
import {
  appendToConversationLog,
  buildFullConversation,
  emptyConversationLog,
  trimConversationForApi,
} from './conversationLog';

describe('appendToConversationLog', () => {
  it('첫 붙여넣기는 새 항목으로 저장', () => {
    const { log, merged } = appendToConversationLog(null, '점유자: 안녕하세요');
    expect(merged).toBe('append');
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]?.text).toBe('점유자: 안녕하세요');
  });

  it('새 메시지만 추가', () => {
    const first = appendToConversationLog(null, '점유자: 첫 메시지').log;
    const { log, merged } = appendToConversationLog(first, '점유자: 두 번째');
    expect(merged).toBe('append');
    expect(log.entries).toHaveLength(2);
    expect(buildFullConversation(log)).toContain('첫 메시지');
    expect(buildFullConversation(log)).toContain('두 번째');
  });

  it('전체 대화 재붙여넣기면 교체', () => {
    const first = appendToConversationLog(null, '점유자: A').log;
    const full = '점유자: A\n나: B\n점유자: C';
    const { log, merged } = appendToConversationLog(first, full);
    expect(merged).toBe('replace');
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]?.text).toBe(full);
  });

  it('동일 내용은 skip', () => {
    const first = appendToConversationLog(null, '같은 내용').log;
    const { merged } = appendToConversationLog(first, '같은 내용');
    expect(merged).toBe('skip');
  });
});

describe('trimConversationForApi', () => {
  it('상한 이하면 그대로', () => {
    expect(trimConversationForApi('abc', 10)).toBe('abc');
  });

  it('상한 초과 시 뒷부분 유지', () => {
    const long = 'a'.repeat(100);
    const trimmed = trimConversationForApi(long, 50);
    expect(trimmed.length).toBeLessThanOrEqual(50);
    expect(trimmed.endsWith('a'.repeat(10))).toBe(true);
  });
});

describe('emptyConversationLog', () => {
  it('빈 로그', () => {
    expect(emptyConversationLog().entries).toEqual([]);
  });
});
