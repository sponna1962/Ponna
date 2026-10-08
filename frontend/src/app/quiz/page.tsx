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
          <Image src="/logo-header.svg" alt="PONNA.in" width={1968} height={450} priority />
        </a>
        {/* Sept 2026 — Offline Practice entry point. Deliberately not a
            new sidebar item (nav structure is finalized) — lives here
            instead, right where a student starts practice. */}
        <a href="/offline-practice" className="offline-badge">Offline</a>
      </header>

      <div className="practice-page-title">
        <h1 className="practice-title">{t.quiz.title}</h1>
      </div>

      <div className="practice-content">
        {!editing && saved && (
          <PreferenceSummary
            saved={saved}
            tree={tree}
            t={t}
            lang={lang}
            onChange={() => setEditing(true)}
            onStart={startWithAccessCheck}
            starting={starting}
          />
        )}

        {/* Free-fallback upgrade prompt (finalized requirement) — shown for
            EITHER "Start Practising" entry point above, never for both/none
            inconsistently, since it's driven by one shared piece of state. */}
        {profileGate && (
          <div className="profile-gate">
            <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
            <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-ink)' }}>பயிற்சியைத் தொடங்கும் முன்</p>
            <p style={{ fontSize: 14, lineHeight: 1.65, margin: '0 0 18px', color: 'var(--color-inkMuted)' }}>உங்கள் Profile-ஐ நிரப்புங்கள். உங்கள் Pass பாதுகாப்பாக உள்ளது — Profile முடிந்ததும் உடனே பயிற்சியைத் தொடங்கலாம்.</p>
            <a href="/profile?complete=1" style={{ display: 'block', padding: 15, borderRadius: 14, background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>Profile-ஐ நிரப்புங்கள் →</a>
          </div>
        )}

        {accessPrompt && (
          <div className="access-prompt">
            <p style={{ fontSize: 14, color: 'var(--color-ink)', marginBottom: 4, fontWeight: 600 }}>{t.practiceSetup.noActivePlan}</p>
            <p style={{ fontSize: 13, color: '#92400e', marginBottom: 12 }}>{t.practiceSetup.freeFallbackDesc}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  setStarting(true);
                  try {
                    await startSession();
                  } finally {
                    setStarting(false);
                    setAccessPrompt(null);
                  }
                }}
                disabled={starting}
                style={{ flex: 1, padding: 12, borderRadius: 8, background: '#fff', color: '#92400e', border: '1px solid #92400e', fontWeight: 600 }}
              >
                {starting ? t.practiceSetup.savingAndStarting : t.practiceSetup.practiceFree}
              </button>
              <a
                href={accessPrompt.applicablePlanId ? `/plans?highlight=${accessPrompt.applicablePlanId}` : '/plans'}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  background: '#92400e',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  textAlign: 'center',
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {t.practiceSetup.getAnnualPlan}
              </a>
            </div>
          </div>
        )}

        {editing && (
          <>
            {fixedSel ? (
              <div className="exam-card">
                <span className="exam-card-mark" aria-hidden="true">4</span>
                <div>
                  <b style={{ fontSize: 17, display: 'block' }}>{lang === 'ta' ? 'TNPSC குரூப்-4' : 'TNPSC Group 4'}</b>
                  <small style={{ fontSize: 12, color: '#FFE9A8' }}>{lang === 'ta' ? 'போட்டித் தேர்வு' : 'Competitive exam'}</small>
                </div>
                <span className="selected-badge">✓ {lang === 'ta' ? 'தேர்வானது' : 'Selected'}</span>
              </div>
            ) : restriction?.restricted ? (
              // Sept 2026 — TNPSC Group IV & VAO Pass (finalized
              // requirement): no picker at all, locked straight to Group
              // IV & VAO. Real enforcement is server-side; this is just
              // the matching UI state.
              <Section title={t.practiceSetup.selectPurpose}>
                <div className="locked-card">
                  {lang === 'ta' ? 'உங்கள் பாஸ்: TNPSC குரூப்-4' : 'Your Pass: TNPSC Group - IV'}
                </div>
              </Section>
            ) : (
              <>
                <Section title={t.practiceSetup.selectPurpose}>
                  <ChipRow>
                    {tree.map((p) => (
                      <Chip
                        key={p.id}
                        label={lang === 'ta' ? (p.nameTa || p.name) : p.name}
                        active={selections.purposeId === p.id}
                        onClick={() => selectPurpose(p.id)}
                      />
                    ))}
                  </ChipRow>
                </Section>

                {selectedPurpose && (
                  <>
                    <Section title={t.practiceSetup.selectAuthority}>
                      <ChipRow>
                        {selectedPurpose.allowMultipleAuthorities && (
                          <Chip label={t.practiceSetup.all} active={selections.allAuthorities} onClick={toggleAllAuthorities} />
                        )}
                        {selectedPurpose.authorities.map((a) => (
                          <Chip
                            key={a.id}
                            label={a.name}
                            active={selections.authorities.some((sel) => sel.authorityId === a.id)}
                            onClick={() => toggleAuthority(a)}
                          />
                        ))}
                      </ChipRow>
                    </Section>

                    {!selections.allAuthorities &&
                      selections.authorities.map((authSel) => {
                        const authority = selectedPurpose.authorities.find((a) => a.id === authSel.authorityId);
                        if (!authority) return null;
                        return (
                          <div key={authority.id}>
                            <Section title={t.practiceSetup.selectCategoryFor(authority.name)}>
                              <ChipRow>
                                {authority.allowAllCategories && (
                                  <Chip
                                    label={t.practiceSetup.all}
                                    active={authSel.allCategories}
                                    onClick={() => toggleAllCategories(authority.id)}
                                  />
                                )}
                                {authority.categories.map((c) => (
                                  <Chip
                                    key={c.id}
                                    label={c.name}
                                    active={authSel.categories.some((cs) => cs.categoryId === c.id)}
                                    onClick={() => toggleCategory(authority.id, c.id)}
                                  />
                                ))}
                              </ChipRow>
                            </Section>

                            {!authSel.allCategories &&
                              authSel.categories.map((catSel) => {
                                const category = authority.categories.find((c) => c.id === catSel.categoryId);
                                if (!category || category.subCategories.length === 0) return null;
                                return (
                                  <Section key={category.id} title={t.practiceSetup.selectSubCategoryFor(category.name)}>
                                    <ChipRow>
                                      <Chip
                                        label={t.practiceSetup.all}
                                        active={catSel.allSubCategories}
                                        onClick={() => toggleAllSubCategories(authority.id, category.id)}
                                      />
                                      {category.subCategories.map((sc) => (
                                        <Chip
                                          key={sc.id}
                                          label={sc.name}
                                          active={catSel.subCategoryIds.includes(sc.id)}
                                          onClick={() => toggleSubCategory(authority.id, category.id, sc.id)}
                                        />
                                      ))}
                                    </ChipRow>
                                  </Section>
                                );
                              })}

                            {/* Subject Preference (finalized requirement) — only
                                shown once the selection resolves to exactly ONE
                                specific exam (Sub-Category), matching Stage 2's
                                own eligibility rule for when a preference lookup
                                makes sense at all. Optional, underlined, no
                                permanent screen real estate — the picker only
                                appears in the modal on tap. Never shown at all
                                for a restricted-only student (Sept 2026 — see
                                the `restriction?.restricted` branch above; this
                                nested branch is dead code for such a student
                                anyway since they never reach this UI, but the
                                explicit guard documents the rule here too). */}
                            {!restriction?.restricted &&
                              !authSel.allCategories &&
                              authSel.categories.map((catSel) => {
                                const category = authority.categories.find((c) => c.id === catSel.categoryId);
                                if (!category || category.subCategories.length === 0) return null;
                                if (catSel.allSubCategories || catSel.subCategoryIds.length !== 1) return null;
                                return <SubjectPreferenceField key={catSel.categoryId} subCategoryId={catSel.subCategoryIds[0]} t={t} />;
                              })}
                          </div>
                        );
                      })}

                    {/* Difficulty only ever shows once at least one Authority has
                        been selected (finalized requirement) — never immediately
                        after picking the Purpose. */}
                    {(selections.allAuthorities || selections.authorities.length > 0) && (
                      <Section title={t.practiceSetup.difficultyQuestion}>
                        {difficultyStepVisible ? (
                          <ChipRow>
                            <Chip label={t.quiz.modes.MIXED} active={mode === 'MIXED'} onClick={() => setMode('MIXED')} />
                            <Chip label={t.quiz.modes.MEDIUM} active={mode === 'MEDIUM'} onClick={() => setMode('MEDIUM')} />
                            <Chip label={t.quiz.modes.HARD} active={mode === 'HARD'} onClick={() => setMode('HARD')} />
                          </ChipRow>
                        ) : (
                          <p style={{ fontSize: 13, color: 'var(--color-inkMuted)' }}>{t.practiceSetup.difficultyNotApplicable}</p>
                        )}
                      </Section>
                    )}
                  </>
                )}
              </>
            )}

            {examSelectionComplete && (
              <Section title={t.practiceSetup.languageQuestion}>
                {checkingLanguages ? (
                  <p style={{ fontSize: 13, color: '#94a3b8' }}>{t.quiz.loading}</p>
                ) : availableLanguages && availableLanguages.length > 0 ? (
                  <ChipRow>
                    {availableLanguages.includes('TA') && (
                      <Chip label="தமிழ்" active={language === 'TA'} onClick={() => setLanguage('TA')} />
                    )}
                    {availableLanguages.includes('EN') && (
                      <Chip label="English" active={language === 'EN'} onClick={() => setLanguage('EN')} />
                    )}
                  </ChipRow>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--color-gold)' }}>{t.practiceSetup.noQuestionsForSelection}</p>
                )}
              </Section>
            )}

            {fixedSubCategoryId && examSelectionComplete && (
              <SubjectPreferenceField subCategoryId={fixedSubCategoryId} t={t} resetOnFreshVisit practiceLanguage={language} />
            )}

            <button
              onClick={saveAndStart}
              disabled={!canStart || starting}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: 14,
                background: canStart ? 'var(--color-btn)' : 'var(--color-line)',
                color: canStart ? 'var(--color-btnText)' : 'var(--color-inkMuted)',
                border: 'none',
                fontSize: 17,
                fontWeight: 700,
                marginTop: 8,
                boxShadow: canStart ? '0 10px 24px -10px rgba(15,47,51,0.7)' : 'none',
              }}
            >
              {starting ? t.practiceSetup.savingAndStarting : t.practiceSetup.startPractice}
            </button>
          </>
        )}

        {error && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: 'var(--color-bad)', marginBottom: 8 }}>{error}</p>
            <a href="/plans" className="error-link">
              {t.dashboard.upgrade}
            </a>
          </div>
        )}
      </div>
    
      <style jsx>{`\n.practice-page{color-scheme:light dark;width:100%;max-width:680px;min-height:100dvh;margin:0 auto;padding-bottom:32px;background:var(--color-paper);color:var(--color-ink);font-family:'Noto Sans Tamil','Nirmala UI',Latha,Arial,sans-serif}
.practice-header{min-height:64px;display:flex;align-items:center;gap:10px;padding:0 12px;background:var(--color-card);border-bottom:2px solid var(--color-gold);position:sticky;top:0;z-index:30}
.practice-brand{display:flex;align-items:center;min-width:0;margin-right:auto;text-decoration:none}
.practice-brand img{width:154px;height:auto;display:block}
.practice-title{margin:0!important;color:var(--color-ink)!important;font-size:23px!important;font-weight:900!important;line-height:1.3;letter-spacing:-.2px}
.practice-page-title{padding:20px 16px 4px}
.practice-page-title:after{content:'';display:block;width:42px;height:3px;margin-top:9px;background:var(--color-gold);border-radius:2px}
.offline-badge{color:var(--color-ok)!important;border:1px solid var(--color-ok)!important;background:var(--color-okBg);padding:7px 9px;border-radius:7px;text-decoration:none;white-space:nowrap;font-size:11px;font-weight:900;line-height:1}
.practice-content{padding:12px 16px 0!important}
.exam-card{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:15px 16px;color:#fff;background:var(--color-head1);border-radius:10px;border-bottom:3px solid #FFD22A;box-shadow:0 6px 18px rgba(11,56,100,.12)}
.exam-card-mark{width:42px;height:42px;border:1px solid rgba(255,255,255,.42);border-radius:8px;background:rgba(255,255,255,.08);display:grid;place-items:center;color:#fff;font-size:20px;font-weight:900;flex:0 0 42px}
.exam-card b{font-size:18px!important}.exam-card small{color:#E6EFF6!important;font-size:12px!important}
.selected-badge{margin-left:auto;color:#14253D;background:#FFD22A;padding:6px 9px;border-radius:6px;font-size:11px;font-weight:900;white-space:nowrap}
.section-block{margin-bottom:22px!important;padding-bottom:18px;border-bottom:1px solid var(--color-line)}
.section-title{margin:0 0 11px!important;color:var(--color-ink)!important;font-size:17px!important;letter-spacing:0}line-height:1.45;font-weight:900!important}
.chip-row{display:flex;flex-wrap:wrap;gap:8px}
.practice-chip{padding:10px 15px!important;min-height:44px;border-radius:8px!important;border:1px solid var(--color-line)!important;background:var(--color-card)!important;color:var(--color-ink)!important;font-weight:700!important;font-size:14.5px!important;box-shadow:none!important}
.practice-chip.active{background:var(--color-head1)!important;color:#fff!important;border-color:var(--color-head1)!important}
.start-button,.summary-start{width:100%!important;min-height:54px;padding:13px 16px!important;margin-top:10px!important;border-radius:9px!important;border:none!important;background:var(--color-btn)!important;color:var(--color-btnText)!important;font-size:17px!important;font-weight:900!important;box-shadow:0 7px 18px rgba(11,56,100,.16)!important}
.profile-gate{margin-top:14px!important;padding:22px 16px!important;text-align:center;border-radius:10px!important;background:var(--color-card)!important;border:1px solid var(--color-line)!important;border-top:3px solid var(--color-gold)!important}
.profile-gate a{display:block!important;padding:13px!important;border-radius:8px!important;background:var(--color-btn)!important;color:var(--color-btnText)!important}
.access-prompt{margin-top:14px!important;padding:15px!important;border-radius:9px!important;background:var(--color-goldLight)!important;border:1px solid var(--color-gold)!important}
.access-prompt>div{gap:8px!important}.access-prompt button,.access-prompt a{border-radius:8px!important}
.locked-card{padding:13px!important;border-radius:8px!important;background:var(--color-okBg)!important;border:1px solid var(--color-ok)!important;color:var(--color-ok)!important}
.error-box{margin-top:14px!important;padding:12px;border:1px solid var(--color-bad);border-radius:8px;background:var(--color-badBg)}.error-box p{color:var(--color-bad)!important;margin:0 0 8px!important}
.error-link{display:inline-block;padding:8px 14px;border-radius:7px;background:var(--color-btn);color:var(--color-btnText);text-decoration:none;font-size:13px}
.subject-pref{margin-bottom:22px}.subject-pref-button{background:transparent!important;border:none!important;padding:0!important;font-size:14px!important;font-weight:800!important;color:var(--color-teal)!important;text-decoration:underline;cursor:pointer}
.subject-modal-overlay{position:fixed;inset:0;background:rgba(11,56,100,.52);z-index:100;display:flex;align-items:flex-end}
.subject-modal{background:var(--color-card);color:var(--color-ink);border-radius:14px 14px 0 0;padding:20px;width:100%;max-width:680px;margin:0 auto;max-height:72vh;overflow-y:auto;box-shadow:0 -8px 28px rgba(11,56,100,.18)}
.subject-option{display:flex;align-items:center;gap:10px;padding:11px 0;font-size:14px;cursor:pointer;border-bottom:1px solid var(--color-line)}
.subject-done{width:100%;padding:13px;border-radius:8px;background:var(--color-btn);color:var(--color-btnText);border:none;font-weight:900;font-size:15px;margin-top:16px}
.preference-summary{margin-bottom:22px}.summary-card{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;background:var(--color-card)!important;border:1px solid var(--color-line)!important;border-left:4px solid var(--color-gold)!important;border-radius:9px!important;padding:15px!important;margin-bottom:12px!important}
.summary-label{margin:0 0 5px!important;color:var(--color-gold)!important;font-size:12px!important;font-weight:900!important}.summary-text{margin:0!important;color:var(--color-ink)!important;font-size:14.5px!important;line-height:1.6!important}
.change-button{flex-shrink:0;font-size:12px;font-weight:800;padding:6px 11px;border-radius:7px;border:1px solid var(--color-line);background:var(--color-card);color:var(--color-ink)}
@media(max-width:480px){.practice-header{padding:0 10px;gap:8px}.practice-brand img{width:146px}.practice-page-title{padding:18px 14px 3px}.practice-title{font-size:21px!important}.practice-content{padding:12px 14px 0!important}.exam-card{padding:13px 12px}.exam-card b{font-size:16px!important}.selected-badge{padding:5px 7px;font-size:10px}.practice-chip{font-size:14px!important;padding:9px 12px!important;min-height:44px}}
@media(max-width:380px){.practice-brand img{width:136px}.practice-title{font-size:20px!important}.offline-badge{padding:7px;font-size:10px}.practice-content{padding-left:12px!important;padding-right:12px!important}}\n      `}</style>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
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
