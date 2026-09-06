'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Doc = { id: string; subCategoryId: string; documentType: string; title: string; documentDate: string; sourceUrl: string | null; fileName: string; status: string; uploadedAt: string };
type Candidate = { id: string; suggestedFactType: string; suggestedValue: string; approved: boolean };

const TYPES = ['NOTIFICATION','ADDENDUM_CORRIGENDUM','APPLICATION','EXAM_DATE','HALL_TICKET','ANSWER_KEY','OBJECTION','RESULT','CERTIFICATE_VERIFICATION','COUNSELLING','FINAL_SELECTION','OTHER'];

export default function OfficialDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ subCategoryId: '', documentType: 'NOTIFICATION', title: '', documentDate: '', sourceUrl: '' });
  const [message, setMessage] = useState('');

  async function load() {
    const r = await adminFetch('/admin/official-documents');
    if (r.ok) setDocs(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function upload() {
    if (!file) return setMessage('PDF file is required.');
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append('file', file);
    const r = await adminFetch('/admin/official-documents', { method: 'POST', body });
    const data = await r.json();
    if (!r.ok) return setMessage(data.error ?? 'Upload failed');
    setMessage('Uploaded. Process the PDF to create reviewable fact candidates.');
    setFile(null);
    await load();
    openDoc(data.id);
  }

  async function openDoc(id: string) {
    const [d, c] = await Promise.all([
      adminFetch(`/admin/official-documents/${id}`),
      adminFetch(`/admin/official-documents/${id}/candidates`),
    ]);
    if (d.ok) setSelected(await d.json());
    if (c.ok) setCandidates(await c.json());
  }

  async function processPdf() {
    if (!selected || !file) return setMessage('Select the original PDF before processing.');
    const body = new FormData(); body.append('file', file);
    const r = await adminFetch(`/admin/official-documents/${selected.id}/process`, { method: 'POST', body });
    const data = await r.json();
    setMessage(r.ok ? `Processed ${data.pages ?? 0} pages. Review the candidates below.` : (data.error ?? 'Processing failed'));
    await openDoc(selected.id); await load();
  }

  async function approveCandidate(id: string) {
    const r = await adminFetch(`/admin/official-document-candidates/${id}/approve`, { method: 'POST' });
    const data = await r.json(); setMessage(r.ok ? 'Verified fact approved.' : (data.error ?? 'Approval failed'));
    if (selected) openDoc(selected.id);
  }

  async function discardCandidate(id: string) {
    await adminFetch(`/admin/official-document-candidates/${id}`, { method: 'DELETE' });
    if (selected) openDoc(selected.id);
  }

  async function transition(path: string) {
    if (!selected) return;
    const r = await adminFetch(`/admin/official-documents/${selected.id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: path === 'supersede' ? JSON.stringify({ replacementDocumentId: '' }) : undefined });
    const data = await r.json(); setMessage(r.ok ? `Document ${path} completed.` : (data.error ?? 'Action failed'));
    await openDoc(selected.id); await load();
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>Official Documents</h1>
      <p style={{ color: '#64748b' }}>Official PDF → extraction → review → verified information. Nothing is auto-published.</p>
      {message && <p style={{ padding: 10, background: '#f1f5f9', borderRadius: 8 }}>{message}</p>}

      <section style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18 }}>Upload Official PDF</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="ExamSubCategory ID" value={form.subCategoryId} onChange={e => setForm({ ...form, subCategoryId: e.target.value })} />
          <select value={form.documentType} onChange={e => setForm({ ...form, documentType: e.target.value })}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Document title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input type="date" value={form.documentDate} onChange={e => setForm({ ...form, documentDate: e.target.value })} />
          <input placeholder="Official source URL" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} />
          <input type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <button onClick={upload} style={{ padding: 10 }}>Upload</button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <section>
          <h2 style={{ fontSize: 18 }}>Review Queue</h2>
          {docs.map(d => <button key={d.id} onClick={() => openDoc(d.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, background: selected?.id === d.id ? '#f8fafc' : '#fff' }}><strong>{d.title}</strong><br /><small>{d.documentType} · {d.status} · {new Date(d.documentDate).toLocaleDateString()}</small></button>)}
          {!docs.length && <p style={{ color: '#94a3b8' }}>No documents waiting for review.</p>}
        </section>

        <section>
          {selected ? <>
            <h2 style={{ fontSize: 18 }}>{selected.title}</h2>
            <p><b>Status:</b> {selected.status}</p>
            <p><b>Source:</b> {selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Official source</a> : 'Missing'}</p>
            <input type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={processPdf} style={{ margin: '8px 0', padding: 8 }}>Process / Extract PDF</button>
            <h3>Fact Candidates</h3>
            {candidates.map(c => <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8 }}><b>{c.suggestedFactType}</b><p>{c.suggestedValue}</p>{!c.approved && <><button onClick={() => approveCandidate(c.id)}>Approve as Verified Fact</button>{' '}<button onClick={() => discardCandidate(c.id)}>Discard</button></>}</div>)}
            {selected.status === 'READY_FOR_REVIEW' && <button onClick={() => transition('approve')} style={{ marginTop: 8, padding: 8 }}>Approve Document</button>}
            {selected.status === 'READY_FOR_REVIEW' && <button onClick={() => transition('reject')} style={{ marginTop: 8, marginLeft: 8, padding: 8 }}>Reject</button>}
          </> : <p style={{ color: '#94a3b8' }}>Select a document to review.</p>}
        </section>
      </div>
    </main>
  );
}
