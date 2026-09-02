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
 * EXPANDED Authority) its Categories appear as their own checklist right
 * below, then (for every EXPANDED Category) its Sub-Categories appear
 * below that — all on one page, no repeated "add another" step.
 *
 * Ticking an Authority/Category only REVEALS the next level — it does NOT
 * by itself create a tag. The admin must explicitly tick "All Categories"
 * (or specific Categories) under a revealed Authority, and likewise "All
 * Sub-Categories" (or specific Sub-Categories) under a revealed Category,
 * to actually produce a tag. This keeps "All" a deliberate choice, never
 * an accidental default from just ticking the Authority checkbox.
 */
export function MultiTaxonomyTagPicker({ value, onChange }: { value: TaxonomyTag[]; onChange: (tags: TaxonomyTag[]) => void }) {
  const [tree, setTree] = useState<Purpose[]>([]);
  // UI-only — which rows are expanded to show the next level down. Never
  // saved/sent anywhere; only `value` (the actual tags) is.
  const [expandedAuthorities, setExpandedAuthorities] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set()); // keyed "authorityId:categoryId"

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then(setTree)
      .catch(() => {});
  }, []);

  const allCategoriesChecked = (authorityId: string) => value.some((t) => t.authorityId === authorityId && !t.categoryId);
  const categoryChecked = (authorityId: string, categoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId);
  const allSubCategoriesChecked = (authorityId: string, categoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId && !t.subCategoryId);
  const subCategoryChecked = (authorityId: string, categoryId: string, subCategoryId: string) =>
    value.some((t) => t.authorityId === authorityId && t.categoryId === categoryId && t.subCategoryId === subCategoryId);

  function toggleAuthorityExpanded(authorityId: string) {
    const next = new Set(expandedAuthorities);
    if (next.has(authorityId)) {
      next.delete(authorityId);
      // Collapsing an Authority also clears any tags made under it —
      // nothing left on screen to represent them.
      onChange(value.filter((t) => t.authorityId !== authorityId));
    } else {
      next.add(authorityId);
    }
    setExpandedAuthorities(next);
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

  function toggleCategoryExpanded(authorityId: string, categoryId: string) {
    const key = `${authorityId}:${categoryId}`;
    const next = new Set(expandedCategories);
    if (next.has(key)) {
      next.delete(key);
      onChange(value.filter((t) => !(t.authorityId === authorityId && t.categoryId === categoryId)));
    } else {
      next.add(key);
    }
    setExpandedCategories(next);
  }

  function toggleAllSubCategories(authorityId: string, categoryId: string) {
    if (allSubCategoriesChecked(authorityId, categoryId)) {
      onChange(value.filter((t) => !(t.authorityId === authorityId && t.categoryId === categoryId && !t.subCategoryId)));
    } else {
      onChange([...value.filter((t) => !(t.authorityId === authorityId && t.categoryId === categoryId)), { authorityId, categoryId }]);
    }
  }

  function toggleSubCategory(authorityId: string, categoryId: string, subCategoryId: string) {
    const hasThis = subCategoryChecked(authorityId, categoryId, subCategoryId);
    const withoutThis = value.filter(
      (t) => !(t.authorityId === authorityId && t.categoryId === categoryId && t.subCategoryId === subCategoryId),
    );
    onChange(hasThis ? withoutThis : [...withoutThis, { authorityId, categoryId, subCategoryId }]);
  }

  const expandedAuthorityRows: { purpose: Purpose; authority: Authority }[] = [];
  for (const purpose of tree) {
    for (const authority of purpose.authorities) {
      if (expandedAuthorities.has(authority.id)) expandedAuthorityRows.push({ purpose, authority });
    }
  }
  const expandedCategoryRows: { authority: Authority; category: Category }[] = [];
  for (const { authority } of expandedAuthorityRows) {
    for (const category of authority.categories) {
      if (expandedCategories.has(`${authority.id}:${category.id}`)) expandedCategoryRows.push({ authority, category });
    }
  }

  return (
    <div>
      {/* Authority — grouped by Purpose. Ticking one only reveals its
          Category checklist below; it does not tag anything by itself. */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 6px', textTransform: 'uppercase' }}>Authority</p>
        {tree.map((purpose) => (
          <div key={purpose.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 2 }}>{purpose.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {purpose.authorities.map((a) => (
                <label key={a.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={expandedAuthorities.has(a.id)} onChange={() => toggleAuthorityExpanded(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Category — only for Authorities ticked above. Ticking a specific
          Category here reveals its Sub-Category checklist below; ticking
          "All Categories" tags the whole Authority and does NOT reveal
          Sub-Categories (there's nothing narrower left to pick). */}
      {expandedAuthorityRows.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 6px', textTransform: 'uppercase' }}>Category</p>
          {expandedAuthorityRows.map(({ authority }) =>
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
                        checked={expandedCategories.has(`${authority.id}:${c.id}`)}
                        disabled={allCategoriesChecked(authority.id)}
                        onChange={() => toggleCategoryExpanded(authority.id, c.id)}
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

      {/* Sub-Category — only for Categories ticked above. */}
      {expandedCategoryRows.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 6px', textTransform: 'uppercase' }}>Sub-Category</p>
          {expandedCategoryRows.map(({ authority, category }) =>
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
                        checked={subCategoryChecked(authority.id, category.id, s.id)}
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
