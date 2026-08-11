'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';

type Props = {
  onClose: () => void;
};

export function EvictionCaseForm({ onClose }: Props) {
  const { createCase } = useCases();
  const router = useRouter();
  const [name, setName] = useState('');
  const [clientLabel, setClientLabel] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('물건·별칭을 입력해 주세요.');
      return;
    }
    createCase({
      name: name.trim(),
      track: 'eviction',
      clientLabel: clientLabel.trim() || undefined,
    });
    onClose();
    router.push('/e');
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3>{ko.evictionForm.title}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="eviction-name">{ko.evictionForm.name}</label>
            <input
              id="eviction-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ko.evictionForm.namePh}
            />
          </div>
          <div className="field">
            <label htmlFor="eviction-client">{ko.evictionForm.clientLabel}</label>
            <input
              id="eviction-client"
              type="text"
              value={clientLabel}
              onChange={(e) => setClientLabel(e.target.value)}
              placeholder={ko.evictionForm.clientLabelPh}
            />
          </div>
          <p className="field-hint">{ko.evictionForm.privacyNote}</p>
          {error ? (
            <p className="notice-inline" style={{ color: 'var(--seal)' }}>
              {error}
            </p>
          ) : null}
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">
              {ko.evictionForm.submit}
            </button>
            <button type="button" className="btn-text" onClick={onClose}>
              {ko.evictionForm.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
