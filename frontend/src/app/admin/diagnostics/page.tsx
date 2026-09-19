'use client';

// One-time diagnostic page (Sept 2026) — Group IV subject-mismatch
// question counts. See server.ts's own comment on
// GET /admin/diagnostics/group-iv-subject-mismatch for the full context.
// Uses the same adminFetch() every other admin page already uses, so
// the existing admin login carries over automatically — no manual
// token handling needed.

import { useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Result = { subjectId: string; subjectName: string; groupIvQuestionCount: number };

export default function DiagnosticsPage() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [setupResult, setSetupResult] = useState<{ name: string; wasNew: boolean }[] | null>(null);
  const [syllabusSubjectsLoading, setSyllabusSubjectsLoading] = useState(false);
  const [syllabusSubjectsResult, setSyllabusSubjectsResult] = useState<{
    totalSubjects: number;
    subjects: { id: string; name: string; nameTa: string | null; topicCount: number }[];
  } | null>(null);
  const [mergingAptitude, setMergingAptitude] = useState(false);
  const [mergeResult, setMergeResult] = useState<{
    alreadyMerged?: boolean;
    merged?: boolean;
    topicsMoved?: number;
    topicsSkippedAsDuplicate?: number;
    preferencesRepointed?: number;
  } | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsResult, setTopicsResult] = useState<{
    subjects: { id: string; name: string; nameTa: string | null; topics: { id: string; name: string; nameTa: string | null }[] }[];
  } | null>(null);
  const [fixingNames, setFixingNames] = useState(false);
  const [fixNamesResult, setFixNamesResult] = useState<{ log: string[] } | null>(null);
  const [linkageResult, setLinkageResult] = useState<any>(null);
  const [linkageLoading, setLinkageLoading] = useState(false);
  const [allLinkageResult, setAllLinkageResult] = useState<any>(null);
  const [allLinkageLoading, setAllLinkageLoading] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [autoLinkResult, setAutoLinkResult] = useState<any>(null);
  const [flatSubjectsResult, setFlatSubjectsResult] = useState<any>(null);
  const [flatSubjectsLoading, setFlatSubjectsLoading] = useState(false);
  const [manualLink, setManualLink] = useState({ syllabusSubjectId: '', subjectId: '' });
  const [manualLinking, setManualLinking] = useState(false);
  const [manualLinkResult, setManualLinkResult] = useState<any>(null);

  async function runFlatSubjectsCheck() {
    setFlatSubjectsLoading(true);
    try {
      const res = await adminFetch('/admin/diagnostics/flat-subjects-by-question-count');
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to run check');
        return;
      }
      setFlatSubjectsResult(body);
    } finally {
      setFlatSubjectsLoading(false);
    }
  }

  async function submitManualLink() {
    if (!manualLink.syllabusSubjectId || !manualLink.subjectId) return;
    setManualLinking(true);
    try {
      const subjectIds = manualLink.subjectId.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await adminFetch('/admin/diagnostics/link-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabusSubjectId: manualLink.syllabusSubjectId, subjectIds }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to link');
        return;
      }
      setManualLinkResult(body);
      await runAllLinkageCheck();
    } finally {
      setManualLinking(false);
    }
  }

  async function runAllLinkageCheck() {
    setAllLinkageLoading(true);
    try {
      const res = await adminFetch('/admin/diagnostics/subject-linkage-status');
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to run check');
        return;
      }
      setAllLinkageResult(body);
    } finally {
      setAllLinkageLoading(false);
    }
  }

  async function runAutoLink() {
    setAutoLinking(true);
    try {
      const res = await adminFetch('/admin/diagnostics/auto-link-subjects', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to auto-link');
        return;
      }
      setAutoLinkResult(body);
      await runAllLinkageCheck();
    } finally {
      setAutoLinking(false);
    }
  }

  async function runLinkageCheck() {
    setLinkageLoading(true);
    try {
      const res = await adminFetch('/admin/diagnostics/tamil-subject-question-linkage');
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to run check');
        return;
      }
      setLinkageResult(body);
    } finally {
      setLinkageLoading(false);
    }
  }

  async function fixEnglishTamilNames() {
    setFixingNames(true);
    try {
      const res = await adminFetch('/admin/diagnostics/fix-group-iv-english-tamil-names', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to fix names');
        return;
      }
      setFixNamesResult(body);
      await runSyllabusSubjectsCheck();
    } finally {
      setFixingNames(false);
    }
  }

  async function runTopicsCheck() {
    setTopicsLoading(true);
    try {
      const res = await adminFetch('/admin/diagnostics/group-iv-syllabus-topics');
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to run check');
        return;
      }
      setTopicsResult(body);
    } finally {
      setTopicsLoading(false);
    }
  }

  async function runSyllabusSubjectsCheck() {
    setSyllabusSubjectsLoading(true);
    try {
      const res = await adminFetch('/admin/diagnostics/group-iv-syllabus-subjects');
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to run check');
        return;
      }
      setSyllabusSubjectsResult(body);
    } finally {
      setSyllabusSubjectsLoading(false);
    }
  }

  async function mergeAptitudeDuplicate() {
    setMergingAptitude(true);
    try {
      const res = await adminFetch('/admin/diagnostics/merge-group-iv-aptitude-duplicate', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to merge duplicate');
        return;
      }
      setMergeResult(body);
      // Refresh the table below so the merged result is visible immediately.
      await runSyllabusSubjectsCheck();
    } finally {
      setMergingAptitude(false);
    }
  }

  async function setupOfficialSubjects() {
    setSettingUp(true);
    try {
      const res = await adminFetch('/admin/diagnostics/setup-group-iv-official-subjects', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to set up subjects');
        return;
      }
      setSetupResult(body.subjects);
    } finally {
      setSettingUp(false);
    }
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/admin/diagnostics/group-iv-subject-mismatch');
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to run diagnostic');
        return;
      }
      setResults(body.subjectsActuallyUsed);
      setTotalQuestions(body.totalGroupIvQuestions);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Diagnostics</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Group IV subject-mismatch question counts — read-only, changes nothing.</p>

      <button
        onClick={run}
        disabled={loading}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
      >
        {loading ? 'Running…' : 'Run Group IV Subject-Mismatch Check'}
      </button>

      {/* Sept 2026 — explicit request, official Syllabus PDF (Code 496)
          confirmed as the final subject list. Idempotent -- safe to
          click more than once. Does NOT re-tag any existing question,
          only ensures the 15 correct Subject rows exist (scoped to
          Group - IV) so they show up in the now-scoped SubjectInput
          dropdown going forward. */}
      <button
        onClick={setupOfficialSubjects}
        disabled={settingUp}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#b45309', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, marginLeft: 8 }}
      >
        {settingUp ? 'Setting up…' : 'Set Up 15 Official Group IV Subjects'}
      </button>
      {setupResult && (
        <p style={{ fontSize: 12, color: '#166534', marginBottom: 12 }}>
          Done: {setupResult.filter((s) => s.wasNew).length} newly created, {setupResult.filter((s) => !s.wasNew).length} already existed.
        </p>
      )}

      {/* Sept 2026 — explicit request: check whether SyllabusSubject (the
          table the student-facing Subject Preference selector reads
          from) has its own extra/wrong entries beyond the official 15,
          the same class of mess already found and fixed in the separate
          flat Subject model. Read-only. */}
      <button
        onClick={runSyllabusSubjectsCheck}
        disabled={syllabusSubjectsLoading}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, marginLeft: 8 }}
      >
        {syllabusSubjectsLoading ? 'Running…' : 'Check SyllabusSubject Table (Subject Preference)'}
      </button>
      {syllabusSubjectsResult && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>{syllabusSubjectsResult.totalSubjects}</strong> SyllabusSubject rows for Group IV:
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8 }}>Name (as stored)</th>
                <th style={{ padding: 8 }}>Tamil Name</th>
                <th style={{ padding: 8 }}>Topic Count</th>
              </tr>
            </thead>
            <tbody>
              {syllabusSubjectsResult.subjects.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8, fontFamily: 'monospace' }}>{s.name}</td>
                  <td style={{ padding: 8 }}>{s.nameTa ?? '—'}</td>
                  <td style={{ padding: 8, fontWeight: 700 }}>{s.topicCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sept 2026 — explicit request: "Aptitude & Mental Ability" and
          "Aptitude and Mental Ability" in SyllabusSubject are the same
          official unit, split by an "&" vs "and" spelling difference.
          Merges topics + Tamil name into one row, repoints any student
          preference pointing at the duplicate, then deletes it.
          Idempotent — safe to click more than once. */}
      <button
        onClick={mergeAptitudeDuplicate}
        disabled={mergingAptitude}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#b91c1c', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, marginLeft: 8 }}
      >
        {mergingAptitude ? 'Merging…' : 'Merge Duplicate Aptitude Subject'}
      </button>
      {mergeResult && (
        <p style={{ fontSize: 12, color: '#166534', marginBottom: 12 }}>
          {mergeResult.alreadyMerged
            ? 'Already merged — no duplicate found.'
            : `Merged: ${mergeResult.topicsMoved} topic(s) moved, ${mergeResult.topicsSkippedAsDuplicate} dropped as exact duplicates, ${mergeResult.preferencesRepointed} student preference(s) repointed.`}
        </p>
      )}

      {error && <p style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}

      {/* Sept 2026 — explicit request: student selected only the Tamil
          Subject Preference and got "no eligible questions" despite ~2000
          Tamil questions existing. Checks whether questions are linked via
          syllabusTopicId (what allocation filters on) vs the separate flat
          Subject.subjectId field. Read-only. */}
      <button
        onClick={runLinkageCheck}
        disabled={linkageLoading}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, marginLeft: 8 }}
      >
        {linkageLoading ? 'Running…' : 'Check Tamil Subject-Question Linkage'}
      </button>
      {linkageResult && (
        <pre style={{ fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 20, overflowX: 'auto' }}>
          {JSON.stringify(linkageResult, null, 2)}
        </pre>
      )}

      {/* Sept 2026 — explicit request: "put a full stop to this problem"
          across EVERY subject, not just Tamil. Shows linkage status for
          every SyllabusSubject, and lets an admin auto-link the ones with
          an exact-name match to a flat Subject in one click. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={runAllLinkageCheck}
          disabled={allLinkageLoading}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {allLinkageLoading ? 'Running…' : 'Check ALL Subjects\u2019 Linkage Status'}
        </button>
        <button
          onClick={runAutoLink}
          disabled={autoLinking}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#b91c1c', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {autoLinking ? 'Linking…' : 'Auto-Link Subjects (exact name match)'}
        </button>
      </div>
      {autoLinkResult && (
        <div style={{ fontSize: 12, marginBottom: 12 }}>
          <p style={{ color: '#166534' }}>Linked {autoLinkResult.linkedCount} subject(s).</p>
          {autoLinkResult.stillUnmatched?.length > 0 && (
            <p style={{ color: '#b91c1c' }}>Still unmatched (link manually): {autoLinkResult.stillUnmatched.join(', ')}</p>
          )}
        </div>
      )}
      {allLinkageResult && (
        <div style={{ marginBottom: 20, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 6 }}>Subject</th>
                <th style={{ padding: 6 }}>Exam</th>
                <th style={{ padding: 6 }}>Linked Flat Subject</th>
                <th style={{ padding: 6 }}>Suggested Match</th>
                <th style={{ padding: 6 }}>Reachable Questions</th>
                <th style={{ padding: 6 }}>id (for manual link)</th>
              </tr>
            </thead>
            <tbody>
              {allLinkageResult.subjects.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: s.totalReachableQuestions === 0 ? '#fef2f2' : undefined }}>
                  <td style={{ padding: 6, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: 6, color: '#64748b' }}>{s.exam}</td>
                  <td style={{ padding: 6 }}>{s.linkedSubjects?.length > 0 ? s.linkedSubjects.map((ls: any) => ls.name).join(' + ') : <span style={{ color: '#b91c1c' }}>not linked</span>}</td>
                  <td style={{ padding: 6, color: '#64748b' }}>{s.suggestedMatch ? s.suggestedMatch.name : '—'}</td>
                  <td style={{ padding: 6, fontWeight: 700, color: s.totalReachableQuestions === 0 ? '#b91c1c' : '#166534' }}>{s.totalReachableQuestions}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{s.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sept 2026 — for SyllabusSubjects with no exact-name match (e.g. the
          Tamil eligibility test subject), shows every flat Subject with its
          question counts so an admin can identify the right one to link
          manually below. */}
      <button
        onClick={runFlatSubjectsCheck}
        disabled={flatSubjectsLoading}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
      >
        {flatSubjectsLoading ? 'Running…' : 'List Flat Subjects by Question Count'}
      </button>
      {flatSubjectsResult && (
        <div style={{ marginBottom: 12, overflowX: 'auto', maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#fff' }}>
                <th style={{ padding: 6 }}>Flat Subject</th>
                <th style={{ padding: 6 }}>Exam</th>
                <th style={{ padding: 6 }}>Total Questions</th>
                <th style={{ padding: 6 }}>Tamil Questions</th>
                <th style={{ padding: 6 }}>id (for manual link)</th>
              </tr>
            </thead>
            <tbody>
              {flatSubjectsResult.subjects.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 6, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: 6, color: '#64748b' }}>{s.exam ?? '—'}</td>
                  <td style={{ padding: 6 }}>{s.totalQuestions}</td>
                  <td style={{ padding: 6, fontWeight: s.tamilQuestions > 0 ? 700 : 400, color: s.tamilQuestions > 0 ? '#166534' : undefined }}>{s.tamilQuestions}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{s.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual link — paste a SyllabusSubject id (from the table above) and
          a flat Subject id (from the table above) to link them by hand,
          for the cases auto-link couldn't resolve. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <input
          placeholder="SyllabusSubject id"
          value={manualLink.syllabusSubjectId}
          onChange={(e) => setManualLink({ ...manualLink, syllabusSubjectId: e.target.value })}
          style={{ fontSize: 12, padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 6, width: 260 }}
        />
        <input
          placeholder="flat Subject id(s), comma-separated"
          value={manualLink.subjectId}
          onChange={(e) => setManualLink({ ...manualLink, subjectId: e.target.value })}
          style={{ fontSize: 12, padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 6, width: 260 }}
        />
        <button
          onClick={submitManualLink}
          disabled={manualLinking}
          style={{ padding: '8px 14px', borderRadius: 6, background: '#166534', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {manualLinking ? 'Linking…' : 'Link'}
        </button>
      </div>
      {manualLinkResult && <p style={{ fontSize: 12, color: '#166534', marginTop: -14, marginBottom: 20 }}>Linked: {manualLinkResult.syllabusSubject}</p>}

      {/* Sept 2026 — explicit request: comprehensive English + Tamil name
          fix against the official Syllabus PDF (Code 496). One-time. */}
      <button
        onClick={fixEnglishTamilNames}
        disabled={fixingNames}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#b91c1c', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, marginLeft: 8 }}
      >
        {fixingNames ? 'Fixing…' : 'Fix Group IV English + Tamil Subject Names'}
      </button>
      {fixNamesResult && (
        <ul style={{ fontSize: 12, color: '#166534', marginBottom: 20, paddingLeft: 20 }}>
          {fixNamesResult.log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      {/* Sept 2026 — explicit request: see the actual topic names inside
          each SyllabusSubject row, so an English+Tamil correction against
          the official Syllabus PDF (Code 496) can be planned from real
          data. Read-only. */}
      <button
        onClick={runTopicsCheck}
        disabled={topicsLoading}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, marginLeft: 8 }}
      >
        {topicsLoading ? 'Running…' : 'Show Topics Inside Each Subject'}
      </button>
      {topicsResult && (
        <div style={{ marginBottom: 20 }}>
          {topicsResult.subjects.map((s) => (
            <div key={s.id} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                {s.name} {s.nameTa ? `(${s.nameTa})` : ''} — {s.topics.length} topic(s)
              </p>
              <ul style={{ fontSize: 12, color: '#475569', margin: 0, paddingLeft: 20 }}>
                {s.topics.map((t) => (
                  <li key={t.id}>{t.name}{t.nameTa ? ` — ${t.nameTa}` : ''}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {results && (
        <>
          <p style={{ fontSize: 13, color: '#334155', marginBottom: 10 }}>
            <strong>{totalQuestions}</strong> total PUBLISHED Group IV questions, across <strong>{results.length}</strong> distinct Subjects actually used:
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8 }}>Subject Name (as actually stored)</th>
                <th style={{ padding: 8 }}>Group IV Questions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.subjectId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8, fontFamily: 'monospace' }}>{r.subjectName}</td>
                  <td style={{ padding: 8, fontWeight: 700 }}>{r.groupIvQuestionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
