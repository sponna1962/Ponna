'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SubjectInput } from '../../../components/SubjectInput';
import { adminFetch } from '../../../lib/admin-fetch';
import { ExamTaxonomyPicker, TaxonomyValue } from '../../../components/ExamTaxonomyPicker';
import { MultiTaxonomyTagPicker, TaxonomyTag } from '../../../components/MultiTaxonomyTagPicker';

// Question Management — bilingual add form with the new Authority → Category
// → Sub-Category classification, Source Type metadata, bulk select actions,
// and search.

type Question = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DISABLED';
  difficulty: 'MEDIUM' | 'HARD' | null;
  aiSuggestedDifficulty: 'MEDIUM' | 'HARD' | null;
  aiConfidence: number | null;
  language: 'TA' | 'EN';
  examName: string | null;
  examYear: number | null;
  translationGroupId: string | null;
  authority: { name: string } | null;
  examCategory: { name: string } | null;
  subCategory: { name: string } | null;
  subject: { name: string } | null;
  sourceType: 'PREVIOUS_EXAM' | 'BOOK' | 'ORIGINAL' | 'OTHER';
  sourceName: string | null;
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
  return (
    <Suspense fallback={<div style={{ padding: 20, color: '#64748b' }}>Loading…</div>}>
      <AdminQuestionsPageInner />
    </Suspense>
  );
}

