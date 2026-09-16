'use client';

// Student-facing Study Notes (Sept 2026, Group IV first). See
// schema.prisma's own header comment on StudyNote. Public (no login
// required, same spirit as syllabus/download-link content) -- only
// ever reviewed notes are ever returned by the backend.
//
// Sept 2026 (explicit fix) — an explicit "Select Exam" step now comes
// first, matching how exam selection works elsewhere in the app
// (Practice Setup etc.) rather than silently jumping straight to
// subjects. Only one exam is visible under the current Phased Launch
// scope, but the step still requires a tap -- sets up cleanly for when
// more exams are visible later, and keeps this page consistent with
// the rest of the app's own pattern.

import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api-config';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';
import { StudentMenu } from '../../components/StudentMenu';

type Note = { subjectId: string; subjectName: string; subjectNameTa: string | null; content: string };
type Exam = { id: string; name: string };

export default function StudyNotesPage() {
  const [exam, setExam] = useState<Exam | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [language, setLanguage] = useState<'TA' | 'EN'>('TA');
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/public/primary-exam'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setExam(data?.id ? data : null))
      .catch(() => setExam(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    setNotesLoading(true);
    fetch(apiUrl(`/study-notes?subCategoryId=${selectedExamId}&language=${language}`))
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Note[]) => setNotes(data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
  }, [selectedExamId, language]);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40, background: COLORS.paper, minHeight: '100dvh' }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 20, margin: 0 }}>Study Notes</h1>
      </div>

      {!selectedExamId && (
        <div style={{ padding: '0 16px' }}>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 14 }}>தேர்வைத் தேர்வு செய்யுங்கள் / Select an exam</p>
          {loading && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>…</p>}
          {!loading && !exam && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>No exam is currently available.</p>}
          {exam && (
            <button
              onClick={() => setSelectedExamId(exam.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 16,
                borderRadius: 12,
                border: `1.5px solid ${COLORS.line}`,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
                color: COLORS.ink,
              }}
            >
              {exam.name}
            </button>
          )}
        </div>
      )}

      {selectedExamId && (
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={() => {
              setSelectedExamId(null);
              setOpenId(null);
            }}
            style={{ fontSize: 12.5, color: COLORS.inkMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12 }}
          >
            ← வேறு தேர்வு / Change exam
          </button>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['TA', 'EN'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: `1.5px solid ${language === l ? COLORS.ink : COLORS.line}`,
                  background: language === l ? COLORS.ink : '#fff',
                  color: language === l ? '#fff' : COLORS.ink,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {l === 'TA' ? 'தமிழ்' : 'English'}
              </button>
            ))}
          </div>

          {notesLoading && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>…</p>}
          {!notesLoading && notes.length === 0 && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>Study notes coming soon.</p>}

          {notes.map((note) => (
            <div key={note.subjectId} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(openId === note.subjectId ? null : note.subjectId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 14,
                  background: 'transparent',
                  border: 'none',
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: COLORS.ink,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{language === 'TA' && note.subjectNameTa ? note.subjectNameTa : note.subjectName}</span>
                <span style={{ color: COLORS.inkMuted }}>{openId === note.subjectId ? '−' : '+'}</span>
              </button>
              {openId === note.subjectId && (
                <div style={{ padding: '0 14px 16px', fontSize: 13.5, lineHeight: 1.75, color: COLORS.ink, whiteSpace: 'pre-wrap' }}>{note.content}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
