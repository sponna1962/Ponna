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
import { ProtectLayer } from '../../components/ProtectLayer';
import { ShareButton } from '../../components/ShareButton';

type Note = { subjectId: string; subjectName: string; subjectNameTa: string | null; content: string };
type Exam = { id: string; name: string };


/** Study notes are stored as plain lines (headings and points look alike), so
 * the structure is recovered here for display only — stored text is untouched:
 *  - "1. பூமியின் அமைவிடம்"   -> main section heading
 *  - short line without a full stop -> sub-heading
 *  - short "term – meaning." lines   -> bullet points (term in bold)
 *  - everything else                 -> normal paragraph
 * Leading spaces/tabs from pasted text are ignored so alignment is uniform. */
function NoteBody({ content }: { content: string }) {
  // Pasted-from-Word lists carry an invisible private-use bullet (U+F0B7 etc.)
  // and zero-width marks at the start of lines; they show up as a blank gap.
  const lines = content
    .replace(/\r/g, '')
    .replace(/[\uE000-\uF8FF\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .split('\n')
    .map((l) => l.replace(/^[\s\u00a0\u3000•·▪●○◦]+|[\s\u00a0\u3000]+$/g, ''));
  const blocks: JSX.Element[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} style={{ margin: '4px 0 10px', padding: 0, listStyle: 'none' }}>
        {bullets.map((b, i) => {
          const dash = b.indexOf(' – ');
          return (
            <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: COLORS.gold, flex: 'none' }}>•</span>
              <span>{dash > 0 && dash < 40 ? (<><strong>{b.slice(0, dash)}</strong>{b.slice(dash)}</>) : b}</span>
            </li>
          );
        })}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    if (!line) { flush('f' + i); return; }
    const isMain = /^\d+\.\s/.test(line) && line.length < 80;
    const endsSentence = /[.!?।]$/.test(line);
    const isSub = !isMain && !endsSentence && line.length <= 45 && !/\d{3,}/.test(line);
    const isPoint = !isMain && !isSub && line.length <= 90 && endsSentence;
    if (isMain || (isSub && i === 0)) {
      flush('f' + i);
      blocks.push(<div key={i} style={{ fontWeight: 800, fontSize: isMain ? 16.5 : 15.5, margin: '16px 0 6px', color: COLORS.ink }}>{line}</div>);
    } else if (isSub) {
      flush('f' + i);
      blocks.push(<div key={i} style={{ fontWeight: 700, color: COLORS.gold, margin: '12px 0 4px' }}>{line}</div>);
    } else if (isPoint) {
      bullets.push(line);
    } else {
      flush('f' + i);
      blocks.push(<p key={i} style={{ margin: '0 0 10px' }}>{line}</p>);
    }
  });
  flush('end');
  return <>{blocks}</>;
}

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
    <main className="ponna-protect" style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40, background: COLORS.paper, color: COLORS.ink, minHeight: '100dvh' }}>
      <BitterFontLinks />
      <ProtectLayer />
      <div className="ponna-noprint" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>Study Notes</h1>
      </div>

      {!selectedExamId && (
        <div style={{ padding: '0 16px' }}>
          <p style={{ fontSize: 14.5, color: COLORS.inkMuted, margin: '0 0 14px' }}>தேர்வைத் தேர்வு செய்யுங்கள் / Select an exam</p>
          {loading && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>…</p>}
          {!loading && !exam && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>No exam is currently available.</p>}
          {exam && (
            <button
              onClick={() => setSelectedExamId(exam.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                textAlign: 'left',
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${COLORS.line}`,
                borderLeft: '5px solid #E2B04A',
                background: 'var(--color-card)',
                cursor: 'pointer',
                fontSize: 16.5,
                fontWeight: 700,
                color: COLORS.ink,
              }}
            >
              <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--color-goldDisc)', display: 'grid', placeItems: 'center', fontSize: 20, flex: 'none' }}>🎯</span>
              <span style={{ flex: 1 }}>{exam.name}</span>
              <span aria-hidden="true" style={{ fontSize: 26, color: 'var(--color-gold)' }}>›</span>
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
            style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-gold)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 14 }}
          >
            ← வேறு தேர்வு / Change exam
          </button>

          <div style={{ display: 'flex', gap: 6, background: 'var(--color-field)', border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 4, marginBottom: 16 }}>
            {(['TA', 'EN'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                style={{
                  flex: 1,
                  padding: 9,
                  borderRadius: 6,
                  border: 'none',
                  background: language === l ? 'var(--color-btn)' : 'transparent',
                  color: language === l ? 'var(--color-btnText)' : COLORS.inkMuted,
                  fontSize: 14,
                  fontWeight: 700,
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
            <div key={note.subjectId} style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderLeft: openId === note.subjectId ? '5px solid #E2B04A' : `1px solid ${COLORS.line}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(openId === note.subjectId ? null : note.subjectId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: COLORS.ink,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-goldDisc)', display: 'grid', placeItems: 'center', fontSize: 16, flex: 'none' }}>📘</span>
                <span style={{ flex: 1 }}>{language === 'TA' && note.subjectNameTa ? note.subjectNameTa : note.subjectName}</span>
                <span style={{ color: 'var(--color-gold)', fontSize: 22, fontWeight: 600 }}>{openId === note.subjectId ? '−' : '+'}</span>
              </button>
              {openId === note.subjectId && (
                <div style={{ padding: '0 16px 16px 16px', fontSize: 15, lineHeight: 1.8, color: COLORS.ink }}>
                  <NoteBody content={note.content} />
                  <div style={{ marginTop: 14 }}>
                    <ShareButton
                      title={`${language === 'TA' && note.subjectNameTa ? note.subjectNameTa : note.subjectName} — Study Notes`}
                      text={`📘 ${language === 'TA' && note.subjectNameTa ? note.subjectNameTa : note.subjectName} — TNPSC Group 4 படிப்புக் குறிப்புகள்\nPONNA.in`}
                      path="/study-notes"
                      label={language === 'TA' ? 'இந்தக் குறிப்புகளைப் பகிர்க ↗' : 'Share these notes ↗'}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
