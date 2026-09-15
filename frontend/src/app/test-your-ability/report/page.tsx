'use client';

// Test Your Ability — report page (Sept 2026, Item 4). Shown right
// after a guest completes signup and their diagnostic attempt is
// claimed (see page.tsx's attemptLogin — claim happens there, this page
// just fetches and displays the resulting report). Server-side enforces
// that the report is only ever returned once claimed by the requesting
// student — see guest-diagnostic.service.ts's own getReport() comment.

import { useEffect, useState } from 'react';
import { studentFetch } from '../../../lib/student-fetch';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../../lib/brand-theme';

type Report = {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  subjectBreakdown: { subject: string; total: number; correct: number }[];
};

export default function TestYourAbilityReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const guestId = localStorage.getItem('ponna_guest_diagnostic_id');
    if (!guestId) {
      setError('எந்த diagnostic result-உம் கிடைக்கவில்லை.');
      setLoading(false);
      return;
    }
    studentFetch(`/guest-diagnostic/${guestId}/report`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) {
          setError(body.error ?? 'Result-ஐ ஏற்ற முடியவில்லை.');
          return;
        }
        setReport(body);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', padding: 20, background: COLORS.paper, color: COLORS.ink }}>
      <BitterFontLinks />
      <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 800, marginBottom: 16 }}>உங்க Result</h1>

      {loading && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>…</p>}
      {error && <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p>}

      {report && (
        <>
          <div style={{ textAlign: 'center', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
            <p style={{ fontFamily: FONT_FAMILY, fontSize: 40, fontWeight: 800, color: COLORS.gold, margin: '0 0 4px' }}>
              {report.correctCount} / {report.answeredCount}
            </p>
            <p style={{ fontSize: 13, color: COLORS.inkMuted }}>சரியான பதில்கள்</p>
          </div>

          <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Subject-வாரியான Breakdown
          </p>
          {report.subjectBreakdown.map((s) => (
            <div key={s.subject} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${COLORS.line}` }}>
              <span style={{ fontSize: 14 }}>{s.subject}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {s.correct}/{s.total}
              </span>
            </div>
          ))}

          <a
            href="/"
            style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 700, marginTop: 24 }}
          >
            Practice தொடங்குங்கள்
          </a>
        </>
      )}
    </main>
  );
}
