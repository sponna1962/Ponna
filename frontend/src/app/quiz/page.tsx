'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

// Practice Setup + Start — implements the finalized Practice Preference
// requirement: Language + Exam Authority (multi) + Category (multi, per
// Authority) + Sub-Category (multi, where applicable) + Difficulty, all on
// ONE page, saved once, and skipped on every future visit (only a "Change"
// link reopens it). "All" at any level is never a stored id — see
// practice-preference.service.ts for why, and how it stays dynamic.

type SubCategory = { id: string; name: string };
type Category = { id: string; name: string; subCategories: SubCategory[] };
type Authority = { id: string; name: string; categories: Category[] };

type CategorySelection = { categoryId: string; allSubCategories: boolean; subCategoryIds: string[] };
type AuthoritySelection = { authorityId: string; allCategories: boolean; categories: CategorySelection[] };
type Selections = { allAuthorities: boolean; authorities: AuthoritySelection[] };

type SavedPreference = {
  language: 'TA' | 'EN';
  mode: 'MIXED' | 'MEDIUM' | 'HARD';
  selections: Selections;
};

const emptySelections: Selections = { allAuthorities: false, authorities: [] };

export default function QuizStartPage() {
  const { t } = useLanguage();

  const [tree, setTree] = useState<Authority[]>([]);
  const [saved, setSaved] = useState<SavedPreference | null | 'loading'>('loading');
  const [editing, setEditing] = useState(false);

  // Form state — mirrors Selections shape while editing/first-time setup.
  const [language, setLanguage] = useState<'TA' | 'EN' | ''>('');
  const [mode, setMode] = useState<'MIXED' | 'MEDIUM' | 'HARD' | ''>('');
  const [selections, setSelections] = useState<Selections>(emptySelections);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setLanguage(prefData.language);
        setMode(prefData.mode);
        setSelections(prefData.selections);
      }
    });
  }, []);

  // ── Authority selection (multi, with "All" mutual exclusivity) ──────────
  function toggleAllAuthorities() {
    setSelections((s) => ({ allAuthorities: !s.allAuthorities, authorities: [] }));
  }
  function toggleAuthority(authorityId: string) {
    setSelections((s) => {
      const exists = s.authorities.some((a) => a.authorityId === authorityId);
      const authorities = exists
        ? s.authorities.filter((a) => a.authorityId !== authorityId)
        : [...s.authorities, { authorityId, allCategories: true, categories: [] }]; // default to "All categories" when an authority is first added
      return { allAuthorities: false, authorities };
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

  const canStart =
    !!language && !!mode && (selections.allAuthorities || selections.authorities.length > 0);

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
      await startSession();
    } finally {
      setStarting(false);
    }
  }

  async function startSession() {
    setError(null);
    setStarting(true);
    try {
      const res = await studentFetch('/quiz/start', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? t.quiz.startError);
        return;
      }
      const session = await res.json();
      if (session.resumedWithDifferentSelection) alert(t.quiz.resumingSession);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <h1 style={{ fontSize: 20, margin: 0 }}>{t.quiz.title}</h1>
        </div>
        <LanguageToggle />
      </div>

      <div style={{ padding: '0 20px' }}>
        {!editing && saved && (
          <PreferenceSummary
            saved={saved}
            tree={tree}
            t={t}
            onChange={() => setEditing(true)}
            onStart={startSession}
            starting={starting}
          />
        )}

        {editing && (
          <>
            <Section title={t.practiceSetup.languageQuestion}>
              <ChipRow>
                <Chip label="தமிழ்" active={language === 'TA'} onClick={() => setLanguage('TA')} />
                <Chip label="English" active={language === 'EN'} onClick={() => setLanguage('EN')} />
              </ChipRow>
            </Section>

            <Section title={t.practiceSetup.selectAuthority}>
              <ChipRow>
                <Chip label={t.practiceSetup.all} active={selections.allAuthorities} onClick={toggleAllAuthorities} />
                {tree.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    active={selections.authorities.some((sel) => sel.authorityId === a.id)}
                    onClick={() => toggleAuthority(a.id)}
                  />
                ))}
              </ChipRow>
            </Section>

            {!selections.allAuthorities &&
              selections.authorities.map((authSel) => {
                const authority = tree.find((a) => a.id === authSel.authorityId);
                if (!authority) return null;
                return (
                  <div key={authority.id}>
                    <Section title={t.practiceSetup.selectCategoryFor(authority.name)}>
                      <ChipRow>
                        <Chip label={t.practiceSetup.all} active={authSel.allCategories} onClick={() => toggleAllCategories(authority.id)} />
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
                  </div>
                );
              })}

            <Section title={t.practiceSetup.difficultyQuestion}>
              <ChipRow>
                <Chip label={t.quiz.modes.MIXED} active={mode === 'MIXED'} onClick={() => setMode('MIXED')} />
                <Chip label={t.quiz.modes.MEDIUM} active={mode === 'MEDIUM'} onClick={() => setMode('MEDIUM')} />
                <Chip label={t.quiz.modes.HARD} active={mode === 'HARD'} onClick={() => setMode('HARD')} />
              </ChipRow>
            </Section>

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

function PreferenceSummary({
  saved,
  tree,
  t,
  onChange,
  onStart,
  starting,
}: {
  saved: SavedPreference;
  tree: Authority[];
  t: any;
  onChange: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const summary = describeSelections(saved, tree);

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

function describeSelections(saved: SavedPreference, tree: Authority[]): string {
  const langLabel = saved.language === 'TA' ? 'தமிழ்' : 'English';
  const modeLabel = { MIXED: 'Mixed', MEDIUM: 'Medium', HARD: 'Hard' }[saved.mode];

  if (saved.selections.allAuthorities) {
    return `${langLabel} · All Authorities · ${modeLabel}`;
  }

  const parts = saved.selections.authorities.map((authSel) => {
    const authority = tree.find((a) => a.id === authSel.authorityId);
    if (!authority) return null;
    if (authSel.allCategories) return authority.name;
    const catNames = authSel.categories
      .map((cs) => authority.categories.find((c) => c.id === cs.categoryId)?.name)
      .filter(Boolean);
    return `${authority.name} (${catNames.join(', ')})`;
  }).filter(Boolean);

  return `${langLabel} · ${parts.join(', ')} · ${modeLabel}`;
}
