'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

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
  const [accessPrompt, setAccessPrompt] = useState<{ applicablePlanId: string | null } | null>(null);

  useEffect(() => {
    Promise.all([
      studentFetch('/exam-taxonomy').then((r) => r.json()),
      studentFetch('/students/me/practice-preference').then((r) => r.json()),
    ]).then(([treeData, prefData]) => {
      setTree(treeData);
      setSaved(prefData);
      if (!prefData) {
        setEditing(true); // first-time student — go straight into setup
      } else {
        setMode(prefData.mode);
        setSelections(prefData.selections);
        setLanguage(prefData.language);
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
    if (relevantAuthorities.length > 0 && !difficultyStepVisible && mode !== 'MIXED') {
      setMode('MIXED');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyStepVisible, relevantAuthorities.length]);

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
      .then((r) => r.json())
      .then((body: { languages: ('TA' | 'EN')[] }) => {
        setAvailableLanguages(body.languages);
        // If the previously chosen language is no longer valid for this
        // selection, clear it (student must knowingly pick again) — never
        // silently keep an invalid language selected.
        setLanguage((prev) => (body.languages.includes(prev as any) ? prev : body.languages.length === 1 ? body.languages[0] : ''));
      })
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
        const body = await res.json();
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
    } finally {
      setStarting(false);
    }
  }

  if (saved === 'loading') {
    return <main style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t.quiz.loading}</main>;
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <StudentMenu />
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.quiz.title}</h1>
      </div>

      <div style={{ padding: '0 20px' }}>
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
        {accessPrompt && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <p style={{ fontSize: 14, color: '#92400e', marginBottom: 4, fontWeight: 600 }}>{t.practiceSetup.noActivePlan}</p>
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
                            appears in the modal on tap. */}
                        {!authSel.allCategories &&
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
                      <p style={{ fontSize: 13, color: '#94a3b8' }}>{t.practiceSetup.difficultyNotApplicable}</p>
                    )}
                  </Section>
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
                  <p style={{ fontSize: 13, color: '#d97706' }}>{t.practiceSetup.noQuestionsForSelection}</p>
                )}
              </Section>
            )}

            <button
              onClick={saveAndStart}
              disabled={!canStart || starting}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                background: canStart ? '#0f172a' : '#cbd5e1',
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {starting ? t.practiceSetup.savingAndStarting : t.practiceSetup.startPractice}
            </button>
          </>
        )}

        {error && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: '#dc2626', marginBottom: 8 }}>{error}</p>
            <a href="/plans" style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', textDecoration: 'none', fontSize: 13 }}>
              {t.dashboard.upgrade}
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 20,
        border: active ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
        background: active ? '#0f172a' : '#fff',
        color: active ? '#fff' : '#334155',
        fontSize: 13,
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
type PrefSubject = { id: string; name: string };

function SubjectPreferenceField({ subCategoryId, t }: { subCategoryId: string; t: any }) {
  const [subjects, setSubjects] = useState<PrefSubject[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSubjects(null);
    setSelectedIds(new Set());
    Promise.all([
      studentFetch(`/subject-preference/${subCategoryId}/syllabus`).then((r) => r.json()),
      studentFetch(`/subject-preference/${subCategoryId}`).then((r) => r.json()),
    ]).then(([syllabus, pref]: [{ id: string; name: string }[], { subjectIds?: string[] }]) => {
      setSubjects(syllabus);
      setSelectedIds(new Set(pref.subjectIds ?? []));
    });
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

  const selectedNames = subjects.filter((s) => selectedIds.has(s.id)).map((s) => s.name);

  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{t.practiceSetup.subjectPreferenceTitle}</h2>
      <button
        onClick={openModal}
        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 13, color: '#0f172a', textDecoration: 'underline', cursor: 'pointer' }}
      >
        {selectedNames.length > 0 ? selectedNames.join(', ') : t.practiceSetup.chooseSubjects}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '70vh', overflowY: 'auto' }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.practiceSetup.chooseSubjects}</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{t.practiceSetup.subjectPreferenceNote}</p>

            {subjects.map((s) => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                <input type="checkbox" checked={draftIds.has(s.id)} onChange={() => toggleDraft(s.id)} />
                {s.name}
              </label>
            ))}

            <button
              onClick={done}
              disabled={saving}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, marginTop: 16 }}
            >
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
    <div style={{ marginBottom: 20 }}>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{t.practiceSetup.yourPreferences}</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, margin: 0 }}>{summary}</p>
          </div>
          <button onClick={onChange} style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0 }}>
            {t.practiceSetup.changePreferences}
          </button>
        </div>
      </div>

      <button
        onClick={onStart}
        disabled={starting}
        style={{ width: '100%', padding: 14, borderRadius: 10, background: '#0f172a', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600 }}
      >
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
