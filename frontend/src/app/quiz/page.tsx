'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';
import { translations } from '../../lib/translations';
import { studentFetch } from '../../lib/student-fetch';

// Sept 2026 (explicit request) — some official syllabi include a subject
// that is only a valid exam choice for differently-abled candidates, taken
// INSTEAD OF the standard subject everyone else takes (e.g. Group IV's
// English track vs the Tamil Eligibility Test everyone else must take).
// Hidden by default in the Subject Preference picker, behind a toggle, so
// it doesn't confuse the vast majority of students it doesn't apply to.
const DISABILITY_ONLY_SUBJECT_NAMES = new Set(['General English']);

// Practice Setup + Start — implements the finalized structure:
//   Exam Type/Purpose → Exam Authority (multi) → Category (multi, per
//   Authority) → Sub-Category (multi, where applicable) → Difficulty →
//   Practice Language (LAST — computed dynamically from what's actually
//   Published for everything selected so far, never hardcoded).
// All on ONE page, saved once, skipped on every future visit (only a
// "Change" link reopens it). "All" at any level is never a stored id — it's
// scoped to whatever it's nested under (Purpose for Authority-level "All";
// Authority for Category-level "All"; etc.) — see practice-preference.service.ts.

type SubCategory = { id: string; name: string };
type Category = { id: string; name: string; subCategories: SubCategory[] };
// selectionGroup: null = standalone (this Authority can never combine with
// any other). Two Authorities sharing the same non-null selectionGroup may
// be selected together even inside an otherwise single-select Purpose — the
// finalized JEE Main + JEE Advanced exception, driven entirely by this DB
// field (admin-editable), never hardcoded by name here.
type Authority = { id: string; name: string; categories: Category[]; allowAllCategories: boolean; difficultyEnabled: boolean; selectionGroup: string | null };
type Purpose = { id: string; name: string; nameTa: string | null; authorities: Authority[]; allowMultipleAuthorities: boolean };

type CategorySelection = { categoryId: string; allSubCategories: boolean; subCategoryIds: string[] };
type AuthoritySelection = { authorityId: string; allCategories: boolean; categories: CategorySelection[] };
type Selections = { purposeId: string; allAuthorities: boolean; authorities: AuthoritySelection[] };

type SavedPreference = {
  language: 'TA' | 'EN';
  mode: 'MIXED' | 'MEDIUM' | 'HARD';
  selections: Selections;
};

/** Oct 2026 — PONNA currently sells and serves only TNPSC Group 4, so the
 * exam is fixed instead of asking the student to pick it. Found by NAME
 * in the real taxonomy tree (never a hardcoded id); if it can't be found
 * (taxonomy renamed/restructured) this returns null and the page falls
 * back to the full, original picker below — nothing breaks. */
function findGroup4Selections(tree: Purpose[]): Selections | null {
  for (const purpose of tree) {
    for (const authority of purpose.authorities) {
      if (!/tnpsc/i.test(authority.name)) continue;
      for (const category of authority.categories) {
        const sc = category.subCategories.find((x) => /group[\s-]*(iv|4)\b/i.test(x.name));
        if (sc) {
          return {
            purposeId: purpose.id,
            allAuthorities: false,
            authorities: [{ authorityId: authority.id, allCategories: false, categories: [{ categoryId: category.id, allSubCategories: false, subCategoryIds: [sc.id] }] }],
          };
        }
      }
    }
  }
  return null;
}

const emptySelections: Selections = { purposeId: '', allAuthorities: false, authorities: [] };

