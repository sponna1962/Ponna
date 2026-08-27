'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-fetch';

type SubCategory = { id: string; name: string };
type Category = { id: string; name: string; subCategories: SubCategory[] };
type Authority = { id: string; name: string; categories: Category[] };
type Purpose = { id: string; name: string; nameTa: string | null; authorities: Authority[] };

export type TaxonomyValue = {
  authorityId: string;
  categoryId: string;
  subCategoryId: string;
};

/**
 * Cascading Authority → Category → Sub-Category (optional) dropdowns, used
 * on the admin Question form / Bulk Upload metadata step. The Authority
 * dropdown is grouped by Exam Purpose (optgroup) purely for readability
 * here — admin picks a specific Authority directly, unlike the student
 * Practice Setup flow which requires picking a Purpose first.
 */
export function ExamTaxonomyPicker({
  value,
  onChange,
}: {
  value: TaxonomyValue;
  onChange: (v: TaxonomyValue) => void;
}) {
  const [tree, setTree] = useState<Purpose[]>([]);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then(setTree)
      .catch(() => {});
  }, []);

  const allAuthorities = tree.flatMap((p) => p.authorities);
  const selectedAuthority = allAuthorities.find((a) => a.id === value.authorityId);
  const selectedCategory = selectedAuthority?.categories.find((c) => c.id === value.categoryId);

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <label style={{ fontSize: 13 }}>
        Authority:{' '}
        <select
          value={value.authorityId}
          onChange={(e) => onChange({ authorityId: e.target.value, categoryId: '', subCategoryId: '' })}
        >
          <option value="">—</option>
          {tree.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {p.authorities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 13 }}>
        Category:{' '}
        <select
          value={value.categoryId}
          disabled={!selectedAuthority}
          onChange={(e) => onChange({ ...value, categoryId: e.target.value, subCategoryId: '' })}
        >
          <option value="">—</option>
          {selectedAuthority?.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 13 }}>
        Sub-Category:{' '}
        <select
          value={value.subCategoryId}
          disabled={!selectedCategory || selectedCategory.subCategories.length === 0}
          onChange={(e) => onChange({ ...value, subCategoryId: e.target.value })}
        >
          <option value="">— (optional)</option>
          {selectedCategory?.subCategories.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
