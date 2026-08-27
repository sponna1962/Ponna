'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Exam Taxonomy Management — Super Admin adds new Purposes, Authorities,
// Categories, and Sub-Categories here at any time; nothing about this
// structure is hardcoded beyond the initial seed data, so growth into new
// exam families never requires a schema change or a deploy.

type SubCategory = { id: string; name: string; _count: { questions: number } };
type Category = { id: string; name: string; subCategories: SubCategory[]; _count: { questions: number } };
type Authority = { id: string; name: string; categories: Category[] };
type Purpose = { id: string; name: string; nameTa: string | null; authorities: Authority[] };

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
          <h2 style={{ fontSize: 17, marginBottom: 4 }}>{purpose.name}</h2>
          {purpose.nameTa && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{purpose.nameTa}</p>}

          {purpose.authorities.map((authority) => (
            <div key={authority.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12, marginLeft: 12 }}>
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>{authority.name}</h3>

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
