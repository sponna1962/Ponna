'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Item = { id: string; date: string; headline: string; summary: string; headlineEn: string | null; summaryEn: string | null; sourceUrl: string | null; examRelevanceNote: string | null; verifiedAt: string };

export default function CurrentAffairsLearningAdminPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: 'தமிழ்நாடு', headline: '', headlineEn: '', summary: '', summaryEn: '', examRelevanceNote: '', sourceUrl: '' });

  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch('/admin/current-affairs-learning');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data);
    } catch (err: any) { setMessage(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function generate() {
    setGenerating(true); setMessage('AI இரண்டு கட்ட சரிபார்ப்புடன் புதிய நிகழ்வுகளைத் தேடுகிறது...');
    try {
      const res = await adminFetch('/admin/current-affairs-learning/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setMessage(data.skipped ? data.reason : `${data.created} புதிய நடப்பு நிகழ்வுகள் சேர்க்கப்பட்டன.`);
      await load();
    } catch (err: any) { setMessage(err.message); }
    finally { setGenerating(false); }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await adminFetch('/admin/current-affairs-learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      setMessage('நிகழ்வு சேர்க்கப்பட்டது.');
      setForm((f) => ({ ...f, headline: '', headlineEn: '', summary: '', summaryEn: '', examRelevanceNote: '', sourceUrl: '' }));
      await load();
    } catch (err: any) { setMessage(err.message); }
  }

  async function remove(id: string) {
    if (!confirm('இந்த நடப்பு நிகழ்வை நீக்க வேண்டுமா?')) return;
    const res = await adminFetch(`/admin/current-affairs-learning/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 4 }}>நடப்பு நிகழ்வுகள் — படிப்புப் பகுதி</h1>
      <p style={{ color: '#64748b', marginTop: 0 }}>AI மூலம் சரிபார்க்கப்பட்ட நிகழ்வுகள் + ஆசிரியர் நேரடியாகச் சேர்க்கும் நிகழ்வுகள். மாணவர் பகுதியில் கேள்விகள் எதுவும் இல்லை.</p>

      <div style={{ display: 'flex', gap: 10, margin: '18px 0', flexWrap: 'wrap' }}>
        <button onClick={generate} disabled={generating} style={{ background: '#0f172a', color: '#fff', border: 0, borderRadius: 7, padding: '10px 15px', cursor: generating ? 'wait' : 'pointer' }}>
          {generating ? 'AI தேடுகிறது...' : 'AI மூலம் இன்றைய நிகழ்வுகளை உருவாக்கு'}
        </button>
        <button onClick={load} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 7, padding: '10px 15px' }}>Refresh</button>
      </div>
      {message && <div style={{ background: '#f1f5f9', padding: 11, borderRadius: 8, marginBottom: 16 }}>{message}</div>}

      <form onSubmit={addManual} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>+ ஆசிரியர் நேரடியாகச் சேர்க்க</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 9 }}>
          <label>தேதி<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required style={input} /></label>
          <label>பிரிவு<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="தமிழ்நாடு / இந்தியா / அறிவியல்..." required style={input} /></label>
          <label style={{ gridColumn: '1 / -1' }}>தலைப்பு (தமிழ்)<input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} required style={input} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Headline (English, optional)<input value={form.headlineEn} onChange={(e) => setForm({ ...form, headlineEn: e.target.value })} style={input} /></label>
          <label style={{ gridColumn: '1 / -1' }}>சுருக்கம் (தமிழ்)<textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} required rows={3} style={input} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Summary (English, optional)<textarea value={form.summaryEn} onChange={(e) => setForm({ ...form, summaryEn: e.target.value })} rows={3} style={input} /></label>
          <label style={{ gridColumn: '1 / -1' }}>தேர்வுக்கு முக்கியம் / நினைவில் வைக்க<textarea value={form.examRelevanceNote} onChange={(e) => setForm({ ...form, examRelevanceNote: e.target.value })} rows={2} style={input} /></label>
          <label style={{ gridColumn: '1 / -1' }}>ஆதார இணைப்பு<input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} style={input} /></label>
        </div>
        <button type="submit" style={{ marginTop: 12, background: '#b8860b', color: '#fff', border: 0, borderRadius: 7, padding: '9px 14px' }}>சேமிக்கவும்</button>
      </form>

      <h2 style={{ fontSize: 18 }}>வெளியிடப்பட்ட நிகழ்வுகள் ({items.length})</h2>
      {loading ? <p>Loading...</p> : items.map((item) => (
        <article key={item.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(item.date).toLocaleDateString('ta-IN', { timeZone: 'Asia/Kolkata' })}</div>
          <h3 style={{ margin: '5px 0' }}>{item.headline}</h3>
          <p style={{ margin: '5px 0', lineHeight: 1.6 }}>{item.summary}</p>
          {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>ஆதாரம்</a>}
          <button onClick={() => remove(item.id)} style={{ float: 'right', border: 0, background: 'transparent', color: '#b42318', cursor: 'pointer' }}>Delete</button>
        </article>
      ))}
    </div>
  );
}

const input: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 9px', font: 'inherit' };