export default function QuizStartPage() {
  const { t, lang } = useLanguage();

  const [tree, setTree] = useState<Purpose[]>([]);
  const [saved, setSaved] = useState<SavedPreference | null | 'loading'>('loading');
  const [editing, setEditing] = useState(false);

  const [mode, setMode] = useState<'MIXED' | 'MEDIUM' | 'HARD' | ''>('');
  const [selections, setSelections] = useState<Selections>(emptySelections);

  // Language is resolved LAST, dynamically — never chosen up front.
  const [availableLanguages, setAvailableLanguages] = useState<('TA' | 'EN')[] | null>(null);
  const [checkingLanguages, setCheckingLanguages] = useState(false);
  const [language, setLanguage] = useState<'TA' | 'EN' | ''>('');

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Free-fallback upgrade prompt (finalized requirement) — set only when
  // the just-saved selection isn't covered by any active paid Plan.
  const [profileGate, setProfileGate] = useState(false);
  const [accessPrompt, setAccessPrompt] = useState<{ applicablePlanId: string | null } | null>(null);

  // Sept 2026 — TNPSC Group IV & VAO Pass (finalized requirement): a
  // student whose only active paid coverage is this restricted plan gets
  // NO Authority/Category/Sub-Category picker at all — locked straight to
  // Group IV & VAO. This is a UX convenience only; the real boundary is
  // server-side (practice-preference.service.ts's enforceScopeRestriction),
  // so even if this state is somehow wrong/stale, the backend still rejects
  // any other selection.
  const [restriction, setRestriction] = useState<{ restricted: boolean; allowedSubCategoryIds: string[] } | null>(null);
  const fixedSel = useMemo(() => findGroup4Selections(tree), [tree]);
  const fixedSubCategoryId = fixedSel?.authorities[0]?.categories[0]?.subCategoryIds[0] ?? null;

  useEffect(() => {
    studentFetch('/students/me/scope-restriction')
      .then((r) => (r.ok ? r.json() : { restricted: false, allowedSubCategoryIds: [] }))
      .then(setRestriction)
      .catch(() => setRestriction({ restricted: false, allowedSubCategoryIds: [] }));
  }, []);

  /** Builds the locked Selections object for a restricted student directly
   * from the real exam-taxonomy tree + their allowed Sub-Category ids —
   * never hardcodes TNPSC/Group Examinations ids, so it keeps working even
   * if the taxonomy is restructured later. Returns null until both the
   * tree and the restriction have loaded. */
  function buildLockedSelections(): Selections | null {
    if (!restriction?.restricted || tree.length === 0) return null;
    for (const purpose of tree) {
      for (const authority of purpose.authorities) {
        const categories: CategorySelection[] = [];
        for (const category of authority.categories) {
          const subCategoryIds = category.subCategories
            .map((sc) => sc.id)
            .filter((id) => restriction.allowedSubCategoryIds.includes(id));
          if (subCategoryIds.length > 0) categories.push({ categoryId: category.id, allSubCategories: false, subCategoryIds });
        }
        if (categories.length > 0) {
          return {
            purposeId: purpose.id,
            allAuthorities: false,
            authorities: [{ authorityId: authority.id, allCategories: false, categories }],
          };
        }
      }
    }
    return null;
  }

  // Pre-fill the locked selection once the taxonomy + restriction are both
  // loaded, for a first-time restricted student (no saved preference yet)
  // — Mode and Language stay normal explicit steps (reusing the existing
  // dynamic language-detection effect below), only the Authority/Category/
  // Sub-Category picker step is skipped/replaced in the render.
  useEffect(() => {
    if (saved !== null || selections.purposeId) return; // only for a first-time student, and only once
    const locked = buildLockedSelections();
    if (locked) setSelections(locked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restriction, tree]);

  useEffect(() => {
    Promise.all([
      studentFetch('/exam-taxonomy').then((r) => r.json()),
      studentFetch('/students/me/practice-preference').then((r) => r.json()),
    ]).then(([treeData, prefData]) => {
      setTree(treeData);
      setSaved(prefData);
      const g4 = findGroup4Selections(treeData);
      if (!prefData || g4) {
        setEditing(true); // first-time student (or fixed Group 4 mode) — go straight into setup
      }
      if (prefData) {
        setMode(prefData.mode);
        setSelections(g4 ?? prefData.selections);
        setLanguage(prefData.language);
      } else if (g4) {
        setSelections(g4);
      }
    });
  }, []);

  // The exam-selection prerequisite for showing the Language step: a Purpose
  // and either "All authorities" or at least one authority, plus a Difficulty.
  const selectedPurpose = tree.find((p) => p.id === selections.purposeId);

  // Difficulty step only shows if AT LEAST ONE selected Authority enables it
  // (finalized requirement §4). If none do, Difficulty is skipped entirely
  // and "Mixed" is used silently — Mixed is a filter mode, never a stored
  // Question.difficulty value, so this never touches question data itself.
  // NOTE: when a mixed-authority selection includes some Authorities WITH
  // difficulty enabled and some without, applying a chosen Hard/Medium
  // filter correctly ONLY to the relevant Authorities is allocation-logic
  // work explicitly deferred to a later phase (§8) — today, if the step is
  // shown at all, the chosen difficulty is still applied uniformly across
  // every selected Authority.
  const relevantAuthorities = !selectedPurpose
    ? []
    : selections.allAuthorities
    ? selectedPurpose.authorities
    : selections.authorities
        .map((sel) => selectedPurpose.authorities.find((a) => a.id === sel.authorityId))
        .filter((a): a is Authority => !!a);
  const difficultyStepVisible = relevantAuthorities.some((a) => a.difficultyEnabled);

  const examSelectionComplete =
    !!selections.purposeId &&
    (selections.allAuthorities || selections.authorities.length > 0) &&
    (difficultyStepVisible ? !!mode : true);

  useEffect(() => {
    // Sept 2026 (Phased Launch, explicit request) — was defaulting to
    // MIXED (Medium+Hard combined) when the Difficulty step is hidden.
    // Confirmed from a live screenshot: Group - IV practice should be
    // entirely HARD, no Medium at all, once this step isn't shown to
    // choose from.
    if (relevantAuthorities.length > 0 && !difficultyStepVisible && mode !== 'HARD') {
      setMode('HARD');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyStepVisible, relevantAuthorities.length]);

  // Fixed Group 4 mode never shows the difficulty chooser — default to Mixed
  // if the exam enables difficulty and nothing is chosen yet (when it does
  // not, the effect above already sets HARD, same as before).
  useEffect(() => {
    if (fixedSel && difficultyStepVisible && !mode) setMode('MIXED');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedSel, difficultyStepVisible]);

  // Re-check available languages every time the exam selection or difficulty
  // changes — this is what makes Language "determined dynamically", not a
  // fixed list (finalized requirement).
  useEffect(() => {
    if (!editing || !examSelectionComplete) {
      setAvailableLanguages(null);
      return;
    }
    setCheckingLanguages(true);
    studentFetch('/students/me/practice-preference/available-languages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections, mode }),
    })
      .then(async (r) => {
        // Sept 2026 (real bug fix, confirmed from a live crash report
        // with full stack trace) — was assuming every response has a
        // valid languages array, even a failed one. On a genuine
        // backend failure the body is {error: ...} instead, so
        // body.languages was undefined, and calling .includes() on it
        // below threw -- uncaught, since this whole chain had no res.ok
        // check and no .catch(), only .finally(). This is very likely
        // the root cause of the earlier-reported "Application error"
        // crash on Start Practising, which happens right after this
        // exact check runs during Practice Setup.
        if (!r.ok) {
          console.error('available-languages check failed:', await r.text().catch(() => ''));
          return;
        }
        const body: { languages: ('TA' | 'EN')[] } = await r.json();
        setAvailableLanguages(body.languages);
        // If the previously chosen language is no longer valid for this
        // selection, clear it (student must knowingly pick again) — never
        // silently keep an invalid language selected.
        setLanguage((prev) => (body.languages.includes(prev as any) ? prev : body.languages.length === 1 ? body.languages[0] : ''));
      })
      .catch((err) => console.error('available-languages check failed:', err))
      .finally(() => setCheckingLanguages(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, JSON.stringify(selections), mode]);

  // ── Purpose selection (single) — resets everything downstream ───────────
  function selectPurpose(purposeId: string) {
    setSelections({ purposeId, allAuthorities: false, authorities: [] });
    setLanguage('');
  }

  // ── Authority selection (multi, with "All" mutual exclusivity, scoped to the chosen Purpose) ──
  function toggleAllAuthorities() {
    setSelections((s) => ({ ...s, allAuthorities: !s.allAuthorities, authorities: [] }));
  }
  function toggleAuthority(authority: Authority) {
    setSelections((s) => {
      const exists = s.authorities.some((a) => a.authorityId === authority.id);
      const newEntry = { authorityId: authority.id, allCategories: authority.allowAllCategories, categories: [] };

      if (selectedPurpose?.allowMultipleAuthorities) {
        // Competitive/Employment-style Purpose — any combination is fine,
        // unchanged from before.
        const authorities = exists
          ? s.authorities.filter((a) => a.authorityId !== authority.id)
          : [...s.authorities, newEntry];
        return { ...s, allAuthorities: false, authorities };
      }

      // Single-select Purpose (Higher Education/Entrance, Eligibility/
      // Qualification) — but selectionGroup is a config-driven exception:
      // Authorities sharing the same non-null selectionGroup (e.g. JEE Main
      // + JEE Advanced, both "JEE") may be selected together. Clicking an
      // already-selected Authority always just deselects it.
      if (exists) {
        return { ...s, allAuthorities: false, authorities: s.authorities.filter((a) => a.authorityId !== authority.id) };
      }

      const currentlySelected = s.authorities
        .map((sel) => selectedPurpose?.authorities.find((a) => a.id === sel.authorityId))
        .filter((a): a is Authority => !!a);
      const canCombineWithCurrent =
        authority.selectionGroup != null &&
        currentlySelected.length > 0 &&
        currentlySelected.every((a) => a.selectionGroup === authority.selectionGroup);

      // Combine into the group if it matches; otherwise this pick REPLACES
      // whatever was selected before (standard single-select behaviour).
      const authorities = canCombineWithCurrent ? [...s.authorities, newEntry] : [newEntry];
      return { ...s, allAuthorities: false, authorities };
    });
  }

  // ── Category selection (multi, per-authority, with "All") ───────────────
  function toggleAllCategories(authorityId: string) {
    setSelections((s) => ({
      ...s,
      authorities: s.authorities.map((a) =>
        a.authorityId === authorityId ? { ...a, allCategories: !a.allCategories, categories: [] } : a,
      ),
    }));
  }
  function toggleCategory(authorityId: string, categoryId: string) {
    setSelections((s) => ({
      ...s,
      authorities: s.authorities.map((a) => {
        if (a.authorityId !== authorityId) return a;
        const exists = a.categories.some((c) => c.categoryId === categoryId);
        const categories = exists
          ? a.categories.filter((c) => c.categoryId !== categoryId)
          : [...a.categories, { categoryId, allSubCategories: true, subCategoryIds: [] }];
        return { ...a, allCategories: false, categories };
      }),
    }));
  }

  // ── Sub-Category selection (multi, per-category, with "All") ────────────
  function toggleAllSubCategories(authorityId: string, categoryId: string) {
    setSelections((s) => ({
      ...s,
      authorities: s.authorities.map((a) =>
        a.authorityId !== authorityId
          ? a
          : {
              ...a,
              categories: a.categories.map((c) =>
                c.categoryId === categoryId ? { ...c, allSubCategories: !c.allSubCategories, subCategoryIds: [] } : c,
              ),
            },
      ),
    }));
  }
  function toggleSubCategory(authorityId: string, categoryId: string, subCategoryId: string) {
    setSelections((s) => ({
      ...s,
      authorities: s.authorities.map((a) =>
        a.authorityId !== authorityId
          ? a
          : {
              ...a,
              categories: a.categories.map((c) => {
                if (c.categoryId !== categoryId) return c;
                const exists = c.subCategoryIds.includes(subCategoryId);
                const subCategoryIds = exists
                  ? c.subCategoryIds.filter((id) => id !== subCategoryId)
                  : [...c.subCategoryIds, subCategoryId];
                return { ...c, allSubCategories: false, subCategoryIds };
              }),
            },
      ),
    }));
  }

  const canStart = examSelectionComplete && !!language;

  async function saveAndStart() {
    if (!canStart) return;
    setError(null);
    setStarting(true);
    try {
      const saveRes = await studentFetch('/students/me/practice-preference', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, mode, selections }),
      });
      if (!saveRes.ok) {
        setError(t.practiceSetup.selectAtLeastOne);
        return;
      }
      setSaved({ language: language as 'TA' | 'EN', mode: mode as any, selections });
      await startWithAccessCheck();
    } finally {
      setStarting(false);
    }
  }

  /**
   * Free-fallback upgrade prompt (finalized requirement) — checked BEFORE
   * every session start, from both entry points (full setup flow and the
   * "already saved, just start" summary view below). Only shown when
   * genuinely uncovered; an active paid Plan covering this selection skips
   * straight to starting, and the prompt must never appear in that case.
   */
  async function startWithAccessCheck() {
    // Profile is required only for Pass holders (paid practice). Free-preview
    // students go straight to their free questions; the profile is asked after.
    try {
      const subsRes = await studentFetch('/students/me/subscriptions');
      const subs = subsRes.ok ? await subsRes.json() : [];
      if (Array.isArray(subs) && subs.length > 0) {
        const pr = await studentFetch('/students/me/profile');
        if (pr.ok) {
          const prof = await pr.json();
          if (prof.profileComplete === false) {
            setProfileGate(true);
            return;
          }
        }
      }
    } catch {}
    const statusRes = await studentFetch('/quiz/access-status');
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (status.hasPreference && status.covered === false) {
        setAccessPrompt({ applicablePlanId: status.applicablePlanId ?? null });
        return;
      }
    }
    await startSession();
  }

  async function startSession() {
    setError(null);
    setStarting(true);
    try {
      const res = await studentFetch('/quiz/start', { method: 'POST' });
      if (!res.ok) {
        // Sept 2026 (real bug fix, confirmed from a live crash report) —
        // was assuming a failed response is always valid JSON; if the
        // backend genuinely crashes and returns a raw non-JSON error
        // (e.g. a 500 HTML page), res.json() below throws, and since
        // this whole block had no catch, that exception went uncaught --
        // a full "Application error" client-side crash instead of a
        // recoverable, visible error message.
        const body = await res.json().catch(() => ({}));
        // Free Preview one-time-per-phone (finalized requirement) — these
        // two are actionable, not just informational, so send the
        // student straight to where they fix it instead of just showing
        // text they'd have to act on manually.
        if (body.code === 'FREE_PREVIEW_PROFILE_INCOMPLETE') {
          window.location.href = '/profile?complete=1';
          return;
        }
        if (body.code === 'FREE_PREVIEW_ALREADY_USED') {
          window.location.href = '/plans';
          return;
        }
        setError(body.error ?? t.quiz.startError);
        return;
      }
      const session = await res.json();
      window.location.href = `/quiz/${session.id}`;
    } catch (err) {
      // Sept 2026 (real bug fix) — any other unexpected failure (network
      // drop mid-request, a genuinely malformed success response, etc.)
      // now shows the same recoverable error message instead of crashing
      // the whole page.
      console.error(err);
      setError(t.quiz.startError);
    } finally {
      setStarting(false);
    }
  }

  if (saved === 'loading') {
    return <main style={{ minHeight: '100dvh', padding: 24, textAlign: 'center', color: 'var(--color-inkMuted)', background: 'var(--color-paper)' }}>{t.quiz.loading}</main>;
  }

  return (
    <main className="practice-page">
      <header className="practice-header">
        <StudentMenu iconColor="#0B3864" />
        <a href="/" className="practice-brand" aria-label="PONNA.in">
          <span className="practice-brand-crop">
            <Image src="/logo-compact.png" alt="PONNA.in" width={1968} height={531} priority />
          </span>
        </a>
        <a href="/offline-practice" className="offline-badge">Offline</a>
      </header>

      <div className="practice-content">
        <div className="setup-intro">
          <p className="eyebrow">PONNA · PRACTICE</p>
          <h1 className="practice-title">{t.quiz.title}</h1>
          <p className="setup-lead">
            {lang === 'ta' ? 'உங்கள் தேர்வைத் தேர்ந்தெடுத்து, பயிற்சியைத் தொடங்குங்கள்.' : 'Choose your exam preferences and begin practising.'}
          </p>
        </div>

        <div className="setup-progress" aria-label="Practice setup">
          <span className="progress-dot active">1</span><span className="progress-line" />
          <span className="progress-dot">2</span><span className="progress-line" />
          <span className="progress-dot">3</span>
          <span className="progress-label">{lang === 'ta' ? 'தேர்வு · மொழி · தொடக்கம்' : 'Exam · Language · Start'}</span>
        </div>

        {!editing && saved && (
          <PreferenceSummary saved={saved} tree={tree} t={t} lang={lang} onChange={() => setEditing(true)} onStart={startWithAccessCheck} starting={starting} />
        )}

        {profileGate && (
          <div className="profile-gate">
            <div className="notice-mark">!</div>
            <p className="notice-title">பயிற்சியைத் தொடங்கும் முன்</p>
            <p className="notice-copy">உங்கள் Profile-ஐ நிரப்புங்கள். Profile முடிந்ததும் உடனே பயிற்சியைத் தொடங்கலாம்.</p>
            <a href="/profile?complete=1">Profile-ஐ நிரப்புங்கள் →</a>
          </div>
        )}

        {accessPrompt && (
          <div className="access-prompt">
            <p className="prompt-kicker">{t.practiceSetup.noActivePlan}</p>
            <p className="prompt-copy">{t.practiceSetup.freeFallbackDesc}</p>
            <div className="prompt-actions">
              <button onClick={async () => { setStarting(true); try { await startSession(); } finally { setStarting(false); setAccessPrompt(null); } }} disabled={starting}>
                {starting ? t.practiceSetup.savingAndStarting : t.practiceSetup.practiceFree}
              </button>
              <a href={accessPrompt.applicablePlanId ? `/plans?highlight=${accessPrompt.applicablePlanId}` : '/plans'}>{t.practiceSetup.getAnnualPlan}</a>
            </div>
          </div>
        )}

        {editing && (
          <div className="setup-stack">
            <section className="setup-card exam-section">
              <div className="step-heading"><span className="step-number">01</span><div><p className="step-kicker">{lang === 'ta' ? 'தேர்வு' : 'EXAM'}</p><h2>{lang === 'ta' ? 'உங்கள் தேர்வு' : 'Your exam'}</h2></div></div>
              {fixedSel ? (
                <div className="exam-choice">
                  <div className="exam-symbol">4</div>
                  <div className="exam-copy"><strong>{lang === 'ta' ? 'TNPSC குரூப்-4' : 'TNPSC Group 4'}</strong><span>{lang === 'ta' ? 'தமிழ்நாடு அரசு போட்டித் தேர்வு' : 'Tamil Nadu government competitive exam'}</span></div>
                  <span className="selected-badge">✓ {lang === 'ta' ? 'தேர்வு' : 'Selected'}</span>
                </div>
              ) : restriction?.restricted ? (
                <div className="locked-card">{lang === 'ta' ? 'உங்கள் பாஸ்: TNPSC குரூப்-4' : 'Your Pass: TNPSC Group - IV'}</div>
              ) : (
                <>
                  <Section title={t.practiceSetup.selectPurpose}><ChipRow>{tree.map((p) => <Chip key={p.id} label={lang === 'ta' ? (p.nameTa || p.name) : p.name} active={selections.purposeId === p.id} onClick={() => selectPurpose(p.id)} />)}</ChipRow></Section>
                  {selectedPurpose && (
                    <>
                      <Section title={t.practiceSetup.selectAuthority}><ChipRow>{selectedPurpose.allowMultipleAuthorities && <Chip label={t.practiceSetup.all} active={selections.allAuthorities} onClick={toggleAllAuthorities} />}{selectedPurpose.authorities.map((a) => <Chip key={a.id} label={a.name} active={selections.authorities.some((s) => s.authorityId === a.id)} onClick={() => toggleAuthority(a)} />)}</ChipRow></Section>
                      {!selections.allAuthorities && selections.authorities.map((authSel) => {
                        const authority=selectedPurpose.authorities.find((a)=>a.id===authSel.authorityId); if(!authority)return null;
                        return <div key={authority.id}>
                          <Section title={t.practiceSetup.selectCategoryFor(authority.name)}><ChipRow>{authority.allowAllCategories && <Chip label={t.practiceSetup.all} active={authSel.allCategories} onClick={()=>toggleAllCategories(authority.id)} />}{authority.categories.map((cat)=><Chip key={cat.id} label={cat.name} active={authSel.categories.some((s)=>s.categoryId===cat.id)} onClick={()=>toggleCategory(authority.id,cat.id)} />)}</ChipRow></Section>
                          {!authSel.allCategories && authSel.categories.map((catSel)=>{
                            const category=authority.categories.find((cat)=>cat.id===catSel.categoryId); if(!category||category.subCategories.length===0)return null;
                            return <Section key={category.id} title={t.practiceSetup.selectSubCategoryFor(category.name)}><ChipRow><Chip label={t.practiceSetup.all} active={catSel.allSubCategories} onClick={()=>toggleAllSubCategories(authority.id,category.id)} />{category.subCategories.map((sc)=><Chip key={sc.id} label={sc.name} active={catSel.subCategoryIds.includes(sc.id)} onClick={()=>toggleSubCategory(authority.id,category.id,sc.id)} />)}</ChipRow></Section>;
                          })}
                        </div>;
                      })}
                      {(selections.allAuthorities || selections.authorities.length > 0) && <Section title={t.practiceSetup.difficultyQuestion}>{difficultyStepVisible ? <ChipRow><Chip label={t.quiz.modes.MIXED} active={mode==='MIXED'} onClick={()=>setMode('MIXED')} /><Chip label={t.quiz.modes.MEDIUM} active={mode==='MEDIUM'} onClick={()=>setMode('MEDIUM')} /><Chip label={t.quiz.modes.HARD} active={mode==='HARD'} onClick={()=>setMode('HARD')} /></ChipRow> : <p className="muted-note">{t.practiceSetup.difficultyNotApplicable}</p>}</Section>}
                    </>
                  )}
                </>
              )}
            </section>

            {examSelectionComplete && (
              <section className="setup-card">
                <div className="step-heading"><span className="step-number">02</span><div><p className="step-kicker">{lang === 'ta' ? 'மொழி' : 'LANGUAGE'}</p><h2>{lang === 'ta' ? 'பயிற்சி மொழி' : 'Practice language'}</h2></div></div>
                {checkingLanguages ? <div className="loading-row">{t.quiz.loading}</div> : availableLanguages && availableLanguages.length > 0 ? <div className="language-options">{availableLanguages.includes('TA') && <Chip label="தமிழ்" active={language==='TA'} onClick={()=>setLanguage('TA')} />}{availableLanguages.includes('EN') && <Chip label="English" active={language==='EN'} onClick={()=>setLanguage('EN')} />}</div> : <p className="availability-note">{t.practiceSetup.noQuestionsForSelection}</p>}
              </section>
            )}

            {fixedSubCategoryId && examSelectionComplete && (
              <section className="setup-card optional-section">
                <div className="step-heading"><span className="step-number">03</span><div><p className="step-kicker">{lang === 'ta' ? 'விருப்பம்' : 'OPTIONAL'}</p><h2>{lang === 'ta' ? 'பாடங்களைத் தேர்ந்தெடுக்கவும்' : 'Choose subjects'}</h2></div></div>
                <p className="section-description">{lang === 'ta' ? 'முழுப் பாடத்திட்டத்திலும் பயிற்சி செய்யலாம். விருப்பமிருந்தால் குறிப்பிட்ட பாடங்களை மட்டும் தேர்வு செய்யலாம்.' : 'Practise the full syllabus, or optionally focus on selected subjects.'}</p>
                <SubjectPreferenceField subCategoryId={fixedSubCategoryId} t={t} resetOnFreshVisit practiceLanguage={language} />
              </section>
            )}

            <section className="start-panel">
              <div><p className="start-kicker">{lang === 'ta' ? 'தயாரா?' : 'READY TO PRACTISE?'}</p><h2>{lang === 'ta' ? 'உங்கள் பயிற்சி தயார்.' : 'Your practice is ready.'}</h2><p>{language === 'TA' ? 'தமிழ் · TNPSC Group 4' : language === 'EN' ? 'English · TNPSC Group 4' : (lang === 'ta' ? 'மொழியைத் தேர்ந்தெடுக்கவும்' : 'Select a language to continue')}</p></div>
              <button className="start-button" onClick={saveAndStart} disabled={!canStart || starting}>{starting ? t.practiceSetup.savingAndStarting : t.practiceSetup.startPractice}{!starting && <span aria-hidden="true"> →</span>}</button>
            </section>
          </div>
        )}

        {error && <div className="error-box"><p>{error}</p><a href="/plans" className="error-link">{t.dashboard.upgrade}</a></div>}
      </div>

      <style jsx>{`
.practice-page{color-scheme:light dark;width:100%;max-width:760px;min-height:100dvh;margin:0 auto;padding-bottom:40px;background:var(--color-paper);color:var(--color-ink);font-family:'Noto Sans Tamil','Nirmala UI',Latha,Arial,sans-serif}
.practice-header{height:68px;min-height:68px;max-height:68px;display:flex;align-items:center;gap:10px;padding:0 14px;background:var(--color-card);border-bottom:2px solid var(--color-gold);position:sticky;top:0;z-index:30}
.practice-brand{display:flex;align-items:center;height:38px;min-width:0;margin-right:auto;text-decoration:none;overflow:hidden}
.practice-brand-crop{display:block;width:154px;height:31px;overflow:hidden;flex:0 0 154px;line-height:0}.practice-brand-crop img{width:154px!important;height:auto!important;max-width:none;display:block}
.practice-title{margin:0!important;color:var(--color-ink)!important;font-size:28px!important;font-weight:900!important;line-height:1.2;letter-spacing:-.3px}
.practice-content{padding:0 22px}.setup-intro{padding:34px 0 20px;border-bottom:1px solid var(--color-line)}.eyebrow,.step-kicker,.start-kicker{margin:0 0 5px;color:var(--color-gold);font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.setup-lead{margin:8px 0 0;color:var(--color-inkMuted);font-size:15px;line-height:1.7}
.setup-progress{display:flex;align-items:center;gap:8px;padding:16px 0 4px;color:var(--color-inkMuted)}.progress-dot{width:26px;height:26px;border:1px solid var(--color-line);border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:900;background:var(--color-card);color:var(--color-inkMuted);flex:0 0 26px}.progress-dot.active{background:var(--color-head1);border-color:var(--color-head1);color:#fff}.progress-line{height:1px;width:30px;background:var(--color-line)}.progress-label{margin-left:4px;font-size:11px;font-weight:700}
.setup-stack{display:grid;gap:14px;padding-top:18px}.setup-card{background:var(--color-card);border:1px solid var(--color-line);border-radius:12px;padding:20px;box-shadow:0 5px 16px rgba(11,56,100,.05)}.exam-section{border-top:3px solid var(--color-head1)}
.step-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:17px}.step-number{font-size:12px;font-weight:900;color:var(--color-head1);background:var(--color-goldLight);border:1px solid var(--color-gold);min-width:34px;height:34px;border-radius:7px;display:grid;place-items:center}.step-heading h2{margin:0;color:var(--color-ink);font-size:18px;line-height:1.4;font-weight:900}
.exam-choice{display:flex;align-items:center;gap:13px;padding:15px;background:var(--color-head1);border-radius:10px;color:#fff;border-left:4px solid var(--color-gold)}.exam-symbol{width:44px;height:44px;border:1px solid rgba(255,255,255,.35);border-radius:8px;display:grid;place-items:center;font-size:21px;font-weight:900;background:rgba(255,255,255,.08);flex:0 0 44px}.exam-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.exam-copy strong{font-size:17px;line-height:1.35}.exam-copy span{font-size:12.5px;color:#E7EEF5;line-height:1.45}.selected-badge{margin-left:auto;color:#14253D;background:#FFD22A;padding:7px 9px;border-radius:6px;font-size:11px;font-weight:900;white-space:nowrap}
.section-block{margin-bottom:20px!important;padding-bottom:17px;border-bottom:1px solid var(--color-line)}.section-block:last-child{border-bottom:0;padding-bottom:0;margin-bottom:0!important}.section-title{margin:0 0 10px!important;color:var(--color-ink)!important;font-size:15px!important;line-height:1.5;font-weight:900!important}.chip-row,.language-options{display:flex;flex-wrap:wrap;gap:9px}.practice-chip{padding:10px 15px!important;min-height:44px;border-radius:8px!important;border:1px solid var(--color-line)!important;background:var(--color-card)!important;color:var(--color-ink)!important;font-weight:700!important;font-size:14.5px!important;box-shadow:none!important}.practice-chip.active{background:var(--color-head1)!important;color:#fff!important;border-color:var(--color-head1)!important}
.optional-section{padding-bottom:18px}.section-description{margin:-6px 0 15px;color:var(--color-inkMuted);font-size:13.5px;line-height:1.7}.subject-pref{margin:0}.subject-pref-button{display:flex!important;align-items:center;justify-content:space-between;width:100%;background:var(--color-paper)!important;border:1px solid var(--color-line)!important;padding:12px 13px!important;border-radius:8px!important;font-size:13.5px!important;font-weight:800!important;color:var(--color-ink)!important;text-decoration:none!important;cursor:pointer}.subject-pref-button:after{content:'→';color:var(--color-gold);font-size:18px}
.start-panel{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px;background:var(--color-head1);border-radius:12px;border-bottom:3px solid var(--color-gold);margin-top:2px;color:#fff}.start-panel h2{margin:0 0 4px;color:#fff;font-size:19px;font-weight:900;line-height:1.35}.start-panel p:last-child{margin:0;color:#E7EEF5;font-size:13px;line-height:1.5}.start-button{min-width:210px;min-height:52px;padding:13px 17px!important;border-radius:8px!important;border:0!important;background:#FFD22A!important;color:#14253D!important;font-size:16px!important;font-weight:900!important;box-shadow:none!important;cursor:pointer}.start-button:disabled{background:#6B7A88!important;color:#D9E0E6!important;cursor:not-allowed}
.profile-gate{margin-top:14px!important;padding:22px 18px!important;border-radius:10px!important;background:var(--color-card)!important;border:1px solid var(--color-line)!important;border-top:3px solid var(--color-gold)!important;text-align:left}.notice-mark{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--color-goldLight);color:var(--color-head1);font-weight:900;margin-bottom:10px}.notice-title{font-size:17px;font-weight:900;margin:0 0 6px;color:var(--color-ink)}.notice-copy{font-size:14px;line-height:1.7;margin:0 0 16px;color:var(--color-inkMuted)}.profile-gate a{display:inline-block;padding:12px 15px;border-radius:8px;background:var(--color-btn);color:var(--color-btnText);font-weight:900;text-decoration:none}
.access-prompt{margin-top:14px!important;padding:17px!important;border-radius:10px!important;background:var(--color-goldLight)!important;border:1px solid var(--color-gold)!important;color:var(--color-ink)}.prompt-kicker{font-size:14px;font-weight:900;margin:0 0 5px;color:var(--color-ink)}.prompt-copy{font-size:13px;line-height:1.65;margin:0 0 13px;color:var(--color-ink)}.prompt-actions{display:flex;gap:9px}.prompt-actions button,.prompt-actions a{flex:1;min-height:44px;padding:10px;border-radius:8px;border:1px solid var(--color-ink);background:var(--color-card);color:var(--color-ink);font-weight:800;text-align:center;text-decoration:none}.prompt-actions a{background:var(--color-ink);color:#fff}
.locked-card{padding:13px!important;border-radius:8px!important;background:var(--color-okBg)!important;border:1px solid var(--color-ok)!important;color:var(--color-ok)!important}.muted-note,.loading-row,.availability-note{font-size:13px;color:var(--color-inkMuted);line-height:1.6}.availability-note{padding:12px;background:var(--color-goldLight);border-left:3px solid var(--color-gold);color:var(--color-ink)}
.error-box{margin-top:14px!important;padding:13px 14px;border:1px solid var(--color-bad);border-radius:9px;background:var(--color-badBg)}.error-box p{color:var(--color-bad)!important;margin:0 0 8px!important}.error-link{display:inline-block;padding:8px 14px;border-radius:7px;background:var(--color-btn);color:var(--color-btnText);text-decoration:none;font-size:13px}
.subject-modal-overlay{position:fixed;inset:0;background:rgba(11,56,100,.56);z-index:100;display:flex;align-items:flex-end}.subject-modal{background:var(--color-card);color:var(--color-ink);border-radius:14px 14px 0 0;padding:20px;width:100%;max-width:760px;margin:0 auto;max-height:76vh;overflow-y:auto;box-shadow:0 -8px 28px rgba(11,56,100,.2)}.subject-option{display:flex;align-items:center;gap:10px;padding:11px 0;font-size:14px;cursor:pointer;border-bottom:1px solid var(--color-line)}.subject-done{width:100%;min-height:46px;padding:12px;border-radius:8px;background:var(--color-btn);color:var(--color-btnText);border:none;font-weight:900;font-size:15px;margin-top:16px}
.preference-summary{margin-bottom:18px}.summary-card{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;background:var(--color-card)!important;border:1px solid var(--color-line)!important;border-left:4px solid var(--color-gold)!important;border-radius:9px!important;padding:15px!important;margin-bottom:12px!important}.summary-label{margin:0 0 5px!important;color:var(--color-gold)!important;font-size:12px!important;font-weight:900!important}.summary-text{margin:0!important;color:var(--color-ink)!important;font-size:14.5px!important;line-height:1.6!important}.change-button{flex-shrink:0;font-size:12px;font-weight:800;padding:6px 11px;border-radius:7px;border:1px solid var(--color-line);background:var(--color-card);color:var(--color-ink)}.summary-start{width:100%;min-height:52px;border:0;border-radius:8px;background:var(--color-btn);color:var(--color-btnText);font-weight:900;font-size:16px}
@media(max-width:620px){.practice-content{padding:0 14px}.setup-intro{padding:26px 0 17px}.practice-title{font-size:24px!important}.setup-progress{overflow:hidden}.progress-label{font-size:10px;white-space:nowrap}.setup-stack{gap:11px}.setup-card{padding:16px;border-radius:10px}.step-heading{margin-bottom:14px}.step-heading h2{font-size:17px}.exam-choice{padding:13px 12px}.exam-copy strong{font-size:16px}.selected-badge{font-size:10px;padding:6px 7px}.start-panel{display:block;padding:18px}.start-button{width:100%;margin-top:15px}.setup-lead{font-size:14px}}
@media(max-width:390px){.practice-header{padding:0 10px}.practice-brand-crop{width:136px;flex-basis:136px;height:29px}.practice-brand-crop img{width:136px!important}.practice-title{font-size:22px!important}.progress-label{display:none}.setup-progress{justify-content:flex-start}.setup-card{padding:14px}.exam-symbol{width:40px;height:40px;flex-basis:40px}.exam-copy span{font-size:11.5px}.selected-badge{margin-left:5px}.practice-chip{min-height:44px;font-size:14px!important;padding:9px 12px!important}.start-panel h2{font-size:18px}}
`}</style>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section-block">
      <h2 className="section-title"><span className="section-marker" aria-hidden="true" />{title}</h2>
      {children}
    </section>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="chip-row">{children}</div>;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px',
        borderRadius: 999,
        border: active ? '1.5px solid var(--color-btn)' : '1.5px solid var(--color-line)',
        background: active ? 'var(--color-btn)' : 'var(--color-card)',
        color: active ? 'var(--color-btnText)' : 'var(--color-ink)',
        fontWeight: active ? 700 : 500,
        fontSize: 14.5,
      }}
    >
      {active ? `${label} ×` : label}
    </button>
  );
}

