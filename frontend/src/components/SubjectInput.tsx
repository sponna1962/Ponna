'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-fetch';

// Sept 2026 (explicit request, real bug found) — was a free-text field
// with <datalist> suggestions: an admin could type ANYTHING, and any
// text not an EXACT character-for-character match against an existing
// Subject silently created a brand-new row. Confirmed as the real root
// cause of ~339 messy, near-duplicate Subject rows in the database (a
// live diagnostic found subjects like "Indian Polity" existing under
// several slightly different spellings/suffixes). Now a strict <select>
// dropdown: picking an existing Subject is the only way to submit,
// which is what actually prevents new accidental duplicates going
// forward. A genuinely new Subject (rare) still needs one, so an
// explicit "+ Add a new subject" toggle is kept, deliberately separate
// from the everyday picking flow so it's never reached by accident.
export function SubjectInput({ value, onChange, subCategoryId }: { value: string; onChange: (v: string) => void; subCategoryId?: string }) {
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    // Sept 2026 (real fix, explicit request) — scoped to ONE exam's own
    // Subjects when subCategoryId is known, so "these are the decided
    // subjects for this exam" is what the dropdown actually shows —
    // not all ~339 Subject rows across every exam. Falls back to the
    // full list when no exam context is available yet (e.g. Bulk
    // Upload before an exam has been picked).
    const query = subCategoryId ? `?subCategoryId=${encodeURIComponent(subCategoryId)}` : '';
    adminFetch(`/admin/subjects${query}`)
      .then((r) => r.json())
      .then((list: { id: string; name: string }[]) => setSubjects(list.slice().sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, [subCategoryId]);

  // If the current value doesn't match any known Subject exactly (e.g.
  // editing an existing question whose Subject text is itself one of the
  // messy near-duplicates), fall back to showing the free-text box so
  // the actual current value is never silently hidden or lost.
  const valueMatchesKnownSubject = subjects.some((s) => s.name === value);
  const showFreeText = addingNew || (!!value && !valueMatchesKnownSubject);

  if (showFreeText) {
    return (
      <label style={{ fontSize: 13 }}>
        Subject:{' '}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. History, Polity, General Science"
          style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 220 }}
        />
        {!addingNew && (
          <span style={{ fontSize: 11, color: '#b45309', marginLeft: 6 }}>
            (this exact text isn't an existing Subject — check the dropdown first if you meant an existing one)
          </span>
        )}
        {addingNew && (
          <button
            type="button"
            onClick={() => {
              setAddingNew(false);
              onChange('');
            }}
            style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            Cancel — pick from list instead
          </button>
        )}
      </label>
    );
  }

  return (
    <label style={{ fontSize: 13 }}>
      Subject:{' '}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 220 }}>
        <option value="">— select a subject —</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>{' '}
      <button
        type="button"
        onClick={() => setAddingNew(true)}
        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
      >
        + Add a new subject
      </button>
    </label>
  );
}
