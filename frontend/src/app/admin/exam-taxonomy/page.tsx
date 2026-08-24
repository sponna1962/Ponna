'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Exam Taxonomy Management — Super Admin adds new Authorities, Categories,
// and Sub-Categories here at any time; nothing about this structure is
// hardcoded beyond the initial seed data, so growth into new exams (UPSC,
// SSC, etc.) never requires a schema change or a deploy.

type SubCategory = { id: string; name: string; _count: { questions: number } };
type Category = { id: string; name: string; subCategories: SubCategory[]; _count: { questions: number } };
type Authority = { id: string; name: string; categories: Category[] };

export default function ExamTaxonomyPage() {
  const [tree, setTree] = useState<Authority[]>([]);
  const [newAuthorityName, setNewAuthorityName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({});
  const [newSubCategoryName, setNewSubCategoryName] = useState<Record<string, string>>({});

  async function load() {
    const res = await adminFetch('/admin/exam-taxonomy');
    setTree(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addAuthority() {
    if (!newAuthorityName.trim()) return;
    await adminFetch('/admin/exam-taxonomy/authorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAuthorityName.trim() }),
    });
    setNewAuthorityName('');
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
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 600 }}>
        Authority → Category → Sub-Category (optional). Add new entries any time — used to classify
        questions and to pre-fill Bulk Upload metadata.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          placeholder="New Authority (e.g. UPSC)"
          value={newAuthorityName}
          onChange={(e) => setNewAuthorityName(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 240 }}
        />
        <button onClick={addAuthority} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
          + Add Authority
        </button>
      </div>

      {tree.map((authority) => (
        <div key={authority.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{authority.name}</h2>

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
    </div>
  );
}
