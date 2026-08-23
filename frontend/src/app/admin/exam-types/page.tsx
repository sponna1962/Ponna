'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Exam Taxonomy Management — implements §7.1: manage Exam Type and Sub-Type.

type ExamType = {
  id: string;
  name: string;
  subTypes: { id: string; name: string }[];
  _count: { questions: number };
};

export default function ExamTypesPage() {
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newSubTypeName, setNewSubTypeName] = useState<Record<string, string>>({});

  async function load() {
    const res = await adminFetch('/admin/exam-types');
    setExamTypes(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function addExamType() {
    if (!newTypeName.trim()) return;
    await adminFetch('/admin/exam-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTypeName.trim() }),
    });
    setNewTypeName('');
    load();
  }

  async function addSubType(examTypeId: string) {
    const name = newSubTypeName[examTypeId]?.trim();
    if (!name) return;
    await adminFetch(`/admin/exam-types/${examTypeId}/sub-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setNewSubTypeName({ ...newSubTypeName, [examTypeId]: '' });
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 20 }}>Exam Types</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, maxWidth: 400 }}>
        <input
          placeholder="e.g. TNPSC, UPSC, Banking"
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <button onClick={addExamType} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
          Add
        </button>
      </div>

      {examTypes.map((et) => (
        <div key={et.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12, maxWidth: 480 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong>{et.name}</strong>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{et._count.questions} questions</span>
          </div>

          <ul style={{ margin: '0 0 10px 0', paddingLeft: 18, fontSize: 13, color: '#334155' }}>
            {et.subTypes.map((st) => <li key={st.id}>{st.name}</li>)}
            {et.subTypes.length === 0 && <li style={{ color: '#94a3b8', listStyle: 'none', marginLeft: -18 }}>No sub-types yet</li>}
          </ul>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="e.g. Group 1, Group 4"
              value={newSubTypeName[et.id] ?? ''}
              onChange={(e) => setNewSubTypeName({ ...newSubTypeName, [et.id]: e.target.value })}
              style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
            <button onClick={() => addSubType(et.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
              + Sub-Type
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
