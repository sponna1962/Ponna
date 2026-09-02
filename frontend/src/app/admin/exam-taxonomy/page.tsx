'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Exam Taxonomy Management — Super Admin adds new Purposes, Authorities,
// Categories, and Sub-Categories here at any time; nothing about this
// structure is hardcoded beyond the initial seed data, so growth into new
// exam families never requires a schema change or a deploy.

type SubCategory = { id: string; name: string; _count: { questions: number } };
type Category = { id: string; name: string; subCategories: SubCategory[]; _count: { questions: number } };
type Authority = {
  id: string;
  name: string;
  categories: Category[];
  allowAllCategories: boolean;
  difficultyEnabled: boolean;
  selectionGroup: string | null;
  studentVisible: boolean;
};
type Purpose = { id: string; name: string; nameTa: string | null; authorities: Authority[]; allowMultipleAuthorities: boolean; studentVisible: boolean };

export default function ExamTaxonomyPage() {
  const [tree, setTree] = useState<Purpose[]>([]);
  const [newPurposeName, setNewPurposeName] = useState('');
  const [newPurposeNameTa, setNewPurposeNameTa] = useState('');
  const [newAuthorityName, setNewAuthorityName] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({});
  const [newSubCategoryName, setNewSubCategoryName] = useState<Record<string, string>>({});

  async function load() {
    const res = await adminFetch('/admin/exam-taxonomy');
    setTree(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addPurpose() {
    if (!newPurposeName.trim()) return;
    await adminFetch('/admin/exam-taxonomy/purposes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPurposeName.trim(), nameTa: newPurposeNameTa.trim() || undefined }),
    });
    setNewPurposeName('');
    setNewPurposeNameTa('');
    load();
  }

  async function addAuthority(purposeId: string) {
    const name = newAuthorityName[purposeId]?.trim();
    if (!name) return;
    await adminFetch(`/admin/exam-taxonomy/purposes/${purposeId}/authorities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setNewAuthorityName({ ...newAuthorityName, [purposeId]: '' });
    load();
  }

  /** Toggles either flag for one Authority — controls the student-facing
   * Practice Setup page's "All" chip and Difficulty step, per Authority. */
  async function toggleAuthorityConfig(authority: Authority, field: 'allowAllCategories' | 'difficultyEnabled' | 'studentVisible') {
    await adminFetch(`/admin/exam-taxonomy/authorities/${authority.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !authority[field] }),
    });
    load();
  }

  /** Sets/clears an Authority's Selection Group — the config-driven exception
   * that lets specific Authorities inside an otherwise single-select Purpose
   * be picked together (e.g. JEE Main + JEE Advanced sharing "JEE"). Empty
   * input = standalone (cannot combine with anything). Has no effect in a
   * Purpose where "Allow selecting multiple Authorities" is already on. */
  async function updateSelectionGroup(authority: Authority, value: string) {
    await adminFetch(`/admin/exam-taxonomy/authorities/${authority.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectionGroup: value.trim() || null }),
    });
    load();
  }

  /** Controls whether a student can select multiple Authorities within this Purpose in one saved Preference. */
  async function togglePurposeMultiple(purpose: Purpose) {
    await adminFetch(`/admin/exam-taxonomy/purposes/${purpose.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowMultipleAuthorities: !purpose.allowMultipleAuthorities }),
    });
    load();
  }

  /** Hides/shows this ENTIRE Purpose (and everything under it) from the
   * student-facing Practice Setup — never touches any underlying data. */
  async function togglePurposeVisible(purpose: Purpose) {
    await adminFetch(`/admin/exam-taxonomy/purposes/${purpose.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentVisible: !purpose.studentVisible }),
    });
    load();
  }

  async function addCategory(authorityId: string) {
    const name = newCategoryName[authorityId]?.trim();
    if (!name) return;
    await adminFetch(`/admin/exam-taxonomy/authorities/${authorityId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setNewCategoryName({ ...newCategoryName, [authorityId]: '' });
    load();
  }

  async function addSubCategory(categoryId: string) {
    const name = newSubCategoryName[categoryId]?.trim();
    if (!name) return;
    await adminFetch(`/admin/exam-taxonomy/categories/${categoryId}/sub-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setNewSubCategoryName({ ...newSubCategoryName, [categoryId]: '' });
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Exam Taxonomy</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 640 }}>
        Purpose → Authority → Category → Sub-Category (optional). Purposes keep unrelated exam
        families apart (e.g. Employment/Recruitment vs Higher Education/Admission) — an "All"
        chosen by a student inside one Purpose never pulls in Authorities from another.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          placeholder="New Purpose name (English) — e.g. Employment / Recruitment Exams"
          value={newPurposeName}
          onChange={(e) => setNewPurposeName(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 300 }}
        />
        <input
          placeholder="Tamil label (optional)"
          value={newPurposeNameTa}
          onChange={(e) => setNewPurposeNameTa(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 200 }}
        />
        <button onClick={addPurpose} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
          + Add Purpose
        </button>
      </div>

      {tree.map((purpose) => (
        <div key={purpose.id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ fontSize: 17, margin: 0 }}>{purpose.name}</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 10,
                background: purpose.studentVisible ? '#dcfce7' : '#fee2e2',
                color: purpose.studentVisible ? '#166534' : '#991b1b',
              }}
            >
              {purpose.studentVisible ? 'Visible to students' : 'Hidden from students'}
            </span>
          </div>
          {purpose.nameTa && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{purpose.nameTa}</p>}
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={purpose.studentVisible}
              onChange={() => togglePurposeVisible(purpose)}
            />
            Visible to students (hides this whole Purpose, and every Authority under it, from Practice Setup when off — admin panel unaffected)
          </label>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={purpose.allowMultipleAuthorities}
              onChange={() => togglePurposeMultiple(purpose)}
            />
            Allow selecting multiple Authorities within this Purpose
          </label>

          {purpose.authorities.map((authority) => (
            <div key={authority.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12, marginLeft: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, margin: 0 }}>{authority.name}</h3>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 7px',
                    borderRadius: 10,
                    background: authority.studentVisible ? '#dcfce7' : '#fee2e2',
                    color: authority.studentVisible ? '#166534' : '#991b1b',
                  }}
                >
                  {authority.studentVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={authority.studentVisible}
                    onChange={() => toggleAuthorityConfig(authority, 'studentVisible')}
                  />
                  Visible to students
                </label>
                <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={authority.allowAllCategories}
                    onChange={() => toggleAuthorityConfig(authority, 'allowAllCategories')}
                  />
                  Show "All" option for categories
                </label>
                <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={authority.difficultyEnabled}
                    onChange={() => toggleAuthorityConfig(authority, 'difficultyEnabled')}
                  />
                  Show Difficulty step
                </label>
                <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Selection Group:{' '}
                  <input
                    key={`${authority.id}-${authority.selectionGroup ?? ''}`}
                    type="text"
                    defaultValue={authority.selectionGroup ?? ''}
                    placeholder="empty = standalone"
                    style={{ fontSize: 12, width: 130, padding: '2px 6px' }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value !== (authority.selectionGroup ?? '')) updateSelectionGroup(authority, value);
                    }}
                  />
                </label>
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: -6, marginBottom: 10 }}>
                Authorities sharing the same Selection Group (e.g. both set to &quot;JEE&quot;) can be selected together
                even when this Purpose otherwise allows only one Authority. Leave empty for standalone.
              </p>

              {authority.categories.map((cat) => (
                <div key={cat.id} style={{ marginLeft: 16, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    {cat.name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({cat._count.questions} questions)</span>
                  </div>
                  {cat.subCategories.length > 0 && (
                    <ul style={{ marginLeft: 16, marginBottom: 8, fontSize: 13, color: '#475569' }}>
                      {cat.subCategories.map((sub) => (
                        <li key={sub.id}>{sub.name} <span style={{ color: '#94a3b8' }}>({sub._count.questions})</span></li>
                      ))}
                    </ul>
                  )}
                  <div style={{ marginLeft: 16, display: 'flex', gap: 6 }}>
                    <input
                      placeholder="+ Sub-Category"
                      value={newSubCategoryName[cat.id] ?? ''}
                      onChange={(e) => setNewSubCategoryName({ ...newSubCategoryName, [cat.id]: e.target.value })}
                      style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                    />
                    <button onClick={() => addSubCategory(cat.id)} style={{ fontSize: 12, padding: '4px 10px' }}>Add</button>
                  </div>
                </div>
              ))}

              <div style={{ marginLeft: 16, display: 'flex', gap: 6 }}>
                <input
                  placeholder="+ Category"
                  value={newCategoryName[authority.id] ?? ''}
                  onChange={(e) => setNewCategoryName({ ...newCategoryName, [authority.id]: e.target.value })}
                  style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
                <button onClick={() => addCategory(authority.id)} style={{ fontSize: 12, padding: '4px 10px' }}>Add</button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
            <input
              placeholder="+ Authority (e.g. TNPSC)"
              value={newAuthorityName[purpose.id] ?? ''}
              onChange={(e) => setNewAuthorityName({ ...newAuthorityName, [purpose.id]: e.target.value })}
              style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
            />
            <button onClick={() => addAuthority(purpose.id)} style={{ fontSize: 12, padding: '4px 10px' }}>Add</button>
          </div>
        </div>
      ))}
    </div>
  );
}
