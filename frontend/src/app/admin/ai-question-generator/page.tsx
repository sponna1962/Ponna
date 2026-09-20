'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Node = { id: string; name: string; categories?: Node[]; subCategories?: Node[] };
type Run = {
  id: string; sourceName: string | null; exam: string; requestedCount: number;
  generatedCount: number; skippedCount: number; requestedDifficulty: string;
  status: string; estimatedCostUsd: number | null; createdAt: string;
};

const TYPES = [
  ['STATEMENT_BASED', 'Statement Based'], ['ASSERTION_REASON', 'Assertion – Reason'],
  ['MATCHING', 'Matching'], ['CHRONOLOGY', 'Chronology'],
  ['INCORRECT_STATEMENT', 'Incorrect Statement'], ['APPLICATION', 'Application'],
  ['STANDARD_MCq', 'Standard MCQ'],
];

export default function AiQuestionGeneratorPage() {
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'text'|'pdf'>('text');
  const [exam, setExam] = useState('TNPSC');
  const [difficulty, setDifficulty] = useState('ADVANCED');
  const [count, setCount] = useState('20');
  const [sourceName, setSourceName] = useState('');
  const [types, setTypes] = useState<string[]>(TYPES.map(x => x[0]).filter(x => x !== 'STANDARD_MCq'));
  const [tree, setTree] = useState<Node[]>([]);
  const [authority, setAuthority] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy').then(r => r.ok ? r.json() : []).then(setTree).catch(() => setTree([]));
    loadRuns();
  }, []);

  async function loadRuns() {
    const r = await adminFetch('/admin/ai-question-generator/runs?limit=20');
    if (r.ok) setRuns(await r.json());
  }

  const categories = useMemo(() => tree.find(x => x.id === authority)?.categories ?? [], [tree, authority]);
  const subs = useMemo(() => categories.find(x => x.id === category)?.subCategories ?? [], [categories, category]);

  function toggle(t: string) {
    setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }

  async function generate() {
    setMessage('');
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 100) return setMessage('கேள்விகளின் எண்ணிக்கை 1 முதல் 100 வரை இருக்க வேண்டும்.');
    if (mode === 'text' && source.trim().length < 50) return setMessage('குறைந்தது 50 எழுத்துகள் கொண்ட மூலப் பாடத்தை கொடுக்கவும்.');
    if (mode === 'pdf' && !file) return setMessage('PDF கோப்பை தேர்வு செய்யவும்.');
    if (!types.length) return setMessage('குறைந்தது ஒரு கேள்வி வகையை தேர்வு செய்யவும்.');

    setGenerating(true);
    try {
      let r: Response;
      if (mode === 'pdf') {
        const f = new FormData();
        f.append('file', file!); f.append('count', String(n)); f.append('exam', exam);
        f.append('difficulty', difficulty); f.append('questionTypes', JSON.stringify(types));
        if (subCategory) f.append('subCategoryId', subCategory);
        if (sourceName.trim()) f.append('sourceName', sourceName.trim());
        r = await adminFetch('/admin/ai-question-generator/generate-pdf', { method: 'POST', body: f });
      } else {
        r = await adminFetch('/admin/ai-question-generator/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText: source, count: n, exam, difficulty, questionTypes: types,
            subCategoryId: subCategory || undefined, sourceName: sourceName.trim() || undefined,
          }),
        });
      }
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'Generation failed');
      setMessage(body.generated + ' கேள்வித் தொகுப்புகள் உருவாக்கப்பட்டன. ' + body.skipped + ' நிராகரிக்கப்பட்டன. அனைத்தும் DRAFT.');
      await loadRuns();
    } catch (e: any) {
      setMessage(e.message || 'Generation failed');
      await loadRuns();
    } finally { setGenerating(false); }
  }

  return (
    <div style={{maxWidth:1100,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{margin:0,fontSize:24}}>AI Question Generator</h1>
          <p style={{color:'#64748b',fontSize:13}}>Gemini மூலம் source material-ல் இருந்து தமிழ் + English கேள்விகள். AI verification முடிந்த பிறகு DRAFT ஆக மட்டும் சேமிக்கப்படும்.</p>
        </div>
        <Link href="/admin/questions?status=DRAFT" style={link}>DRAFT Question Bank →</Link>
      </div>

      {message && <div style={{padding:12,marginBottom:14,borderRadius:8,background:'#f1f5f9',fontSize:13}}>{message}</div>}

      <section style={card}>
        <h2 style={h2}>1. Source Material</h2>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <button onClick={() => setMode('text')} style={pill(mode==='text')}>Paste Text</button>
          <button onClick={() => setMode('pdf')} style={pill(mode==='pdf')}>Upload PDF</button>
        </div>
        {mode === 'text'
          ? <textarea value={source} onChange={e=>setSource(e.target.value)} rows={14} placeholder="அதிகாரப்பூர்வ பாடக்குறிப்பு / study material-ஐ இங்கே ஒட்டவும்..." style={textarea}/>
          : <div><input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0] || null)}/><p style={muted}>Text-based PDF மட்டும். Scanned PDF-க்கு OCR இல்லை.</p></div>}
        <input value={sourceName} onChange={e=>setSourceName(e.target.value)} placeholder="Source name" style={{...input,marginTop:10}}/>
      </section>

      <section style={card}>
        <h2 style={h2}>2. Question Settings</h2>
        <div style={grid}>
          <label style={label}>Exam<select value={exam} onChange={e=>setExam(e.target.value)} style={input}><option>TNPSC</option><option>UPSC</option><option>OTHER</option></select></label>
          <label style={label}>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)} style={input}><option>BASIC</option><option>MODERATE</option><option>ADVANCED</option><option>EXPERT</option></select></label>
          <label style={label}>Question pairs<input type="number" min="1" max="100" value={count} onChange={e=>setCount(e.target.value)} style={input}/></label>
        </div>
        <div style={{marginTop:14}}><div style={label}>Question Types</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>
          {TYPES.map(([v,l])=><button key={v} onClick={()=>toggle(v)} style={pill(types.includes(v))}>{l}</button>)}
        </div></div>
      </section>

      <section style={card}>
        <h2 style={h2}>3. Exam Classification (optional)</h2>
        <div style={grid}>
          <label style={label}>Authority<select value={authority} onChange={e=>{setAuthority(e.target.value);setCategory('');setSubCategory('')}} style={input}><option value="">Not selected</option>{tree.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label style={label}>Category<select value={category} disabled={!authority} onChange={e=>{setCategory(e.target.value);setSubCategory('')}} style={input}><option value="">Not selected</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label style={label}>Sub-Category / Exam<select value={subCategory} disabled={!category} onChange={e=>setSubCategory(e.target.value)} style={input}><option value="">Not selected</option>{subs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>4. Generate</h2>
        <button disabled={generating} onClick={generate} style={primary}>{generating ? 'Generating & verifying…' : 'Generate Questions'}</button>
        <p style={muted}>Free-tier friendly batching. Generation + verification. Duplicate questions are rejected.</p>
      </section>

      <section style={card}>
        <h2 style={h2}>Recent Generation Runs</h2>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>{['Time','Source','Exam','Requested','Generated','Skipped','Status','Cost'].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead>
            <tbody>{runs.map(r=><tr key={r.id}>
              <td style={td}>{new Date(r.createdAt).toLocaleString()}</td><td style={td}>{r.sourceName || '—'}</td><td style={td}>{r.exam}</td>
              <td style={td}>{r.requestedCount} / {r.requestedDifficulty}</td><td style={td}>{r.generatedCount}</td><td style={td}>{r.skippedCount}</td>
              <td style={td}>{r.status}</td><td style={td}>{r.estimatedCostUsd == null ? '—' : '$'+r.estimatedCostUsd.toFixed(4)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const card: React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:18,marginBottom:16};
const h2: React.CSSProperties={fontSize:16,margin:'0 0 12px'};
const input: React.CSSProperties={width:'100%',padding:'8px 10px',border:'1px solid #cbd5e1',borderRadius:6,fontSize:13,boxSizing:'border-box',background:'#fff'};
const textarea: React.CSSProperties={...input,resize:'vertical',lineHeight:1.6};
const label: React.CSSProperties={display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'#334155'};
const grid: React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12};
const muted: React.CSSProperties={fontSize:12,color:'#64748b'};
const th: React.CSSProperties={textAlign:'left',padding:8,borderBottom:'1px solid #e2e8f0',color:'#64748b'};
const td: React.CSSProperties={padding:8,borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'};
const primary: React.CSSProperties={padding:'9px 16px',borderRadius:7,border:0,background:'#0f172a',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'};
const link: React.CSSProperties={padding:'8px 12px',border:'1px solid #cbd5e1',borderRadius:7,textDecoration:'none',color:'#0f172a',fontSize:13};
function pill(active:boolean):React.CSSProperties{return {padding:'7px 11px',borderRadius:20,border:'1px solid '+(active?'#0f172a':'#cbd5e1'),background:active?'#0f172a':'#fff',color:active?'#fff':'#334155',fontSize:12,cursor:'pointer'};}
