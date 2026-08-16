'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Section } from '@/components/ui/Section';
import { buildFieldChecklist } from '@/lib/field/smartChecklist';
import { useCases } from '@/lib/hooks/useCases';
import { ko } from '@/messages/ko';

function checklistSame(
  a: { id: string; checked: boolean }[],
  b: { id: string; checked: boolean }[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.id === b[i]?.id && item.checked === b[i]?.checked);
}

export function FieldChecklistSection() {
  const { activeCase, updateCase } = useCases();

  useEffect(() => {
    if (!activeCase) return;
    const merged = buildFieldChecklist(activeCase);
    if (checklistSame(merged, activeCase.checklist)) return;
    updateCase(activeCase.id, { checklist: merged });
  }, [
    activeCase,
    activeCase?.id,
    activeCase?.riskFlags,
    activeCase?.address,
    activeCase?.entryMatchInputs?.propType,
    activeCase?.auctionRound,
    activeCase?.checklist,
    updateCase,
  ]);

  const items = activeCase?.checklist ?? [];
  const done = items.filter((i) => i.checked).length;

  function toggle(id: string) {
    if (!activeCase) return;
    const next = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item,
    );
    updateCase(activeCase.id, { checklist: next });
  }

  if (!activeCase) {
    return (
      <Section title={ko.fieldChecklist.title}>
        <p className="field-hint">
          {ko.common.noActiveCase}{' '}
          <Link href="/a">{ko.dashboard.mark}</Link>
        </p>
      </Section>
    );
  }

  if (items.length === 0) {
    return (
      <Section title={ko.fieldChecklist.title}>
        <p className="field-hint">{ko.fieldChecklist.empty}</p>
      </Section>
    );
  }

  return (
    <Section title={ko.fieldChecklist.title}>
      <p className="field-hint">{ko.fieldChecklist.progress(done, items.length)}</p>
      <div>
        {items.map((item) => (
          <label key={item.id} className="checklist-item">
            <input
              type="checkbox"
              className="chk-box"
              checked={item.checked}
              onChange={() => toggle(item.id)}
            />
            <span>
              {item.label}
              <span className="chk-src">{item.source}</span>
            </span>
          </label>
        ))}
      </div>
      {done === items.length ? (
        <p className="field-hint" style={{ marginTop: 12 }}>
          <Link href="/d">{ko.fieldChecklist.next}</Link>
        </p>
      ) : null}
    </Section>
  );
}
