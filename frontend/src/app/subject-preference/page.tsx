'use client';

// Student Subject & Topic Preference — Stage 1 (finalized requirement).
// TNPSC Exam -> Subject -> Topic, all optional. Saving this has NO effect
// on question allocation yet (that's Stage 2, done separately once this
// is confirmed working) — this page is purely the picker + storage.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Exam = { id: string; name: string };
type Topic = { id: string; name: string };
type Subject = { id: string; name: string; topics: Topic[] };

export default function SubjectPreferencePage() {
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    studentFetch('/subject-preference/exams')
      .then((r) => r.json())
      .then((data: Exam[]) => {
        setExams(data);
        if (data.length > 0) setSelectedExamId(data[0].id);
      })
      .catch(() => setExams([]));
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    setSaved(false);
    Promise.all([
      studentFetch(`/subject-preference/${selectedExamId}/syllabus`).then((r) => r.json()),
      studentFetch(`/subject-preference/${selectedExamId}`).then((r) => r.json()),
    ]).then(([syllabus, pref]) => {
      setSubjects(syllabus);
      setSelectedSubjectIds(new Set(pref.subjectIds ?? []));
      setSelectedTopicIds(new Set(pref.topicIds ?? []));
    });
  }, [selectedExamId]);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTopic(id: string) {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await studentFetch(`/subject-preference/${selectedExamId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectIds: Array.from(selectedSubjectIds), topicIds: Array.from(selectedTopicIds) }),
    });
    setSaving(false);
    setSaved(true);
  }

  async function clearAll() {
    setSelectedSubjectIds(new Set());
    setSelectedTopicIds(new Set());
    setSaving(true);
    await studentFetch(`/subject-preference/${selectedExamId}`, { method: 'DELETE' });
    setSaving(false);
    setSaved(true);
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.subjectPreference.title}</h1>
      </div>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20, lineHeight: 1.5 }}>{t.subjectPreference.note}</p>

      {exams === null && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {exams?.length === 0 && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.subjectPreference.noExams}</p>
        </div>
      )}

      {exams && exams.length > 0 && (
        <>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
            {t.subjectPreference.chooseExam}
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              style={{ display: 'block', width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 14 }}
            >
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          {subjects.map((s) => (
            <div key={s.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, marginBottom: s.topics.length > 0 ? 10 : 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedSubjectIds.has(s.id)} onChange={() => toggleSubject(s.id)} />
                {s.name}
              </label>
              {s.topics.length > 0 && (
                <div style={{ paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {s.topics.map((topic) => (
                    <label key={topic.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: COLORS.inkMuted, cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedTopicIds.has(topic.id)} onChange={() => toggleTopic(topic.id)} style={{ marginTop: 2 }} />
                      {topic.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button
              onClick={clearAll}
              disabled={saving}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.line}`, background: COLORS.paper, color: COLORS.inkMuted, fontSize: 14 }}
            >
              {t.subjectPreference.clearAll}
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: COLORS.ink, color: COLORS.paper, fontWeight: 600, fontSize: 14 }}
            >
              {saving ? '…' : t.subjectPreference.save}
            </button>
          </div>
          {saved && <p style={{ fontSize: 13, color: '#16a34a', marginTop: 10, textAlign: 'center' }}>{t.subjectPreference.savedMessage}</p>}
        </>
      )}
    </main>
  );
}
