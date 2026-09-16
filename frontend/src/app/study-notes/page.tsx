'use client';

// Student-facing Study Notes (Sept 2026, Group IV first). See
// schema.prisma's own header comment on StudyNote. Public (no login
// required, same spirit as syllabus/download-link content) -- only
// ever reviewed notes are ever returned by the backend.

import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api-config';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';
import { StudentMenu } from '../../components/StudentMenu';

type Note = { subjectId: string; subjectName: string; subjectNameTa: string | null; content: string };

export default function StudyNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [language, setLanguage] = useState<'TA' | 'EN'>('TA');
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl('/public/primary-exam'))
      .then((r) => (r.ok ? r.json() : null))
      .then((exam) => {
        if (!exam?.id) return [];
        return fetch(apiUrl(`/study-notes?subCategoryId=${exam.id}&language=${language}`)).then((r) => (r.ok ? r.json() : []));
      })
      .then((data: Note[]) => setNotes(data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [language]);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40, background: COLORS.paper, minHeight: '100dvh' }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 20, margin: 0 }}>Study Notes</h1>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
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

        {loading && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>…</p>}
        {!loading && notes.length === 0 && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>Study notes coming soon.</p>}

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
    </main>
  );
}
