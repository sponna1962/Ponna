'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SubjectInput } from '../../../components/SubjectInput';
import { adminFetch } from '../../../lib/admin-fetch';
import { ExamTaxonomyPicker, TaxonomyValue } from '../../../components/ExamTaxonomyPicker';

// Question Management — bilingual add form with the new Authority → Category
// → Sub-Category classification, Source Type metadata, bulk select actions,
// and search.

type Question = {
  id: string;
  questionText: string;
  correctOption: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DISABLED';
  difficulty: 'MEDIUM' | 'HARD' | null;
  aiSuggestedDifficulty: 'MEDIUM' | 'HARD' | null;
  aiConfidence: number | null;
  language: 'TA' | 'EN';
  examYear: number | null;
  translationGroupId: string | null;
  authority: { name: string } | null;
  examCategory: { name: string } | null;
  subCategory: { name: string } | null;
  sourceType: 'PREVIOUS_EXAM' | 'BOOK' | 'ORIGINAL' | 'OTHER';
};

const emptyLangFields = { questionText: '', optionA: '', optionB: '', optionC: '', optionD: '' };
const emptyTaxonomy: TaxonomyValue = { authorityId: '', categoryId: '', subCategoryId: '' };

const SOURCE_TYPES = [
  { value: 'ORIGINAL', label: 'Original / Admin Created' },
  { value: 'PREVIOUS_EXAM', label: 'Previous Exam' },
  { value: 'BOOK', label: 'Book / Study Material' },
  { value: 'OTHER', label: 'Other' },
];

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [statusFilter, setStatusFilter] = useState('DRAFT');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [taxonomyFilter, setTaxonomyFilter] = useState<TaxonomyValue>(emptyTaxonomy);
  const [languageFilter, setLanguageFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingAiCount, setPendingAiCount] = useState(0);
  const [classifying, setClassifying] = useState<{ done: number; total: number; stopped: boolean } | null>(null);
  const stopRequestedRef = useRef(false);
  const PAGE_SIZE = 100;

  const [showForm, setShowForm] = useState(false);
  const [ta, setTa] = useState(emptyLangFields);
  const [en, setEn] = useState(emptyLangFields);
  const [correctOption, setCorrectOption] = useState('A');
  const [taxonomy, setTaxonomy] = useState<TaxonomyValue>(emptyTaxonomy);
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [sourceType, setSourceType] = useState('ORIGINAL');
  const [sourceName, setSourceName] = useState('');
  const [translating, setTranslating] = useState<'ta' | 'en' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /** Builds the current filter as query params — shared by loadQuestions()
   * (paginated) and selectAllMatchingFilter() (unpaginated ids) so they
   * always agree on exactly what "matches" right now. */
  function buildFilterParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (statusFilter === 'PENDING_AI') {
      params.set('noDifficultyOnly', 'true'); // every status included — this is the "Waiting for AI" view
    } else {
      params.set('status', statusFilter);
    }
    if (search.trim()) params.set('search', search.trim());
    if (taxonomyFilter.authorityId) params.set('authorityId', taxonomyFilter.authorityId);
    if (taxonomyFilter.categoryId) params.set('categoryId', taxonomyFilter.categoryId);
    if (taxonomyFilter.subCategoryId) params.set('subCategoryId', taxonomyFilter.subCategoryId);
    if (languageFilter) params.set('language', languageFilter);
    return params;
  }

  async function loadQuestions() {
    const params = buildFilterParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    const res = await adminFetch(`/admin/questions?${params.toString()}`);
    const data = await res.json();
    setQuestions(data.items ?? []);
    setTotal(data.total ?? 0);
    setSelected(new Set());
  }

  /** Selects every question matching the current filter — not just the
   * ones on this page — so a bulk action (Classify, Set Difficulty,
   * Publish...) can apply to all 499 "Waiting for AI" in one go instead of
   * page by page. */
  async function selectAllMatchingFilter() {
    const params = buildFilterParams();
    const res = await adminFetch(`/admin/questions/ids?${params.toString()}`);
    const data = await res.json();
    setSelected(new Set(data.ids ?? []));
  }

  /** Refreshes the "Waiting for AI (N)" tab's badge count, independent of
   * whatever status/filter is currently being viewed — so the number stays
   * accurate even while looking at the Draft or Published tab. */
  async function loadPendingAiCount() {
    const res = await adminFetch('/admin/questions?noDifficultyOnly=true&page=1&pageSize=1');
    const data = await res.json();
    setPendingAiCount(data.total ?? 0);
  }

  useEffect(() => {
    loadQuestions();
    loadPendingAiCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, taxonomyFilter, languageFilter]);

  // Any filter change (status/taxonomy) should snap back to page 1 — staying
  // on e.g. page 3 of a now-much-smaller filtered result shows an empty list.
  function updateTaxonomyFilter(v: TaxonomyValue) {
    setTaxonomyFilter(v);
    setPage(1);
  }
  function updateStatusFilter(s: string) {
    setStatusFilter(s);
    setPage(1);
  }
  function updateLanguageFilter(l: string) {
    setLanguageFilter(l);
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === questions.length ? new Set() : new Set(questions.map((q) => q.id))));
  }

  async function autoTranslate(fromLang: 'ta' | 'en') {
    const source = fromLang === 'ta' ? ta : en;
    if (!source.questionText.trim() || !source.optionA || !source.optionB || !source.optionC || !source.optionD) return;

    setTranslating(fromLang === 'ta' ? 'en' : 'ta');
    try {
      const res = await adminFetch('/admin/questions/translate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: source, fromLang: fromLang.toUpperCase() }),
      });
      if (res.ok) {
        const translated = await res.json();
        fromLang === 'ta' ? setEn(translated) : setTa(translated);
      }
    } finally {
      setTranslating(null);
    }
  }

  function startAdd() {
    setTa(emptyLangFields);
    setEn(emptyLangFields);
    setCorrectOption('A');
    setTaxonomy(emptyTaxonomy);
    setExamName('');
    setExamYear('');
    setSubjectName('');
    setSourceType('ORIGINAL');
    setSourceName('');
    setFormError(null);
    setShowForm(true);
  }

  async function submitBilingual() {
    setFormError(null);
    const hasTa = ta.questionText.trim().length > 0;
    const hasEn = en.questionText.trim().length > 0;
    if (!hasTa && !hasEn) {
      setFormError('Enter the question in at least one language.');
      return;
    }

    const shared = {
      correctOption,
      authorityId: taxonomy.authorityId || undefined,
      categoryId: taxonomy.categoryId || undefined,
      subCategoryId: taxonomy.subCategoryId || undefined,
      examName: examName.trim() || undefined,
      examYear: examYear ? Number(examYear) : undefined,
      subjectName: subjectName.trim() || undefined,
      sourceType,
      sourceName: sourceName.trim() || undefined,
    };

    const res = await adminFetch('/admin/questions/bilingual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ta: hasTa ? { ...ta, ...shared } : { ...emptyLangFields, ...shared },
        en: hasEn ? { ...en, ...shared } : { ...emptyLangFields, ...shared },
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setFormError(body.error ?? 'Failed to save question');
      return;
    }
    setShowForm(false);
    loadQuestions();
    loadPendingAiCount();
  }

  async function setStatus(id: string, action: 'publish' | 'disable' | 'draft') {
    const res = await adminFetch(`/admin/questions/${id}/${action}`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? 'Action failed');
      return;
    }
    loadQuestions();
    loadPendingAiCount();
  }

  async function setDifficulty(id: string, difficulty: string) {
    await adminFetch(`/admin/questions/${id}/difficulty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty }),
    });
    loadQuestions();
    loadPendingAiCount();
  }

  async function classifyNow(id: string) {
    const res = await adminFetch(`/admin/questions/${id}/classify`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`AI classification failed: ${body.error ?? 'Unknown error'}`);
      return;
    }
    loadQuestions();
    loadPendingAiCount();
  }

  async function bulkAction(action: 'bulk-publish' | 'bulk-disable' | 'bulk-delete' | 'bulk-force-delete') {
    if (selected.size === 0) return;
    if (action === 'bulk-delete' && !confirm(`Delete ${selected.size} question(s)? This cannot be undone.`)) return;
    if (
      action === 'bulk-force-delete' &&
      !confirm(
        `⚠️ FORCE DELETE ${selected.size} question(s) PERMANENTLY, including any student answer history?\n\nThis is a QA/testing tool only — never use this once real students have used the platform. Their stats for these questions will be lost.\n\nThis cannot be undone.`,
      )
    )
      return;

    const res = await adminFetch(`/admin/questions/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Action failed: ${body.error ?? 'Unknown error'}`);
    } else if (action === 'bulk-publish') {
      const body = await res.json();
      if (body.skippedNoDifficulty > 0) {
        alert(`${body.count} question(s) published. ${body.skippedNoDifficulty} question(s) were skipped — they have no Difficulty set yet, so publishing them would leave them invisible to every student. Set a Difficulty (or run AI Classify) on those first.`);
      }
    } else if (action === 'bulk-delete') {
      const body = await res.json();
      if (body.disabledInstead > 0) {
        alert(`${body.count} question(s) deleted. ${body.disabledInstead} question(s) already have student answer history, so they were disabled instead (can't be deleted without corrupting that student's stats).`);
      }
    }
    loadQuestions();
    loadPendingAiCount();
  }

  /**
   * Classifies the selected questions ONE AT A TIME from the frontend
   * (instead of one big blocking backend call) so the admin gets: a live
   * "N of M" progress readout, AND a real Stop button — the loop checks
   * stopRequestedRef before starting each question, so pressing Stop takes
   * effect immediately after whichever call is currently in flight
   * finishes (already-classified questions stay classified; the rest are
   * simply left untouched, exactly as if they'd never been selected).
   */
  async function classifySelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    stopRequestedRef.current = false;
    setClassifying({ done: 0, total: ids.length, stopped: false });

    let autoPublished = 0;
    let needsReview = 0;
    let failed = 0;
    let stoppedEarly = false;

    for (let i = 0; i < ids.length; i++) {
      if (stopRequestedRef.current) {
        stoppedEarly = true;
        break;
      }
      try {
        const res = await adminFetch(`/admin/questions/${ids[i]}/classify`, { method: 'POST' });
        if (res.ok) {
          const body = await res.json();
          body.autoPublished ? autoPublished++ : needsReview++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setClassifying((c) => (c ? { ...c, done: i + 1 } : c));
    }

    setClassifying(null);
    alert(
      `Classified ${autoPublished + needsReview + failed} of ${ids.length} question(s)${stoppedEarly ? ' (stopped early)' : ''}: ` +
        `${autoPublished} auto-published (high confidence), ${needsReview} sent to Needs Review.` +
        (failed > 0 ? ` ${failed} FAILED (Gemini API error — check Render logs; nothing changed for these, they still show no Difficulty).` : ''),
    );
    loadQuestions();
    loadPendingAiCount();
  }

  /** Applies the admin's own Medium/Hard decision to every selected
   * question in one action — no AI, no guessing; the choice is theirs. */
  async function bulkSetDifficulty(difficulty: 'MEDIUM' | 'HARD') {
    if (selected.size === 0) return;
    if (!confirm(`Set Difficulty = ${difficulty} for ${selected.size} selected question(s)?`)) return;

    const res = await adminFetch('/admin/questions/bulk-set-difficulty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), difficulty }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Action failed: ${body.error ?? 'Unknown error'}`);
    } else {
      const body = await res.json();
      alert(`Set Difficulty = ${difficulty} for ${body.count} question(s). Any that were Draft are now Published.`);
    }
    loadQuestions();
    loadPendingAiCount();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20 }}>Questions</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/admin/questions/stats"
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            📊 Question Bank Stats
          </Link>
          <button
            onClick={() => (showForm ? setShowForm(false) : startAdd())}
            style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}
          >
            {showForm ? 'Cancel' : '+ Add Question'}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 24, maxWidth: 900 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: '#64748b' }}>
            New Question — type in either language, the other auto-fills when you click away
          </h2>
          <div style={{ display: 'flex', gap: 16 }}>
            <LangFormBlock label={`Tamil ${translating === 'ta' ? '(translating…)' : ''}`} fields={ta} setFields={setTa} onBlurQuestion={() => autoTranslate('ta')} />
            <LangFormBlock label={`English ${translating === 'en' ? '(translating…)' : ''}`} fields={en} setFields={setEn} onBlurQuestion={() => autoTranslate('en')} />
          </div>

          <div style={{ marginTop: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>
              Correct:{' '}
              <select value={correctOption} onChange={(e) => setCorrectOption(e.target.value)}>
                {['A', 'B', 'C', 'D'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginBottom: 12 }}>
            <ExamTaxonomyPicker value={taxonomy} onChange={setTaxonomy} />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>
              Exam Name (optional):{' '}
              <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Assistant Public Prosecutor, Grade II" style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 220 }} />
            </label>
            <label style={{ fontSize: 13 }}>
              Exam Year (optional):{' '}
              <input type="number" value={examYear} onChange={(e) => setExamYear(e.target.value)} placeholder="2024" style={{ width: 80, padding: 4, borderRadius: 4, border: '1px solid #cbd5e1' }} />
            </label>
            <SubjectInput value={subjectName} onChange={setSubjectName} />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>
              Source Type:{' '}
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              Source Name (optional, admin-only):{' '}
              <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. TNPSC Group IV Question Paper" style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 220 }} />
            </label>
          </div>

          <button onClick={submitBilingual} style={{ padding: '8px 20px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
            Save as Draft (both languages)
          </button>
          {formError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{formError}</p>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {['DRAFT', 'PUBLISHED', 'DISABLED'].map((s) => (
          <button
            key={s}
            onClick={() => updateStatusFilter(s)}
            style={{ padding: '6px 14px', borderRadius: 16, border: '1px solid #cbd5e1', background: statusFilter === s ? '#0f172a' : '#fff', color: statusFilter === s ? '#fff' : '#334155', fontSize: 13 }}
          >
            {s}
          </button>
        ))}
        {/* "Waiting for AI" — every question (any status) with no Difficulty
            yet, whether it was never classified or the AI call failed
            (e.g. Gemini out of credits, as happened before). */}
        <button
          onClick={() => updateStatusFilter('PENDING_AI')}
          style={{
            padding: '6px 14px',
            borderRadius: 16,
            border: '1px solid #f59e0b',
            background: statusFilter === 'PENDING_AI' ? '#f59e0b' : '#fff',
            color: statusFilter === 'PENDING_AI' ? '#fff' : '#b45309',
            fontSize: 13,
          }}
        >
          ⏳ Waiting for AI ({pendingAiCount})
        </button>
        <input
          placeholder="Search question text..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), loadQuestions())}
          style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 220 }}
        />
        <button onClick={() => { setPage(1); loadQuestions(); }} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13 }}>Search</button>
      </div>

      {/* Authority → Category → Sub-Category filter — narrows the list down
          to one exam tier instead of scrolling through everything. */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <ExamTaxonomyPicker value={taxonomyFilter} onChange={updateTaxonomyFilter} />
        <label style={{ fontSize: 13 }}>
          Language:{' '}
          <select value={languageFilter} onChange={(e) => updateLanguageFilter(e.target.value)}>
            <option value="">— (எல்லாம்)</option>
            <option value="TA">தமிழ்</option>
            <option value="EN">English</option>
          </select>
        </label>
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#334155' }}>{selected.size} selected</span>

          {/* Shown only when this page's rows are ALL selected AND more
              matching rows exist beyond this page — offers to extend the
              selection to everything matching the current filter, not just
              what's visible right now. */}
          {!classifying && selected.size === questions.length && total > questions.length && (
            <button onClick={selectAllMatchingFilter} style={{ fontSize: 12, padding: '6px 12px', fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 4 }}>
              Select all {total} matching this filter
            </button>
          )}

          {classifying ? (
            <>
              <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                ⏳ Classifying... ({classifying.done} of {classifying.total})
              </span>
              <button
                onClick={() => (stopRequestedRef.current = true)}
                style={{ fontSize: 12, padding: '6px 12px', color: '#fff', background: '#dc2626', border: '1px solid #dc2626', borderRadius: 4 }}
              >
                ⏹ Stop
              </button>
            </>
          ) : (
            <>
              <button onClick={classifySelected} style={{ fontSize: 12, padding: '6px 12px' }}>Classify Selected with AI</button>
              <button onClick={() => bulkSetDifficulty('MEDIUM')} style={{ fontSize: 12, padding: '6px 12px' }}>Set Difficulty: Medium</button>
              <button onClick={() => bulkSetDifficulty('HARD')} style={{ fontSize: 12, padding: '6px 12px' }}>Set Difficulty: Hard</button>
              <button onClick={() => bulkAction('bulk-publish')} style={{ fontSize: 12, padding: '6px 12px' }}>Publish Selected</button>
              <button onClick={() => bulkAction('bulk-disable')} style={{ fontSize: 12, padding: '6px 12px' }}>Disable Selected</button>
              <button onClick={() => bulkAction('bulk-delete')} style={{ fontSize: 12, padding: '6px 12px', color: '#dc2626' }}>Delete Selected</button>
              <button onClick={() => bulkAction('bulk-force-delete')} style={{ fontSize: 12, padding: '6px 12px', color: '#fff', background: '#dc2626', border: '1px solid #dc2626', borderRadius: 4 }}>
                🧪 Force Delete (QA only)
              </button>
            </>
          )}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#64748b' }}>
            <th style={{ padding: 10 }}>
              <input type="checkbox" checked={selected.size === questions.length && questions.length > 0} onChange={toggleSelectAll} />
            </th>
            <th style={{ padding: 10 }}>Question</th>
            <th style={{ padding: 10 }}>Lang</th>
            <th style={{ padding: 10 }}>Classification</th>
            <th style={{ padding: 10 }}>Source</th>
            <th style={{ padding: 10 }}>Difficulty</th>
            <th style={{ padding: 10 }}>AI Suggestion</th>
            <th style={{ padding: 10 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <td style={{ padding: 10 }}>
                <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} />
              </td>
              <td style={{ padding: 10, maxWidth: 300 }}>
                {q.questionText}
                {q.translationGroupId && <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>🔗</span>}
                {!q.difficulty && <div style={{ color: '#d97706', fontSize: 11, marginTop: 4 }}>⚠ No difficulty set — won't appear in any student quiz</div>}
              </td>
              <td style={{ padding: 10 }}>{q.language}</td>
              <td style={{ padding: 10, color: '#64748b', fontSize: 12 }}>
                {q.authority ? `${q.authority.name}${q.examCategory ? ' → ' + q.examCategory.name : ''}${q.subCategory ? ' → ' + q.subCategory.name : ''}` : '—'}
                {q.examYear && <div>{q.examYear}</div>}
              </td>
              <td style={{ padding: 10, color: '#64748b', fontSize: 12 }}>{SOURCE_TYPES.find((s) => s.value === q.sourceType)?.label ?? q.sourceType}</td>
              <td style={{ padding: 10 }}>
                <select value={q.difficulty ?? ''} onChange={(e) => setDifficulty(q.id, e.target.value)}>
                  <option value="">—</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </td>
              <td style={{ padding: 10, color: '#64748b' }}>
                {q.aiSuggestedDifficulty ? `${q.aiSuggestedDifficulty} (${q.aiConfidence?.toFixed(0)}%)` : '—'}
              </td>
              <td style={{ padding: 10 }}>
                {q.status !== 'PUBLISHED' && <button onClick={() => setStatus(q.id, 'publish')} style={{ marginRight: 8, fontSize: 12 }}>Publish</button>}
                {q.status !== 'DISABLED' && <button onClick={() => setStatus(q.id, 'disable')} style={{ marginRight: 8, fontSize: 12 }}>Disable</button>}
                {q.status === 'DRAFT' && !q.aiSuggestedDifficulty && <button onClick={() => classifyNow(q.id)} style={{ fontSize: 12 }}>Classify with AI</button>}
              </td>
            </tr>
          ))}
          {questions.length === 0 && (
            <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No questions in this status.</td></tr>
          )}
        </tbody>
      </table>

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16, fontSize: 13 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: page <= 1 ? '#f1f5f9' : '#fff' }}>
            ◀ முந்தையது
          </button>
          <span style={{ color: '#64748b' }}>
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))} — {total} question{total === 1 ? '' : 's'} total
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * PAGE_SIZE >= total}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: page * PAGE_SIZE >= total ? '#f1f5f9' : '#fff' }}
          >
            அடுத்தது ▶
          </button>
        </div>
      )}
    </div>
  );
}

function LangFormBlock({
  label,
  fields,
  setFields,
  onBlurQuestion,
}: {
  label: string;
  fields: typeof emptyLangFields;
  setFields: (f: typeof emptyLangFields) => void;
  onBlurQuestion: () => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ fontSize: 13, color: '#0f172a', marginBottom: 8 }}>{label}</h3>
      <textarea
        placeholder="Question text"
        value={fields.questionText}
        onChange={(e) => setFields({ ...fields, questionText: e.target.value })}
        onBlur={onBlurQuestion}
        style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        rows={2}
      />
      {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((opt, i) => (
        <input
          key={opt}
          placeholder={`Option ${String.fromCharCode(65 + i)}`}
          value={fields[opt]}
          onChange={(e) => setFields({ ...fields, [opt]: e.target.value })}
          style={{ width: '100%', padding: 6, marginBottom: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
        />
      ))}
    </div>
  );
}
