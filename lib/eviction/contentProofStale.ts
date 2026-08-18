import type {
  ContentProofCompare,
  EvictionCoachCompare,
  EvictionConversationLog,
} from '@/types/case';

function parseTime(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** 명도 코칭·대화 기록이 갱신된 뒤 저장된 내용증명 초안인지 */
export function isContentProofStale(
  proof: ContentProofCompare | undefined,
  coach: EvictionCoachCompare | null | undefined,
  log: EvictionConversationLog | null | undefined,
): boolean {
  if (!proof) return false;

  const proofAt = parseTime(proof.analyzedAt);
  if (proofAt == null) return true;

  const coachAt = parseTime(coach?.analyzedAt);
  if (coachAt != null && coachAt > proofAt) return true;

  const logAt = parseTime(log?.updatedAt);
  if (logAt != null && logAt > proofAt) return true;

  return false;
}