// Subject Preference (finalized requirement — "Exam -> Subject Preference
// only" phase, no Topic Preference UI). Self-contained: fetches its own
// Subject list + saved preference for the given exam, manages its own
// modal, saves immediately on "Done" (topicIds always sent empty — this
// phase never touches topic-level preference). Reuses Stage 1's existing
// /subject-preference/* routes as-is, no backend changes needed here.
type PrefSubject = { id: string; name: string; nameTa?: string | null };

function SubjectPreferenceField({ subCategoryId, t: appT, resetOnFreshVisit, practiceLanguage }: { subCategoryId: string; t: any; resetOnFreshVisit?: boolean; practiceLanguage?: 'TA' | 'EN' | '' }) {
  // Oct 2026 — this picker's own wording follows the chosen PRACTICE language
  // (Tamil practice → Tamil wording), falling back to the app language.
  const t = practiceLanguage === 'TA' ? translations.ta : practiceLanguage === 'EN' ? translations.en : appT;
  const [subjects, setSubjects] = useState<PrefSubject[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [showDisabilityTrack, setShowDisabilityTrack] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSubjects(null);
    setSelectedIds(new Set());
    // Oct 2026 — subject choice is for the current practice visit only.
    // A new login (new token) or a new browser tab starts with none
    // selected, i.e. the full syllabus; Language is NOT touched here.
    let token = '';
    let fresh = false;
    try {
      token = localStorage.getItem('ponna_student_token') ?? '';
      fresh = !!resetOnFreshVisit && sessionStorage.getItem('ponna_subject_visit') !== token;
    } catch {}
    const reset: Promise<unknown> = fresh
      ? studentFetch(`/subject-preference/${subCategoryId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectIds: [], topicIds: [] }),
        })
          .then(() => {
            try { sessionStorage.setItem('ponna_subject_visit', token); } catch {}
          })
          .catch(() => {})
      : Promise.resolve();
    reset.then(() => Promise.all([
      studentFetch(`/subject-preference/${subCategoryId}/syllabus`).then((r) => r.json()),
      studentFetch(`/subject-preference/${subCategoryId}`).then((r) => r.json()),
    ]).then(([syllabus, pref]: [PrefSubject[], { subjectIds?: string[] }]) => {
      setSubjects(syllabus);
      setSelectedIds(new Set(pref.subjectIds ?? []));
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategoryId]);

  function openModal() {
    setDraftIds(new Set(selectedIds));
    setOpen(true);
  }

  function toggleDraft(id: string) {
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function done() {
    setSaving(true);
    await studentFetch(`/subject-preference/${subCategoryId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectIds: Array.from(draftIds), topicIds: [] }),
    });
    setSelectedIds(new Set(draftIds));
    setSaving(false);
    setOpen(false);
  }

  if (!subjects || subjects.length === 0) return null; // no syllabus seeded for this exam yet — field doesn't appear at all

  return (
    <div className="subject-pref">
      <button className="subject-pref-button"
        onClick={openModal}
        
      >
        {t.practiceSetup.subjectPreferenceTitle}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ` (${t.practiceSetup.optionalTag})`}
      </button>

      {open && (
        <div className="subject-modal-overlay" onClick={() => setOpen(false)}>
          <div className="subject-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.practiceSetup.chooseSubjects}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--color-inkMuted)', marginBottom: 16 }}>{t.practiceSetup.subjectPreferenceNote}</p>

            {subjects.filter((s) => showDisabilityTrack || !DISABILITY_ONLY_SUBJECT_NAMES.has(s.name)).map((s) => (
              <label key={s.id} className="subject-option">
                <input type="checkbox" checked={draftIds.has(s.id)} onChange={() => toggleDraft(s.id)} />
                {practiceLanguage === 'TA' && s.nameTa ? s.nameTa : s.name}
              </label>
            ))}

            {/* Sept 2026 (explicit request) — some syllabi include a subject
                that's only a valid choice for differently-abled candidates
                (e.g. Group IV's General English track, vs the standard
                Tamil Eligibility Test everyone else takes). Hidden by
                default so it doesn't clutter/confuse the list for
                everyone; a toggle reveals it for the students it applies
                to. */}
            {!showDisabilityTrack && subjects.some((s) => DISABILITY_ONLY_SUBJECT_NAMES.has(s.name)) && (
              <button
                type="button"
                onClick={() => setShowDisabilityTrack(true)}
                style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: 12.5, color: 'var(--color-gold)', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {t.practiceSetup.showDisabilityTrack}
              </button>
            )}

            <button className="subject-done" onClick={done} disabled={saving}>
              {saving ? '…' : t.practiceSetup.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreferenceSummary({
  saved,
  tree,
  t,
  lang,
  onChange,
  onStart,
  starting,
}: {
  saved: SavedPreference;
  tree: Purpose[];
  t: any;
  lang: string;
  onChange: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const summary = describeSelections(saved, tree, lang);

  return (
    <div className="preference-summary">
      <div className="summary-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 className="summary-label">{t.practiceSetup.yourPreferences}</h3>
            <p className="summary-text">{summary}</p>
          </div>
          <button className="change-button" onClick={onChange}>
            {t.practiceSetup.changePreferences}
          </button>
        </div>
      </div>

      <button className="summary-start" onClick={onStart} disabled={starting}>
        {starting ? t.practiceSetup.savingAndStarting : t.practiceSetup.startPractice}
      </button>
    </div>
  );
}

function describeSelections(saved: SavedPreference, tree: Purpose[], lang: string): string {
  const langLabel = saved.language === 'TA' ? 'தமிழ்' : 'English';
  const modeLabel = { MIXED: 'Mixed', MEDIUM: 'Medium', HARD: 'Hard' }[saved.mode];
  const purpose = tree.find((p) => p.id === saved.selections.purposeId);
  const purposeLabel = purpose ? (lang === 'ta' ? purpose.nameTa || purpose.name : purpose.name) : '';

  if (saved.selections.allAuthorities) {
    return `${purposeLabel} · All Authorities · ${modeLabel} · ${langLabel}`;
  }

  const parts = saved.selections.authorities.map((authSel) => {
    const authority = purpose?.authorities.find((a) => a.id === authSel.authorityId);
    if (!authority) return null;
    if (authSel.allCategories) return authority.name;
    const catNames = authSel.categories
      .map((cs) => authority.categories.find((c) => c.id === cs.categoryId)?.name)
      .filter(Boolean);
    return `${authority.name} (${catNames.join(', ')})`;
  }).filter(Boolean);

  return `${purposeLabel} · ${parts.join(', ')} · ${modeLabel} · ${langLabel}`;
}
