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
  const allCategoriesChecked = (authorityId: string) => value.some((t) => t.authorityId === authorityId && !t.categoryId);
  const categoryChecked = (authorityId: string, categoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId);
  const allSubCategoriesChecked = (authorityId: string, categoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId && !t.subCategoryId);
  const subCategoryChecked = (authorityId: string, categoryId: string, subCategoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId && t.subCategoryId === subCategoryId);

  function toggleAuthority(authorityId: string) {
    if (authorityChecked(authorityId)) {
      onChange(value.filter((t) => t.authorityId !== authorityId));
    } else {
      onChange([...value, { authorityId }]); // starts as "All Categories" for this Authority
    }
  }

  function toggleAllCategories(authorityId: string) {
    if (allCategoriesChecked(authorityId)) {
      onChange(value.filter((t) => !(t.authorityId === authorityId && !t.categoryId)));
    } else {
      // Explicit "All Categories" replaces any individual Category/Sub-
      // Category selections already made for this Authority — they'd be
      // redundant once the whole Authority is tagged.
      onChange([...value.filter((t) => t.authorityId !== authorityId), { authorityId }]);
    }
  }

  function toggleCategory(authorityId: string, categoryId: string) {
    const hasThisCategory = value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId && !t.subCategoryId);
    const withoutThis = value.filter((t) => !(t.authorityId === authorityId && (!t.categoryId || t.categoryId === categoryId)));
    onChange(hasThisCategory ? withoutThis : [...withoutThis, { authorityId, categoryId }]);
  }

  function toggleAllSubCategories(authorityId: string, categoryId: string) {
    if (allSubCategoriesChecked(authorityId, categoryId)) {
      onChange(value.filter((t) => !(t.authorityId === authorityId && t.categoryId === categoryId && !t.subCategoryId)));
    } else {
      // Explicit "All Sub-Categories" replaces any individual Sub-Category
      // selections already made for this Category.
      onChange([...value.filter((t) => !(t.authorityId === authorityId && t.categoryId === categoryId)), { authorityId, categoryId }]);
    }
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
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                    <input type="checkbox" checked={allCategoriesChecked(authority.id)} onChange={() => toggleAllCategories(authority.id)} />
                    All Categories
                  </label>
                  {authority.categories.map((c) => (
                    <label
                      key={c.id}
                      style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, opacity: allCategoriesChecked(authority.id) ? 0.4 : 1 }}
                    >
                      <input
                        type="checkbox"
                        checked={allCategoriesChecked(authority.id) || categoryChecked(authority.id, c.id)}
                        disabled={allCategoriesChecked(authority.id)}
                        onChange={() => toggleCategory(authority.id, c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Sub-Category — only for checked Categories (not "All Categories") */}
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
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={allSubCategoriesChecked(authority.id, category.id)}
                      onChange={() => toggleAllSubCategories(authority.id, category.id)}
                    />
                    All Sub-Categories
                  </label>
                  {category.subCategories.map((s) => (
                    <label
                      key={s.id}
                      style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, opacity: allSubCategoriesChecked(authority.id, category.id) ? 0.4 : 1 }}
                    >
                      <input
                        type="checkbox"
                        checked={allSubCategoriesChecked(authority.id, category.id) || subCategoryChecked(authority.id, category.id, s.id)}
                        disabled={allSubCategoriesChecked(authority.id, category.id)}
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
