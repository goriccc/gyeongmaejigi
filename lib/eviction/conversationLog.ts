import type {
  EvictionConversationEntry,
  EvictionConversationLog,
} from '@/types/case';

export const EVICTION_CONVERSATION_API_MAX = 40_000;

export function createConversationEntry(
  text: string,
): EvictionConversationEntry {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    text: text.trim(),
    addedAt: new Date().toISOString(),
  };
}

export function emptyConversationLog(): EvictionConversationLog {
  return { entries: [], updatedAt: new Date().toISOString() };
}

export function formatConversationEntryLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}`;
}

export function buildFullConversation(
  log: EvictionConversationLog | null | undefined,
): string {
  if (!log?.entries.length) return '';
  return log.entries
    .map((entry) => {
      const label = formatConversationEntryLabel(entry.addedAt);
      return `─── [${label} 추가] ───\n${entry.text}`;
    })
    .join('\n\n');
}

export type AppendConversationResult = {
  log: EvictionConversationLog;
  merged: 'append' | 'replace' | 'skip';
};

function entriesPlainText(log: EvictionConversationLog): string {
  return log.entries.map((entry) => entry.text).join('\n\n');
}

/** 새 붙여넣기를 로그에 반영. 전체 대화 재붙여넣기면 한 덩어리로 교체 */
export function appendToConversationLog(
  log: EvictionConversationLog | null | undefined,
  newText: string,
): AppendConversationResult {
  const trimmed = newText.trim();
  const base = log?.entries.length ? log : emptyConversationLog();
  if (!trimmed) {
    return { log: base, merged: 'skip' };
  }

  const plainExisting = entriesPlainText(base).trim();
  if (!plainExisting) {
    return {
      log: {
        entries: [createConversationEntry(trimmed)],
        updatedAt: new Date().toISOString(),
      },
      merged: 'append',
    };
  }

  if (plainExisting === trimmed) {
    return { log: base, merged: 'skip' };
  }

  const last = base.entries[base.entries.length - 1];
  if (last?.text.trim() === trimmed) {
    return { log: base, merged: 'skip' };
  }

  if (trimmed.includes(plainExisting)) {
    return {
      log: {
        entries: [createConversationEntry(trimmed)],
        updatedAt: new Date().toISOString(),
      },
      merged: 'replace',
    };
  }

  if (plainExisting.includes(trimmed)) {
    return { log: base, merged: 'skip' };
  }

  const lastText = last?.text.trim() ?? '';
  if (lastText && trimmed.startsWith(lastText) && trimmed.length > lastText.length) {
    return {
      log: {
        entries: [createConversationEntry(trimmed)],
        updatedAt: new Date().toISOString(),
      },
      merged: 'replace',
    };
  }

  return {
    log: {
      entries: [...base.entries, createConversationEntry(trimmed)],
      updatedAt: new Date().toISOString(),
    },
    merged: 'append',
  };
}

export function trimConversationForApi(
  text: string,
  max = EVICTION_CONVERSATION_API_MAX,
): string {
  if (text.length <= max) return text;
  const omitted = text.length - max + 220;
  const notice = `[앞부분 약 ${omitted.toLocaleString('ko-KR')}자 생략 — 최근 대화 위주로 분석]\n\n`;
  return notice + text.slice(-(max - notice.length));
}

export function conversationStats(
  log: EvictionConversationLog | null | undefined,
) {
  const full = buildFullConversation(log);
  return {
    entryCount: log?.entries.length ?? 0,
    charCount: full.length,
    updatedAt: log?.updatedAt ?? null,
  };
}
