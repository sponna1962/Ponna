'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-fetch';

type SubCategory = { id: string; name: string };
type Category = { id: string; name: string; subCategories: SubCategory[] };
type Authority = { id: string; name: string; categories: Category[] };

export type TaxonomyValue = {
  authorityId: string;
  categoryId: string;
  subCategoryId: string;
};

/**
 * Cascading Authority → Category → Sub-Category (optional) dropdowns.
 * Fetches the full taxonomy tree once and does the cascading client-side —
 * the tree is small (a handful of Authorities/Categories) so this is
 * simpler and faster than round-tripping per level.
 */
export function ExamTaxonomyPicker({
  value,
  onChange,
}: {
  value: TaxonomyValue;
  onChange: (v: TaxonomyValue) => void;
}) {
  const [tree, setTree] = useState<Authority[]>([]);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then(setTree)
      .catch(() => {});
  }, []);

  const selectedAuthority = tree.find((a) => a.id === value.authorityId);
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
          {tree.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
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