function AdminQuestionsPageInner() {
  const searchParams = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  // Initial values read directly from the URL's query string via
  // useSearchParams() (not window.location.search) — this hook reactively
  // reflects the CURRENT URL even when Next.js reuses this page's
  // component instance across navigations to the same route with
  // different query params (e.g. clicking one Question Bank Stats count,
  // going back, then clicking a different one) — a one-time
  // window.location.search read in a lazy initializer only fires on the
  // very first mount and would miss every navigation after that.
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'DRAFT');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [taxonomyFilter, setTaxonomyFilter] = useState<TaxonomyValue>(() => {
    const authorityId = searchParams.get('authorityId');
    const categoryId = searchParams.get('categoryId');
    const subCategoryId = searchParams.get('subCategoryId');
    return authorityId || categoryId || subCategoryId
      ? { authorityId: authorityId ?? '', categoryId: categoryId ?? '', subCategoryId: subCategoryId ?? '' }
      : emptyTaxonomy;
  });
  const [languageFilter, setLanguageFilter] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingAiCount, setPendingAiCount] = useState(0);

  // Re-syncs whenever the URL's query string actually changes — covers
  // the "component instance reused across navigations" case the lazy
  // initializers above can't (those only run once, on first mount).
  useEffect(() => {
    const status = searchParams.get('status');
    const authorityId = searchParams.get('authorityId');
    const categoryId = searchParams.get('categoryId');
    const subCategoryId = searchParams.get('subCategoryId');
    if (status || authorityId || categoryId || subCategoryId) {
      setStatusFilter(status || 'DRAFT');
      setTaxonomyFilter({ authorityId: authorityId ?? '', categoryId: categoryId ?? '', subCategoryId: subCategoryId ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
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
    if (sourceTypeFilter) params.set('sourceType', sourceTypeFilter);
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

  // Pre-fills the status/taxonomy filters from the URL's query string on
  // first load — this is how a click on a number in Question Bank Stats
  // (status + authorityId/categoryId/subCategoryId) lands here already
  // filtered to exactly those questions. See the useState initializers
  // above — the actual read happens there, before the first render, so
  // there's no separate effect needed here anymore.

  useEffect(() => {
    loadQuestions();
    loadPendingAiCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, taxonomyFilter, languageFilter, sourceTypeFilter]);

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

  function updateSourceTypeFilter(s: string) {
    setSourceTypeFilter(s);
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

  // ── Edit (single row, in place — a Question row is one language, unlike
  // the bilingual Add form above) ────────────────────────────────────────
  const [editing, setEditing] = useState<Question | null>(null);
  const [editFields, setEditFields] = useState(emptyLangFields);
  const [editExamName, setEditExamName] = useState('');
  const [editExamYear, setEditExamYear] = useState('');
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSourceName, setEditSourceName] = useState('');
  const [editCorrectOption, setEditCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Heuristic auto-classify (one-time, agreed rule) ──────────────────
  const [heuristicPreview, setHeuristicPreview] = useState<{ total: number; medium: number; hard: number } | null>(null);
  const [heuristicApplying, setHeuristicApplying] = useState(false);
  const [heuristicResult, setHeuristicResult] = useState<{ medium: number; hard: number } | null>(null);
  const [heuristicError, setHeuristicError] = useState<string | null>(null);

  async function openHeuristicPreview() {
    setHeuristicError(null);
    setHeuristicResult(null);
    setHeuristicPreview(null);
    const res = await adminFetch('/admin/questions/heuristic-classify/preview');
    if (!res.ok) {
      setHeuristicError('Failed to load preview');
      setHeuristicPreview({ total: -1, medium: 0, hard: 0 }); // sentinel to still open the modal with the error
      return;
    }
    setHeuristicPreview(await res.json());
  }

  async function applyHeuristicClassification() {
    setHeuristicApplying(true);
    setHeuristicError(null);
    const res = await adminFetch('/admin/questions/heuristic-classify/apply', { method: 'POST' });
    setHeuristicApplying(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setHeuristicError(body.error ?? 'Failed to apply');
      return;
    }
    setHeuristicResult(await res.json());
    loadQuestions();
    loadPendingAiCount();
  }

  // ── Bulk Edit Metadata (Source Type, Category/Sub-Category, Exam Name,
  // Subject, Source Name) across the whole current selection at once —
  // each field left blank is untouched on every selected question. ──────
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkTaxonomy, setBulkTaxonomy] = useState<TaxonomyValue>(emptyTaxonomy);
  const [bulkAdditionalTags, setBulkAdditionalTags] = useState<TaxonomyTag[]>([]);
  const [bulkSourceType, setBulkSourceType] = useState('');
  const [bulkExamName, setBulkExamName] = useState('');
  const [bulkSubjectName, setBulkSubjectName] = useState('');
  const [bulkSourceName, setBulkSourceName] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{ count: number } | null>(null);

  function openBulkEdit() {
    setBulkTaxonomy(emptyTaxonomy);
    setBulkAdditionalTags([]);
    setBulkSourceType('');
    setBulkExamName('');
    setBulkSubjectName('');
    setBulkSourceName('');
    setBulkError(null);
    setBulkResult(null);
    setBulkEditOpen(true);
  }

  async function applyBulkEdit() {
    const fields: Record<string, string> = {};
    if (bulkSourceType) fields.sourceType = bulkSourceType;
    if (bulkTaxonomy.categoryId) fields.categoryId = bulkTaxonomy.categoryId;
    if (bulkTaxonomy.subCategoryId) fields.subCategoryId = bulkTaxonomy.subCategoryId;
    if (bulkExamName.trim()) fields.examName = bulkExamName.trim();
    if (bulkSubjectName.trim()) fields.subjectName = bulkSubjectName.trim();
    if (bulkSourceName.trim()) fields.sourceName = bulkSourceName.trim();

    if (Object.keys(fields).length === 0 && bulkAdditionalTags.length === 0) {
      setBulkError('Fill in at least one field to change.');
      return;
    }

    setBulkSaving(true);
    setBulkError(null);
    const res = await adminFetch('/admin/questions/bulk-update-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), ...fields, additionalTags: bulkAdditionalTags.length > 0 ? bulkAdditionalTags : undefined }),
    });
    setBulkSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setBulkError(body.error ?? 'Failed to save');
      return;
    }
    setBulkResult(await res.json());
    loadQuestions();
  }

  function startEdit(q: Question) {
    setEditing(q);
    setEditFields({ questionText: q.questionText, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD });
    setEditExamName(q.examName ?? '');
    setEditExamYear(q.examYear ? String(q.examYear) : '');
    setEditSubjectName(q.subject?.name ?? '');
    setEditSourceName(q.sourceName ?? '');
    setEditCorrectOption(q.correctOption as 'A' | 'B' | 'C' | 'D');
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editFields.questionText.trim() || !editFields.optionA.trim() || !editFields.optionB.trim() || !editFields.optionC.trim() || !editFields.optionD.trim()) {
      setEditError('Question text and all four options are required.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const res = await adminFetch(`/admin/questions/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editFields,
        correctOption: editCorrectOption,
        examName: editExamName.trim() || null,
        examYear: editExamYear ? Number(editExamYear) : null,
        subjectName: editSubjectName.trim() || undefined,
        sourceName: editSourceName.trim() || null,
      }),
    });
    setEditSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEditError(body.error ?? 'Failed to save changes');
      return;
    }
    setEditing(null);
    loadQuestions();
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
            onClick={openHeuristicPreview}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 14 }}
          >
            🧮 Auto-Classify (heuristic)
          </button>
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
        <label style={{ fontSize: 13 }}>
          Source Type:{' '}
          <select value={sourceTypeFilter} onChange={(e) => updateSourceTypeFilter(e.target.value)}>
            <option value="">— (all)</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
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
              <button onClick={openBulkEdit} style={{ fontSize: 12, padding: '6px 12px' }}>✏️ Bulk Edit Metadata</button>
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
                <button onClick={() => startEdit(q)} style={{ marginRight: 8, fontSize: 12 }}>Edit</button>
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

      {editing && (
        <div
          onClick={() => setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 10, padding: 20, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Edit Question ({editing.language})</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              Editing only this row — its {editing.translationGroupId ? 'linked translation is unaffected' : 'own language version'}.
              Authority/Category/Sub-Category aren't editable here yet.
            </p>

            <textarea
              placeholder="Question text"
              value={editFields.questionText}
              onChange={(e) => setEditFields({ ...editFields, questionText: e.target.value })}
              style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              rows={3}
            />

            {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((opt, i) => {
              const letter = String.fromCharCode(65 + i) as 'A' | 'B' | 'C' | 'D';
              return (
                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <input
                    type="radio"
                    name="editCorrectOption"
                    checked={editCorrectOption === letter}
                    onChange={() => setEditCorrectOption(letter)}
                    title="Correct answer"
                  />
                  <input
                    placeholder={`Option ${letter}`}
                    value={editFields[opt]}
                    onChange={(e) => setEditFields({ ...editFields, [opt]: e.target.value })}
                    style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>● Select the radio button next to the correct answer.</p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>
                Exam Name:{' '}
                <input value={editExamName} onChange={(e) => setEditExamName(e.target.value)} style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 200 }} />
              </label>
              <label style={{ fontSize: 13 }}>
                Exam Year:{' '}
                <input type="number" value={editExamYear} onChange={(e) => setEditExamYear(e.target.value)} style={{ width: 80, padding: 4, borderRadius: 4, border: '1px solid #cbd5e1' }} />
              </label>
              <SubjectInput value={editSubjectName} onChange={setEditSubjectName} />
            </div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
              Source Name:{' '}
              <input
                value={editSourceName}
                onChange={(e) => setEditSourceName(e.target.value)}
                style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 240 }}
              />
            </label>

            {editError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{editError}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600 }}
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {heuristicPreview && (
        <div
          onClick={() => setHeuristicPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 20, maxWidth: 420, width: '100%' }}>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>🧮 Auto-Classify (heuristic)</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
              One-time rule: a calculation signal (numbers+units, "calculate"/"கணக்கிடுக", a formula) → Hard. Otherwise, question text
              over 120 characters → Hard, else Medium. Only affects questions with no Difficulty set — status is never changed.
            </p>

            {heuristicError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{heuristicError}</p>}

            {!heuristicResult && heuristicPreview.total >= 0 && (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 14 }}>
                  <span><b>{heuristicPreview.total}</b> total</span>
                  <span style={{ color: '#0284c7' }}><b>{heuristicPreview.medium}</b> → Medium</span>
                  <span style={{ color: '#c2410c' }}><b>{heuristicPreview.hard}</b> → Hard</span>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setHeuristicPreview(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
                    Cancel
                  </button>
                  <button
                    onClick={applyHeuristicClassification}
                    disabled={heuristicApplying || heuristicPreview.total === 0}
                    style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600 }}
                  >
                    {heuristicApplying ? 'Applying…' : `Apply to ${heuristicPreview.total} questions`}
                  </button>
                </div>
              </>
            )}

            {heuristicResult && (
              <>
                <p style={{ fontSize: 14, marginBottom: 16 }}>
                  ✅ Done — {heuristicResult.medium} set to Medium, {heuristicResult.hard} set to Hard. Still in their current status (Draft
                  etc.) — review and publish as usual.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setHeuristicPreview(null)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff' }}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {bulkEditOpen && (
        <div
          onClick={() => setBulkEditOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 20, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>✏️ Bulk Edit Metadata</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
              Applies to all {selected.size} selected questions. Leave a field blank to leave it unchanged — this only edits the fields
              you actually fill in. Authority itself and question content/options aren't editable here.
            </p>

            {bulkError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{bulkError}</p>}

            {!bulkResult && (
              <>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                  Source Type:{' '}
                  <select value={bulkSourceType} onChange={(e) => setBulkSourceType(e.target.value)} style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1' }}>
                    <option value="">— (leave unchanged)</option>
                    {SOURCE_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>

                <div style={{ marginBottom: 10 }}>
                  <ExamTaxonomyPicker value={bulkTaxonomy} onChange={setBulkTaxonomy} />
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Pick an Authority here only to browse its Category/Sub-Category — only Category and Sub-Category are applied; Authority itself is left unchanged.
                  </p>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                    Also applies to (optional) — adds these tags to every selected question, on top of any it already has:
                  </label>
                  <MultiTaxonomyTagPicker value={bulkAdditionalTags} onChange={setBulkAdditionalTags} />
                </div>

                <label style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                  Exam Name:{' '}
                  <input value={bulkExamName} onChange={(e) => setBulkExamName(e.target.value)} placeholder="(leave unchanged)" style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 220 }} />
                </label>
                <div style={{ marginBottom: 8 }}>
                  <SubjectInput value={bulkSubjectName} onChange={setBulkSubjectName} />
                </div>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
                  Source Name:{' '}
                  <input value={bulkSourceName} onChange={(e) => setBulkSourceName(e.target.value)} placeholder="(leave unchanged)" style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 240 }} />
                </label>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setBulkEditOpen(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
                    Cancel
                  </button>
                  <button
                    onClick={applyBulkEdit}
                    disabled={bulkSaving}
                    style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600 }}
                  >
                    {bulkSaving ? 'Saving…' : `Apply to ${selected.size} questions`}
                  </button>
                </div>
              </>
            )}

            {bulkResult && (
              <>
                <p style={{ fontSize: 14, marginBottom: 16 }}>✅ Updated {bulkResult.count} questions.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setBulkEditOpen(false)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff' }}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
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
