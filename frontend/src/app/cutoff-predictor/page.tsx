'use client';

// Cut-off Marks Predictor — practice-based historical comparison.
// It never presents a guaranteed selection prediction. It compares the
// student's tracked practice accuracy with verified historical cut-off
// records entered by the admin from published sources.

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { ExamHierarchyPicker } from '../../components/ExamHierarchyPicker';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type CutoffRecord = { year: number; cutoffMarks: number; totalMarks: number | null; sourceUrl: string | null; verifiedAt: string };
type Prediction =
  | { access: 'FREE_LOCKED' }
  | { access: 'NEEDS_COMMUNITY' }
  | { access: 'AVAILABLE'; community: string; records: CutoffRecord[]; studentAccuracy: number | null; studentQuestionsAnswered: number };

export default function CutoffPredictorPage() {
  const { t } = useLanguage();
  const isTamil = t.common.langLabel === 'தமிழ்';
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExamName, setSelectedExamName] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  function handleSelect(subCategoryId: string, subCategoryName: string) {
    setSelectedExamId(subCategoryId);
    setSelectedExamName(subCategoryName);
  }

  useEffect(() => {
    if (!selectedExamId) return;
    setPrediction(null);
    setLoadError(null);
    setLoading(true);
    studentFetch(`/cutoff-predictor/${selectedExamId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error || (isTamil ? 'தரவை ஏற்ற முடியவில்லை.' : 'Could not load cut-off data.'));
        return body as Prediction;
      })
      .then(setPrediction)
      .catch((err) => setLoadError(err?.message || (isTamil ? 'தரவை ஏற்ற முடியவில்லை.' : 'Could not load cut-off data.')))
      .finally(() => setLoading(false));
  }, [selectedExamId, isTamil]);

  const comparison = useMemo(() => {
    if (!prediction || prediction.access !== 'AVAILABLE' || prediction.records.length === 0 || prediction.studentAccuracy === null) return null;
    const latest = prediction.records[0];
    const totalMarks = latest.totalMarks ?? 300;
    const practiceScore = Math.round((prediction.studentAccuracy / 100) * totalMarks);
    return {
      latest,
      totalMarks,
      practiceScore,
      difference: practiceScore - latest.cutoffMarks,
    };
  }, [prediction]);

  const label = {
    purpose: isTamil ? 'இந்த வசதி எதற்காக?' : 'What is this for?',
    purposeBody: isTamil
      ? 'உங்கள் PONNA பயிற்சி செயல்திறனை, நீங்கள் தேர்ந்தெடுத்த Community-க்கு கிடைக்கும் சரிபார்க்கப்பட்ட முந்தைய ஆண்டு cut-off பதிவுகளுடன் ஒப்பிடுவதற்கான வசதி இது. இது அதிகாரப்பூர்வ தேர்வு முடிவை கணிக்காது.'
      : 'This compares your PONNA practice performance with verified historical cut-off records for your selected Community. It does not predict an official result or guarantee selection.',
    steps: isTamil ? 'எப்படி செயல்படும்?' : 'How it works',
    step1: isTamil ? '1. தேர்வைத் தேர்வு செய்யுங்கள்.' : '1. Choose the exam.',
    step2: isTamil ? '2. Profile-ல் Community-ஐத் தேர்வு செய்யுங்கள்.' : '2. Set your Community in Profile.',
    step3: isTamil ? '3. PONNA-வில் குறைந்தது 20 கேள்விகள் பயிற்சி செய்யுங்கள்.' : '3. Practise at least 20 questions on PONNA.',
    step4: isTamil ? '4. உங்கள் Practice Accuracy-ஐ முந்தைய cut-off பதிவுகளுடன் ஒப்பிடுங்கள்.' : '4. Compare your Practice Accuracy with historical cut-off records.',
    selectExam: isTamil ? 'தேர்வைத் தேர்வு செய்யவும்' : 'Select an exam',
    loading: isTamil ? 'Cut-off தரவை ஏற்றுகிறது…' : 'Loading cut-off data…',
    noDataTitle: isTamil ? 'இந்தத் தேர்வுக்கான Cut-off தரவு இன்னும் சேர்க்கப்படவில்லை' : 'Cut-off data is not available for this exam yet',
    noDataBody: isTamil
      ? 'இந்தப் பகுதியில் எண்ணை ஊகித்து காட்டக்கூடாது. நிர்வாகப் பகுதியில் அதிகாரப்பூர்வ அறிவிப்பு அல்லது சரிபார்க்கப்பட்ட வரலாற்றுத் தரவிலிருந்து ஆண்டு, Community, மதிப்பெண், மொத்த மதிப்பெண், ஆதார இணைப்பு ஆகியவை சேர்க்கப்பட்ட பிறகே இங்கே காட்டப்படும்.'
      : 'PONNA should not guess a cut-off number. An admin must enter the year, Community, marks, total marks and source from an official or verified historical source before it is shown here.',
    historical: isTamil ? 'முந்தைய ஆண்டு Cut-off பதிவுகள்' : 'Historical cut-off records',
    practice: isTamil ? 'உங்கள் Practice Accuracy' : 'Your Practice Accuracy',
    projected: isTamil ? 'பயிற்சி மதிப்பெண் (தோராயம்)' : 'Practice score (approx.)',
    latestComparison: isTamil ? 'சமீபத்திய வரலாற்று Cut-off உடன் ஒப்பீடு' : 'Comparison with the latest historical cut-off',
    above: isTamil ? 'மேல்' : 'above',
    below: isTamil ? 'கீழ்' : 'below',
    current: isTamil ? 'தற்போதைய நிலை' : 'Current position',
    source: isTamil ? 'ஆதாரம்' : 'Source',
    verified: isTamil ? 'சரிபார்ப்பு தேதி' : 'Verified',
    notEnough: isTamil ? 'குறைந்தது 20 கேள்விகள் முடித்த பிறகு உங்கள் Practice Accuracy இங்கே காட்டப்படும்.' : 'Your Practice Accuracy will appear here after you complete at least 20 questions.',
    disclaimer: isTamil
      ? 'குறிப்பு: இது Practice Accuracy-ஐ அடிப்படையாகக் கொண்ட வரலாற்றுத் தரவு ஒப்பீடு மட்டுமே. உண்மையான தேர்வு மதிப்பெண், தரவரிசை அல்லது தேர்வை உறுதி செய்யாது.'
      : 'Note: this is only a historical comparison based on Practice Accuracy. It does not determine your actual exam marks, rank or selection.',
  };

  const gold4 = '#E2B04A';
  const cardBase: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16 };
  const topCard: React.CSSProperties = { ...cardBase, borderTop: `4px solid ${gold4}` };
  const leftCard: React.CSSProperties = { ...cardBase, borderLeft: `4px solid ${gold4}`, borderRadius: 12 };
  const linkBtn: React.CSSProperties = { display: 'block', padding: 14, borderRadius: 14, background: COLORS.btn, color: COLORS.btnText, textDecoration: 'none', fontWeight: 700, fontSize: 15, textAlign: 'center' };

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink, paddingBottom: 24 }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: `linear-gradient(180deg, ${COLORS.head1}, ${COLORS.head2})`, borderBottom: `3px solid ${gold4}` }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.cutoffPredictor.title}</h1>
      </div>
      <div style={{ padding: 16 }}>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: '0 0 14px', lineHeight: 1.5 }}>{t.cutoffPredictor.note}</p>

      <section style={{ ...leftCard, padding: '14px 16px', marginBottom: 18 }}>
        <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 6px' }}>{label.purpose}</p>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: COLORS.inkMuted, margin: '0 0 12px' }}>{label.purposeBody}</p>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 7px' }}>{label.steps}</p>
        <div style={{ display: 'grid', gap: 5, fontSize: 12.5, color: COLORS.inkMuted }}>
          <div>{label.step1}</div>
          <div>{label.step2}</div>
          <div>{label.step3}</div>
          <div>{label.step4}</div>
        </div>
      </section>

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{label.selectExam}</p>
        <ExamHierarchyPicker onSelect={handleSelect} selectedName={selectedExamName} />
      </div>

      {!selectedExamId && (
        <p style={{ fontSize: 13, color: COLORS.inkMuted, textAlign: 'center' }}>{t.cutoffPredictor.chooseExamFirst}</p>
      )}

      {loading && selectedExamId && (
        <div style={{ ...topCard, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: 0 }}>{label.loading}</p>
        </div>
      )}

      {loadError && !loading && (
        <div style={{ ...cardBase, border: `1px solid ${COLORS.bad}`, background: COLORS.badBg, padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: COLORS.bad, margin: 0 }}>{loadError}</p>
        </div>
      )}

      {prediction?.access === 'FREE_LOCKED' && (
        <div style={{ ...topCard, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: '0 0 8px' }}>🔒 {t.cutoffPredictor.lockedTitle}</p>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: '0 0 16px', lineHeight: 1.6 }}>{t.cutoffPredictor.lockedBody}</p>
          <a href="/plans" style={linkBtn}>{t.dailyQuiz.viewPlans}</a>
        </div>
      )}

      {prediction?.access === 'NEEDS_COMMUNITY' && (
        <div style={{ ...topCard, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.ink, margin: '0 0 16px', lineHeight: 1.6 }}>{t.cutoffPredictor.needsCommunity}</p>
          <a href="/profile" style={linkBtn}>{t.cutoffPredictor.goToProfile}</a>
        </div>
      )}

      {prediction?.access === 'AVAILABLE' && (
        <>
          {prediction.records.length === 0 ? (
            <div style={{ ...leftCard, padding: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: '0 0 8px' }}>{label.noDataTitle}</p>
              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: COLORS.inkMuted, margin: 0 }}>{label.noDataBody}</p>
            </div>
          ) : (
            <>
              {comparison && (
                <div style={{ ...topCard, padding: 16, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.gold, margin: '0 0 12px' }}>{label.latestComparison}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkMuted }}>{label.practice}</div>
                      <div style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, color: COLORS.ink }}>{comparison.practiceScore} / {comparison.totalMarks}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkMuted }}>{comparison.latest.year} Cut-off</div>
                      <div style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, color: COLORS.ink }}>{comparison.latest.cutoffMarks} / {comparison.totalMarks}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 0', padding: '9px 12px', borderRadius: 12, background: comparison.difference >= 0 ? COLORS.okBg : COLORS.badBg, color: comparison.difference >= 0 ? COLORS.ok : COLORS.bad }}>
                    {Math.abs(comparison.difference)} {comparison.difference >= 0 ? label.above : label.below} {comparison.latest.year} historical cut-off.
                  </p>
                </div>
              )}

              {!comparison && prediction.studentQuestionsAnswered < 20 && (
                <div style={{ ...leftCard, padding: 14, marginBottom: 16 }}>
                  <p style={{ fontSize: 12.5, color: COLORS.inkMuted, margin: 0, lineHeight: 1.6 }}>{label.notEnough}</p>
                </div>
              )}

              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>{label.historical}</p>
              {prediction.records.map((r) => (
                <div key={r.year} style={{ ...leftCard, padding: '12px 14px', marginBottom: 10 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.inkMuted, margin: '0 0 2px' }}>{r.year} · {prediction.community}</p>
                  <p style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, color: COLORS.gold, margin: 0 }}>
                    {r.cutoffMarks}{r.totalMarks ? ` / ${r.totalMarks}` : ''}
                  </p>
                  <p style={{ fontSize: 11, color: COLORS.inkMuted, margin: '6px 0 0' }}>
                    {label.verified}: {new Date(r.verifiedAt).toLocaleDateString()}
                    {r.sourceUrl && (
                      <>
                        {' · '}
                        <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.gold }}>{label.source}</a>
                      </>
                    )}
                  </p>
                </div>
              ))}
              <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 10, lineHeight: 1.5 }}>{label.disclaimer}</p>
            </>
          )}
        </>
      )}
      </div>
    </main>
  );
}
