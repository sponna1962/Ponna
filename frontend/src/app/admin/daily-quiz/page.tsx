'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type QuizType = 'DAILY_QUIZ' | 'BRAIN_CHALLENGE';

type ParsedRow = {
  questionTextTa: string; optionATa: string; optionBTa: string; optionCTa: string; optionDTa: string;
  questionTextEn: string; optionAEn: string; optionBEn: string; optionCEn: string; optionDEn: string;
  correctOption: string; explanationTa: string; explanationEn: string;
};

type DailyQuiz = {
  id: string; quizDate: string; publishAt: string; expiresAt: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED';
  _count: { attempts: number };
};

type DailyQuizQuestion = ParsedRow & { id: string; sequenceNumber: number };

type Settings = {
  dailyQuizEnabled: boolean; dailyQuizDefaultPublishTime: string;
  brainChallengeEnabled: boolean; brainChallengeDefaultPublishTime: string;
};

const CSV_TEMPLATE_HEADER = 'Tamil Question,TA Option A,TA Option B,TA Option C,TA Option D,English Question,EN Option A,EN Option B,EN Option C,EN Option D,Correct Option,TA Explanation,EN Explanation';
const TABS: { type: QuizType; label: string; note: string }[] = [
  { type: 'DAILY_QUIZ', label: 'Current Affairs', note: '10 current-affairs/news questions.' },
  { type: 'BRAIN_CHALLENGE', label: 'Brain Challenge', note: '10 reasoning, logical thinking, observation, analytical thinking, and basic problem-solving questions.' },
];

