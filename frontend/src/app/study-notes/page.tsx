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

import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../lib/api-config';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';
import { StudentMenu } from '../../components/StudentMenu';
import { rememberAfterLogin } from '../../lib/after-login';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(62);
  useEffect(() => { if (headRef.current) setHeadH(headRef.current.offsetHeight); }, [selectedExamId]);
  const nameOf = (n: Note) => (language === 'TA' && n.subjectNameTa ? n.subjectNameTa : n.subjectName);
  // Oct 2026 — the first subject is open to everyone; the rest are free but need
  // a (free) sign-up. After login the student lands back on the subject they chose.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { try { setSignedIn(!!localStorage.getItem('ponna_student_token')); } catch {} }, []);
  const isLocked = (n: Note) => !signedIn && notes.indexOf(n) > 0;
  function openSubject(id: string | null) {
    const target = notes.find((n) => n.subjectId === id);
    if (target && isLocked(target)) {
      rememberAfterLogin(`/study-notes?subject=${encodeURIComponent(target.subjectId)}`);
      window.location.href = '/?startLogin=1';
      return;
    }
    setOpenId(id);
    setMenuOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    if (notes.length === 0 || openId) return;
    const want = new URLSearchParams(window.location.search).get('subject');
    if (want && notes.some((n) => n.subjectId === want) && signedIn) setOpenId(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, signedIn]);
  const current = notes.find((n) => n.subjectId === openId) ?? null;
  const curIdx = current ? notes.indexOf(current) : -1;

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
      <div ref={headRef} className="ponna-noprint" style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
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
          {!current && (<>
          <button
            onClick={() => {
              setSelectedExamId(null);
              setOpenId(null);
              setMenuOpen(false);
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

          </>)}

          {notesLoading && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>…</p>}
          {!notesLoading && notes.length === 0 && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>Study notes coming soon.</p>}

          {!current && notes.length > 0 && (
            <p style={{ fontSize: 14.5, color: COLORS.inkMuted, margin: '0 0 12px' }}>{language === 'TA' ? 'பாடத்தைத் தேர்வு செய்யுங்கள்' : 'Choose a subject'}</p>
          )}
          {!current && !signedIn && notes.length > 1 && (
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: COLORS.ink, background: 'var(--color-goldDisc)', borderRadius: 10, padding: '10px 12px', margin: '0 0 12px' }}>
              {language === 'TA' ? 'முதல் பாடம் எல்லோருக்கும் திறந்துள்ளது. மற்ற எல்லாப் பாடங்களும் இலவசம் — ஒரு முறை இலவசமாகப் பதிவு செய்தால் போதும்.' : 'The first subject is open to everyone. All other subjects are free — just sign up once.'}
            </p>
          )}
          {!current && notes.map((note) => (
            <button
              key={note.subjectId}
              onClick={() => openSubject(note.subjectId)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 10, background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderLeft: '5px solid #E2B04A', borderRadius: 10, fontSize: 15.5, fontWeight: 700, color: COLORS.ink, cursor: 'pointer' }}
            >
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-goldDisc)', display: 'grid', placeItems: 'center', fontSize: 16, flex: 'none' }}>📘</span>
              <span style={{ flex: 1 }}>{nameOf(note)}</span>
              {isLocked(note)
                ? <span aria-label="Free sign-up" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-gold)', whiteSpace: 'nowrap' }}>🔒 {language === 'TA' ? 'இலவசப் பதிவு' : 'Free sign-up'}</span>
                : <span aria-hidden="true" style={{ fontSize: 24, color: 'var(--color-gold)' }}>›</span>}
            </button>
          ))}

          {current && (
            <div>
              {/* Stays visible while reading: back to the subject list, the subject name, and a one-tap subject switcher. */}
              <div className="ponna-noprint" style={{ position: 'sticky', top: headH, zIndex: 20, margin: '0 -16px 14px', padding: '9px 16px', background: 'var(--color-card)', borderBottom: '2px solid #E2B04A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => openSubject(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-gold)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>
                    ← {language === 'TA' ? 'பாடங்கள்' : 'Subjects'}
                  </button>
                  <span style={{ flex: 1, fontWeight: 800, fontSize: 16, color: COLORS.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📘 {nameOf(current)}</span>
                  <button onClick={() => setMenuOpen((v) => !v)} style={{ background: 'var(--color-btn)', color: 'var(--color-btnText)', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {language === 'TA' ? 'பாடம் மாற்று' : 'Change'} {menuOpen ? '▴' : '▾'}
                  </button>
                </div>
                {menuOpen && (
                  <div style={{ position: 'absolute', right: 12, top: '100%', marginTop: 4, width: 250, maxHeight: '60vh', overflowY: 'auto', background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
                    {notes.map((n) => (
                      <button key={n.subjectId} onClick={() => openSubject(n.subjectId)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: `1px solid ${COLORS.line}`, background: n.subjectId === current.subjectId ? 'var(--color-goldDisc)' : 'transparent', color: COLORS.ink, fontWeight: n.subjectId === current.subjectId ? 800 : 600, fontSize: 14.5, cursor: 'pointer' }}>
                        📘 {nameOf(n)} {n.subjectId === current.subjectId ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 15.5, lineHeight: 1.85, color: COLORS.ink }}>
                <NoteBody content={current.content} />
                <div style={{ marginTop: 14 }}>
                  <ShareButton
                    title={`${nameOf(current)} — Study Notes`}
                    text={`📘 ${nameOf(current)} — TNPSC Group 4 படிப்புக் குறிப்புகள்\nPONNA.in`}
                    path="/study-notes"
                    label={language === 'TA' ? 'இந்தக் குறிப்புகளைப் பகிர்க ↗' : 'Share these notes ↗'}
                  />
                </div>
              </div>

              <div className="ponna-noprint" style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                {[curIdx > 0 ? notes[curIdx - 1] : null, curIdx < notes.length - 1 ? notes[curIdx + 1] : null].map((n, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    {n && (
                      <button onClick={() => openSubject(n.subjectId)} style={{ width: '100%', padding: '11px 8px', borderRadius: 9, border: '1.5px solid var(--color-gold)', background: 'transparent', color: COLORS.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {i === 0 ? `‹ ${language === 'TA' ? 'முந்தைய' : 'Previous'}: ${nameOf(n)}` : `${language === 'TA' ? 'அடுத்த' : 'Next'}: ${nameOf(n)} ›`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
