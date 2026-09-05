'use client';

// Cut-off Marks Predictor (finalized requirement, ₹999 Annual Plan
// value-add). Compares verified historical cut-off marks against the
// student's own tracked practice accuracy — presented explicitly as an
// approximate, practice-based indicator, never a guaranteed prediction.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Exam = { id: string; name: string };
type CutoffRecord = { year: number; cutoffMarks: number; totalMarks: number | null; sourceUrl: string | null; verifiedAt: string };
type Prediction =
  | { access: 'FREE_LOCKED' }
  | { access: 'NEEDS_COMMUNITY' }
  | { access: 'AVAILABLE'; community: string; records: CutoffRecord[]; studentAccuracy: number | null; studentQuestionsAnswered: number };

export default function CutoffPredictorPage() {
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  useEffect(() => {
    studentFetch('/subject-preference/exams')
      .then((r) => r.json())
      .then((data: Exam[]) => {
        setExams(data);
        if (data.length > 0) setSelectedExamId(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    setPrediction(null);
    studentFetch(`/cutoff-predictor/${selectedExamId}`)
      .then((r) => r.json())
      .then(setPrediction);
  }, [selectedExamId]);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.cutoffPredictor.title}</h1>
      </div>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>{t.cutoffPredictor.note}</p>

      {exams.length > 0 && (
        <label style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 14 }}
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {prediction?.access === 'FREE_LOCKED' && (
        <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 14, padding: 24, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.cutoffPredictor.lockedTitle}</p>
          <p style={{ fontSize: 13, color: '#5C4009', marginBottom: 16 }}>{t.cutoffPredictor.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {prediction?.access === 'NEEDS_COMMUNITY' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.ink, marginBottom: 16 }}>{t.cutoffPredictor.needsCommunity}</p>
          <a href="/profile" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            {t.cutoffPredictor.goToProfile}
          </a>
        </div>
      )}

      {prediction?.access === 'AVAILABLE' && (
        <>
          {prediction.records.length === 0 ? (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: 0 }}>{t.cutoffPredictor.noData}</p>
            </div>
          ) : (
            <>
              {prediction.records.map((r) => (
                <div key={r.year} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 4 }}>
                    {r.year} · {prediction.community}
                  </p>
                  <p style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, color: COLORS.gold, margin: 0 }}>
                    {r.cutoffMarks}
                    {r.totalMarks ? ` / ${r.totalMarks}` : ''}
                  </p>
                  <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 6 }}>
                    {new Date(r.verifiedAt).toLocaleDateString()}
                    {r.sourceUrl && (
                      <>
                        {' · '}
                        <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                          {t.cutoffPredictor.source}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              ))}

              <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 12, padding: 14, marginTop: 16, background: COLORS.goldLight }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#5C4009', marginBottom: 6 }}>{t.cutoffPredictor.yourStanding}</p>
                {prediction.studentQuestionsAnswered < 20 ? (
                  <p style={{ fontSize: 13, color: '#5C4009', margin: 0 }}>{t.cutoffPredictor.needMorePractice}</p>
                ) : (
                  <p style={{ fontSize: 13, color: '#5C4009', margin: 0 }}>
                    {t.cutoffPredictor.yourAccuracy}: <b>{prediction.studentAccuracy}%</b> ({prediction.studentQuestionsAnswered} {t.cutoffPredictor.questionsAnswered})
                  </p>
                )}
                <p style={{ fontSize: 11, color: '#7A5A14', marginTop: 8 }}>{t.cutoffPredictor.disclaimer}</p>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