export default function AdminDailyQuizPage() {
  const [activeType, setActiveType] = useState<QuizType>('DAILY_QUIZ');
  const [quizzes, setQuizzes] = useState<DailyQuiz[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DailyQuizQuestion[] | null>(null);
  const [viewTitle, setViewTitle] = useState('');

  const activeTab = TABS.find((t) => t.type === activeType)!;
  const enabledKey = activeType === 'DAILY_QUIZ' ? 'dailyQuizEnabled' : 'brainChallengeEnabled';
  const publishTimeKey = activeType === 'DAILY_QUIZ' ? 'dailyQuizDefaultPublishTime' : 'brainChallengeDefaultPublishTime';

  function load() {
    adminFetch(`/admin/daily-quiz?type=${activeType}`).then((r) => r.json()).then(setQuizzes);
    adminFetch('/admin/settings').then((r) => r.json()).then(setSettings);
  }
  useEffect(load, [activeType]);

  async function toggleEnabled() {
    if (!settings) return;
    const next = { ...settings, [enabledKey]: !settings[enabledKey] };
    await adminFetch('/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    setSettings(next);
  }

  async function generateCurrentAffairs() {
    setGenerating(true); setGenerateError(null); setGenerateMessage(null);
    try {
      const treeRes = await adminFetch('/admin/exam-taxonomy');
      const tree = await treeRes.json();
      let groupIvId: string | null = null;
      outer: for (const purpose of tree) for (const authority of purpose.authorities ?? []) for (const category of authority.categories ?? []) for (const sub of category.subCategories ?? []) {
        if (sub.name === 'Group - IV') { groupIvId = sub.id; break outer; }
      }
      if (!groupIvId) throw new Error('Group - IV Sub-Category not found');
      const res = await adminFetch('/admin/current-affairs/generate-today', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subCategoryId: groupIvId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to generate Current Affairs');
      setGenerateMessage(body.skippedNoResults ? 'No suitable current-affairs events were found.' : `Generated ${body.created} questions and placed them in Current Affairs Daily Quiz.`);
      load();
    } catch (err: any) {
      setGenerateError(err.message ?? 'Failed to generate Current Affairs');
    } finally { setGenerating(false); }
  }

  async function viewQuiz(id: string, label: string) {
    const res = await adminFetch(`/admin/daily-quiz/${id}`);
    const body = await res.json();
    if (!res.ok) { alert(body.error ?? 'Failed to load quiz'); return; }
    setViewTitle(label); setViewing(body.questions ?? []);
  }

  async function publishNow(q: DailyQuiz) {
    if (!confirm(`Publish this ${activeTab.label} now? It will be available for 24 hours.`)) return;
    const now = new Date();
    const ist = new Date(now.getTime() + 330 * 60 * 1000);
    const hhmm = `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`;
    const res = await adminFetch(`/admin/daily-quiz/${q.id}/schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publishTimeIst: hhmm }),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); alert(body.error ?? 'Failed to publish'); return; }
    setGenerateMessage('Publish time updated to now. The Daily Quiz status will change to PUBLISHED on the next status sweep.');
    load();
  }

  async function deleteQuiz(id: string) {
    if (!confirm(`Delete this ${activeTab.label} permanently, including any student attempts?`)) return;
    await adminFetch(`/admin/daily-quiz/${id}`, { method: 'DELETE' }); load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Daily Quiz (Current Affairs &amp; Brain Challenge)</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Current Affairs questions are created, reviewed and published here. They are completely separate from the normal Question Bank and are never saved as Question/DRAFT rows.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
        {TABS.map((tab) => <button key={tab.type} onClick={() => { setActiveType(tab.type); setGenerateMessage(null); setGenerateError(null); }} style={{ padding: '10px 18px', border: 'none', borderBottom: activeType === tab.type ? '2px solid #0f172a' : '2px solid transparent', background: 'none', fontWeight: activeType === tab.type ? 700 : 500, color: activeType === tab.type ? '#0f172a' : '#64748b', cursor: 'pointer' }}>{tab.label}</button>)}
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{activeTab.note}</p>

      {settings && <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}><input type="checkbox" checked={settings[enabledKey]} onChange={toggleEnabled} />{activeTab.label} is <b>{settings[enabledKey] ? 'LIVE' : '"Coming Soon" (hidden from students)'}</b></label>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Default publish time: {settings[publishTimeKey]} IST (edit in Settings)</span>
      </div>}

      {activeType === 'DAILY_QUIZ' && <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <b style={{ fontSize: 14 }}>AI Current Affairs Generator</b>
        <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 12px' }}>Generates 10 bilingual questions from the previous day&apos;s real news. The questions go directly into this Daily Quiz — never into Question Bank/DRAFT.</p>
        <button onClick={generateCurrentAffairs} disabled={generating} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600 }}>{generating ? 'Generating…' : "Generate Today's Current Affairs"}</button>
        {generateMessage && <p style={{ fontSize: 12, color: '#166534', marginTop: 10 }}>{generateMessage}</p>}
        {generateError && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{generateError}</p>}
      </div>}

      <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', marginBottom: 20 }}>+ Create {activeTab.label} Manually</button>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', fontSize: 12, color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}><th style={{ padding: 10 }}>Date (IST)</th><th style={{ padding: 10 }}>Publish (IST)</th><th style={{ padding: 10 }}>Expires (IST)</th><th style={{ padding: 10 }}>Status</th><th style={{ padding: 10 }}>Attempts</th><th style={{ padding: 10 }}>Actions</th></tr></thead>
        <tbody>
          {quizzes.map((q) => <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: 10 }}>{q.quizDate.slice(0, 10)}</td>
            <td style={{ padding: 10 }}>{new Date(q.publishAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            <td style={{ padding: 10 }}>{new Date(q.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            <td style={{ padding: 10 }}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: q.status === 'PUBLISHED' ? '#dcfce7' : q.status === 'EXPIRED' ? '#f1f5f9' : '#fef3c7', color: q.status === 'PUBLISHED' ? '#166534' : q.status === 'EXPIRED' ? '#64748b' : '#92400e' }}>{q.status}</span></td>
            <td style={{ padding: 10 }}>{q._count.attempts}</td>
            <td style={{ padding: 10, display: 'flex', gap: 6 }}>
              <button onClick={() => viewQuiz(q.id, `${activeTab.label} — ${q.quizDate.slice(0, 10)}`)} style={{ fontSize: 12, padding: '4px 10px' }}>Review</button>
              {q.status === 'SCHEDULED' && <button onClick={() => publishNow(q)} style={{ fontSize: 12, padding: '4px 10px', fontWeight: 600 }}>Publish Now</button>}
              <button onClick={() => deleteQuiz(q.id)} style={{ fontSize: 12, padding: '4px 10px', color: '#dc2626' }}>Delete</button>
            </td>
          </tr>)}
          {quizzes.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No {activeTab.label} entries yet.</td></tr>}
        </tbody>
      </table>

      {viewing && <ReviewModal title={viewTitle} questions={viewing} onClose={() => setViewing(null)} />}
      {showCreate && <CreateModal quizType={activeType} label={activeTab.label} defaultTime={settings?.[publishTimeKey] ?? '07:00'} onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function ReviewModal({ title, questions, onClose }: { title: string; questions: DailyQuizQuestion[]; onClose: () => void }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 20, maxWidth: 900, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h2 style={{ fontSize: 17 }}>{title}</h2><button onClick={onClose}>Close</button></div>
      {questions.map((q) => <div key={q.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 12 }}>
        <b>{q.sequenceNumber}. {q.questionTextTa}</b><p style={{ color: '#64748b', margin: '6px 0' }}>{q.questionTextEn}</p>
        <div style={{ fontSize: 13 }}><div>A. {q.optionATa} / {q.optionAEn}</div><div>B. {q.optionBTa} / {q.optionBEn}</div><div>C. {q.optionCTa} / {q.optionCEn}</div><div>D. {q.optionDTa} / {q.optionDEn}</div></div>
        <p style={{ fontSize: 12, marginTop: 8 }}><b>Correct:</b> {q.correctOption}</p><p style={{ fontSize: 12, color: '#475569' }}><b>தமிழ் விளக்கம்:</b> {q.explanationTa}</p><p style={{ fontSize: 12, color: '#475569' }}><b>English explanation:</b> {q.explanationEn}</p>
      </div>)}
    </div>
  </div>;
}

function CreateModal({ quizType, label, defaultTime, onClose, onCreated }: { quizType: QuizType; label: string; defaultTime: string; onClose: () => void; onCreated: () => void }) {
  const [quizDate, setQuizDate] = useState('');
  const [publishTime, setPublishTime] = useState(defaultTime);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    await validate(await file.text());
  }
  async function validate(text: string) {
    setValidating(true); setRows(null);
    const res = await adminFetch('/admin/daily-quiz/validate-csv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csvText: text }) });
    const body = await res.json(); setValidating(false); setRows(body.rows); setErrors(body.errors ?? []);
  }
  async function create() {
    if (!rows || errors.length > 0 || !quizDate) return;
    setCreating(true); setCreateError(null);
    const res = await adminFetch('/admin/daily-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizDate, publishTimeIst: publishTime, rows, quizType }) });
    setCreating(false);
    if (!res.ok) { const body = await res.json().catch(() => ({})); setCreateError(body.error ?? 'Failed to create'); return; }
    onCreated(); onClose();
  }
  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE_HEADER + '\n'], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${quizType === 'BRAIN_CHALLENGE' ? 'brain-challenge' : 'daily-quiz'}-template.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 20, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Create {label}</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}><label style={{ fontSize: 13 }}>Quiz Date (IST): <input type="date" value={quizDate} onChange={(e) => setQuizDate(e.target.value)} /></label><label style={{ fontSize: 13 }}>Publish Time (IST): <input type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} /></label></div>
      <button onClick={downloadTemplate} style={{ fontSize: 12, padding: '4px 10px', marginBottom: 10 }}>Download CSV Template</button>
      <div style={{ marginBottom: 12 }}><input type="file" accept=".csv" onChange={handleFile} /></div>
      {validating && <p style={{ fontSize: 13, color: '#64748b' }}>Validating…</p>}
      {errors.length > 0 && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 10, marginBottom: 12 }}>{errors.map((e, i) => <p key={i} style={{ fontSize: 12, color: '#991b1b', margin: '2px 0' }}>{e}</p>)}</div>}
      {rows && errors.length === 0 && <div style={{ marginBottom: 12 }}><p style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>✓ 10 questions validated</p>{rows.map((r, i) => <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginBottom: 8, fontSize: 12 }}><b>{i + 1}. {r.questionTextTa}</b><p>{r.questionTextEn}</p><p>Correct: {r.correctOption}</p></div>)}</div>}
      {createError && <p style={{ color: '#dc2626', fontSize: 13 }}>{createError}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button onClick={onClose}>Cancel</button><button onClick={create} disabled={!rows || errors.length > 0 || !quizDate || creating}>{creating ? '…' : 'Create & Schedule'}</button></div>
    </div>
  </div>;
}
