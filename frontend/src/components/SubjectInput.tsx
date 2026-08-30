'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-fetch';

// Subject (topic/subject-matter — History, Polity, General Science...) is a
// type-with-suggestions field, not a fixed dropdown: the admin can pick an
// existing Subject OR type a brand-new one, and the backend find-or-creates
// it by name. This avoids needing a separate "manage Subjects" admin step,
// while the <datalist> suggestions steer repeat use toward existing names
// (e.g. typing "General S" suggests the "General Science" already on file)
// so near-duplicate spellings stay rare in practice.
export function SubjectInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    adminFetch('/admin/subjects')
      .then((r) => r.json())
      .then(setSubjects)
      .catch(() => {}); // suggestions are a nice-to-have — a failed fetch shouldn't block typing
  }, []);

  return (
    <label style={{ fontSize: 13 }}>
      Subject (optional):{' '}
      <input
        list="ponna-subjects"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. History, Polity, General Science"
        style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 220 }}
      />
      <datalist id="ponna-subjects">
        {subjects.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
    </label>
  );
}
