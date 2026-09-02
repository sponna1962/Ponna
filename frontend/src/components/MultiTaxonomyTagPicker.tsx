'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-fetch';

export type TaxonomyTag = { authorityId: string; categoryId?: string; subCategoryId?: string };

type SubCategory = { id: string; name: string };
type Category = { id: string; name: string; subCategories: SubCategory[] };
type Authority = { id: string; name: string; categories: Category[] };
type Purpose = { id: string; name: string; authorities: Authority[] };

/**
 * "Also applies to" tag picker — one Authority checklist, then (for every
 * CHECKED Authority) its Categories appear as their own checklist right
 * below, then (for every CHECKED Category) its Sub-Categories appear below
 * that — all on one page, no repeated "add another" step.
 *
 * Checking just an Authority (nothing under it) tags the whole Authority.
 * Checking a Category under it narrows that ONE Authority down to just that
 * Category (the whole-Authority tag is replaced, not kept alongside it) —
 * and likewise checking a Sub-Category narrows a Category down further.
 * This lets one batch be tagged, for example, to TNPSC's Group II, Group
 * III, and Group IV specifically, without also tagging the whole of TNPSC.
 */
export function MultiTaxonomyTagPicker({ value, onChange }: { value: TaxonomyTag[]; onChange: (tags: TaxonomyTag[]) => void }) {
  const [tree, setTree] = useState<Purpose[]>([]);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then(setTree)
      .catch(() => {});
  }, []);

  const authorityChecked = (authorityId: string) => value.some((t) => t.authorityId === authorityId);
  const categoryChecked = (authorityId: string, categoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId);
  const subCategoryChecked = (authorityId: string, categoryId: string, subCategoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId && t.subCategoryId === subCategoryId);

  function toggleAuthority(authorityId: string) {
    if (authorityChecked(authorityId)) {
      onChange(value.filter((t) => t.authorityId !== authorityId));
    } else {
      onChange([...value, { authorityId }]);
    }
  }

  function toggleCategory(authorityId: string, categoryId: string) {
    const hasThisCategory = value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId && !t.subCategoryId);
    // Remove any prior tag for this exact (authority, category) pair — the
    // whole-Authority tag if that's all there was, or the plain
    // category-level tag if we're unchecking it — then add back the new
    // state. Sub-Category-level tags for OTHER categories under the same
    // Authority are left untouched.
    const withoutThis = value.filter((t) => !(t.authorityId === authorityId && (!t.categoryId || t.categoryId === categoryId)));
    onChange(hasThisCategory ? withoutThis : [...withoutThis, { authorityId, categoryId }]);
  }

  function toggleSubCategory(authorityId: string, categoryId: string, subCategoryId: string) {
    const hasThis = subCategoryChecked(authorityId, categoryId, subCategoryId);
    const withoutThis = value.filter(
      (t) => !(t.authorityId === authorityId && (!t.categoryId || (t.categoryId === categoryId && (!t.subCategoryId || t.subCategoryId === subCategoryId)))),
    );
    onChange(hasThis ? withoutThis : [...withoutThis, { authorityId, categoryId, subCategoryId }]);
  }

  const checkedAuthorityRows: { purpose: Purpose; authority: Authority }[] = [];
  for (const purpose of tree) {
    for (const authority of purpose.authorities) {
      if (authorityChecked(authority.id)) checkedAuthorityRows.push({ purpose, authority });
    }
  }
  const checkedCategoryRows: { authority: Authority; category: Category }[] = [];
  for (const { authority } of checkedAuthorityRows) {
    for (const category of authority.categories) {
      if (categoryChecked(authority.id, category.id)) checkedCategoryRows.push({ authority, category });
    }
  }

  return (
    <div>
      {/* Authority — grouped by Purpose */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 6px', textTransform: 'uppercase' }}>Authority</p>
        {tree.map((purpose) => (
          <div key={purpose.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 2 }}>{purpose.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {purpose.authorities.map((a) => (
                <label key={a.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={authorityChecked(a.id)} onChange={() => toggleAuthority(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Category — only for checked Authorities */}
      {checkedAuthorityRows.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 6px', textTransform: 'uppercase' }}>Category</p>
          {checkedAuthorityRows.map(({ authority }) =>
            authority.categories.length === 0 ? null : (
              <div key={authority.id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 2 }}>{authority.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {authority.categories.map((c) => (
                    <label key={c.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" checked={categoryChecked(authority.id, c.id)} onChange={() => toggleCategory(authority.id, c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Sub-Category — only for checked Categories */}
      {checkedCategoryRows.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 6px', textTransform: 'uppercase' }}>Sub-Category</p>
          {checkedCategoryRows.map(({ authority, category }) =>
            category.subCategories.length === 0 ? null : (
              <div key={category.id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 2 }}>
                  {authority.name} → {category.name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {category.subCategories.map((s) => (
                    <label key={s.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={subCategoryChecked(authority.id, category.id, s.id)}
                        onChange={() => toggleSubCategory(authority.id, category.id, s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
