'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-fetch';

type Authority = { id: string; name: string };
type Purpose = { id: string; name: string; authorities: Authority[] };

/**
 * Checklist of Authorities, grouped by Purpose, for tagging a question/batch
 * as ALSO relevant to exams beyond its primary Authority (Original/Book/
 * Other source-type content — General Knowledge, Aptitude, English... that
 * genuinely benefits several exams at once, not just one). `excludeAuthorityId`
 * hides the batch's own primary Authority from the list — tagging a question
 * to its own primary Authority is redundant, it's already covered.
 */
export function AdditionalAuthoritiesPicker({
  value,
  onChange,
  excludeAuthorityId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  excludeAuthorityId?: string;
}) {
  const [tree, setTree] = useState<Purpose[]>([]);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then(setTree)
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, maxHeight: 220, overflowY: 'auto' }}>
      {tree.map((purpose) => {
        const authorities = purpose.authorities.filter((a) => a.id !== excludeAuthorityId);
        if (authorities.length === 0) return null;
        return (
          <div key={purpose.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{purpose.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {authorities.map((a) => (
                <label key={a.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={value.includes(a.id)} onChange={() => toggle(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
