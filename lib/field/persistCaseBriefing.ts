import { briefingNeedsRefetch } from '@/lib/field/briefingCache';
import { fetchFieldBriefingClient } from '@/lib/field/fetchFieldBriefingClient';
import type { FieldBriefingInput, FieldBriefingSnapshot } from '@/types/case';

export async function persistCaseBriefingWhenReady(input: {
  caseId: string;
  pending?: Promise<FieldBriefingSnapshot | undefined> | null;
  fallback?: FieldBriefingInput;
  updateCase: (id: string, patch: { fieldBriefing: FieldBriefingSnapshot }) => void;
}): Promise<void> {
  try {
    let briefing = input.pending
      ? await input.pending.catch(() => undefined)
      : undefined;
    if (!briefing && input.fallback?.address?.trim()) {
      briefing = await fetchFieldBriefingClient(input.fallback);
    }
    if (!briefing || briefingNeedsRefetch(briefing)) return;
    input.updateCase(input.caseId, { fieldBriefing: briefing });
  } catch {
    /* 사건은 유지하고 연식·규모만 비워 둔다 */
  }
}
