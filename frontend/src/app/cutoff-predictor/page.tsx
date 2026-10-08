'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { ExamHierarchyPicker } from '../../components/ExamHierarchyPicker';
import { COLORS, BitterFontLinks } from '../../lib/brand-theme';

type CutoffRecord = {
  year: number;
  cutoffMarks: number;
  cutoffMin: number | null;
  cutoffMax: number | null;
  totalMarks: number | null;
  isOfficialConfirmed: boolean;
  sourceUrl: string | null;
  verifiedAt: string;
};

type Prediction =
  | { access: 'FREE_LOCKED' }
  | { access: 'NEEDS_COMMUNITY' }
  | { access: 'AVAILABLE'; community: string; records: CutoffRecord[]; studentAccuracy: number | null; studentQuestionsAnswered: number };

const GOLD = '#D7A63A';
const NAVY = '#0B3157';
const BLUE = '#123F69';
const PALE_BLUE = '#F3F7FA';
const PALE_GOLD = '#FBF6E8';
const GREEN = '#176B4D';
const RED = '#A33A3A';

function communityLabel(value: string) {
  const map: Record<string, string> = { OC: 'OC / பொதுப்பிரிவு', BC: 'BC', BCM: 'BCM', MBC_DNC: 'MBC / DNC', SC: 'SC', SCA: 'SCA', ST: 'ST' };
  return map[value] || value;
}
function markText(r: CutoffRecord) {
  if (r.cutoffMin !== null && r.cutoffMax !== null && r.cutoffMin !== r.cutoffMax) return r.cutoffMin + '–' + r.cutoffMax;
  return String(r.cutoffMarks);
}
function recordKind(r: CutoffRecord, isTamil: boolean) {
  if (r.isOfficialConfirmed) return isTamil ? 'அதிகாரப்பூர்வ தரவு' : 'Official data';
  return isTamil ? 'அந்த ஆண்டுக்கான தரவு' : 'Year data';
}

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
    setPrediction(null); setLoadError(null); setLoading(true);
    studentFetch('/cutoff-predictor/' + selectedExamId)
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
    if (!prediction || prediction.access !== 'AVAILABLE' || !prediction.records.length || prediction.studentAccuracy === null) return null;
    const latest = prediction.records[0];
    const totalMarks = latest.totalMarks ?? 300;
    const practiceScore = Math.round((prediction.studentAccuracy / 100) * totalMarks);
    const min = latest.cutoffMin ?? latest.cutoffMarks;
    const max = latest.cutoffMax ?? latest.cutoffMarks;
    return { latest, totalMarks, practiceScore, min, max, status: practiceScore >= max ? 'above' : practiceScore >= min ? 'within' : 'below', gap: practiceScore >= max ? practiceScore - max : min - practiceScore };
  }, [prediction]);

  const label = {
    title: isTamil ? 'கட்-ஆஃப் கணிப்பான்' : 'Cut-off Predictor',
    eyebrow: isTamil ? 'தேர்வு தயாரிப்பு கருவி' : 'EXAM PREPARATION TOOL',
    intro: isTamil ? 'உங்கள் PONNA பயிற்சி மதிப்பெண்ணை, கடந்த ஆண்டுகளின் சரிபார்க்கப்பட்ட மற்றும் எதிர்பார்க்கப்படும் கட்-ஆஃப் தரவுகளுடன் ஒப்பிட்டு உங்கள் தற்போதைய நிலையைப் புரிந்துகொள்ள உதவும் கருவி.' : 'Compare your PONNA practice score with historical and expected cut-off benchmarks to understand where you stand.',
    selectExam: isTamil ? 'தேர்வைத் தேர்வு செய்யவும்' : 'Select your exam',
    how: isTamil ? 'இது எப்படி உதவும்?' : 'How it helps',
    howBody: isTamil ? 'உங்கள் Community-க்கு ஏற்ப கடந்த ஆண்டு தரவைப் பார்த்து, உங்கள் பயிற்சி மதிப்பெண் அந்த அளவுக்கு மேல் உள்ளதா, அருகில் உள்ளதா அல்லது இன்னும் உயர்த்த வேண்டுமா என்பதை அறியலாம்.' : 'See the benchmark for your Community and understand whether your practice score is above, near, or below the historical range.',
    steps: isTamil ? ['தேர்வைத் தேர்வு செய்யுங்கள்', 'Profile-ல் Community-ஐ பதிவு செய்யுங்கள்', 'PONNA-வில் குறைந்தது 20 கேள்விகள் பயிற்சி செய்யுங்கள்', 'உங்கள் பயிற்சி மதிப்பெண்ணை கட்-ஆஃப் வரம்புடன் ஒப்பிடுங்கள்'] : ['Choose your exam', 'Set your Community in Profile', 'Complete at least 20 practice questions', 'Compare your practice score with the cut-off range'],
    benchmark: isTamil ? 'கட்-ஆஃப் தரவு' : 'Cut-off benchmark',
    yourScore: isTamil ? 'உங்கள் பயிற்சி மதிப்பெண்' : 'Your practice score',
    range: isTamil ? 'கட்-ஆப் வரம்பு' : 'Cut-off range',
    above: isTamil ? 'வரம்பை விட அதிகம்' : 'Above the range',
    within: isTamil ? 'வரம்புக்குள் உள்ளது' : 'Within the range',
    below: isTamil ? 'மேலும் மதிப்பெண் தேவை' : 'Below the range',
    history: isTamil ? 'ஆண்டு வாரியான தரவு' : 'Year-wise data',
    verified: isTamil ? 'சரிபார்க்கப்பட்டது' : 'Verified',
    source: isTamil ? 'ஆதாரம்' : 'Source',
    note: isTamil ? 'குறிப்பு: ஒவ்வொரு ஆண்டும் காட்டப்படும் மதிப்பெண்கள் அந்த ஆண்டுக்கான கிடைக்கக்கூடிய கட்-ஆஃப் / கட்-ஆஃப் மதிப்பீட்டு தரவின் அடிப்படையில் தொகுக்கப்பட்டவை. அதிகாரப்பூர்வ TNPSC தரவு கிடைக்கும் இடங்களில் அதற்கே முன்னுரிமை வழங்கப்படும். இந்தக் கருவி தேர்வு முடிவை உறுதி செய்யாது.' : 'Note: Each year is shown as that year’s available cut-off / cut-off estimate. Official TNPSC data is preferred wherever available. This tool does not guarantee selection.',
    noData: isTamil ? 'இந்தத் தேர்வுக்கான தரவு இல்லை.' : 'No cut-off data is available for this exam.',
    loading: isTamil ? 'தரவைத் தயாரிக்கிறது…' : 'Loading benchmark…',
    choose: isTamil ? 'மேலே உள்ள தேர்வைத் தேர்வு செய்தவுடன் தரவு இங்கே தோன்றும்.' : 'Select an exam above to view the benchmark.',
    needCommunity: isTamil ? 'உங்கள் Community-ஐ Profile-ல் பதிவு செய்த பிறகு இந்த வசதியைப் பயன்படுத்தலாம்.' : 'Set your Community in Profile to use the predictor.',
    locked: isTamil ? 'இந்த வசதி உங்கள் திட்டத்தில் கிடைக்கவில்லை.' : 'This feature is not included in your current plan.',
    viewPlans: isTamil ? 'திட்டங்களைப் பார்க்கவும்' : 'View plans',
    profile: isTamil ? 'Profile-க்கு செல்லவும்' : 'Go to Profile',
    questions: isTamil ? 'கேள்விகள் முடித்துள்ளீர்கள்' : 'questions completed',
  };

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E9EE', borderRadius: 14, boxShadow: '0 6px 22px rgba(18,63,105,0.06)' };

  return (
    <main style={{ minHeight: '100dvh', background: '#F7F9FA', color: '#18344C' }}>
      <BitterFontLinks />
      <header style={{ background: NAVY, color: '#fff' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu iconColor="#fff" />
          <div><div style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: 800, opacity: .72 }}>{label.eyebrow}</div><h1 style={{ margin: '2px 0 0', fontSize: 20, lineHeight: 1.25, fontWeight: 800, color: '#fff' }}>{label.title}</h1></div>
        </div>
        <div style={{ height: 4, background: 'linear-gradient(90deg, #D7A63A, #F1D28A, #D7A63A)' }} />
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 16px 48px' }}>
        <section style={{ ...card, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ padding: '22px 20px', background: 'linear-gradient(135deg, #FBF6E8, #fff)' }}>
            <div style={{ width: 42, height: 3, background: GOLD, marginBottom: 12 }} />
            <h2 style={{ margin: '0 0 8px', fontSize: 21, lineHeight: 1.35, color: NAVY }}>{isTamil ? 'உங்கள் இலக்கு மதிப்பெண் எவ்வளவு?' : 'What should your target score be?'}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#4A5E70' }}>{label.intro}</p>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 8 }}>{label.how}</div>
            <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.65, color: '#607181' }}>{label.howBody}</p>
            <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {label.steps.map((step, i) => <div key={step} style={{ padding: '10px 9px', background: PALE_BLUE, borderRadius: 9, minHeight: 68 }}><div style={{ fontSize: 10, fontWeight: 900, color: GOLD, marginBottom: 5 }}>0{i + 1}</div><div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#365067', fontWeight: 650 }}>{step}</div></div>)}
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 9 }}><div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: GOLD }}>{isTamil ? '01 · தேர்வு' : '01 · EXAM'}</div><h2 style={{ margin: '3px 0 0', fontSize: 17, color: NAVY }}>{label.selectExam}</h2></div>
          <div style={{ ...card, padding: 12 }}><ExamHierarchyPicker onSelect={handleSelect} selectedName={selectedExamName} /></div>
        </section>

        {!selectedExamId && <div style={{ ...card, padding: 18, textAlign: 'center', color: '#6B7D8D', fontSize: 13 }}>{label.choose}</div>}
        {loading && selectedExamId && <div style={{ ...card, padding: 30, textAlign: 'center' }}><div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid #E6EDF2', borderTopColor: GOLD, margin: '0 auto 10px' }} /><div style={{ fontSize: 13, color: '#66798A' }}>{label.loading}</div></div>}
        {loadError && !loading && <div style={{ ...card, padding: 18, borderColor: '#E6CACA', background: '#FFF7F7', color: RED, fontSize: 13 }}>{loadError}</div>}

        {prediction?.access === 'FREE_LOCKED' && <div style={{ ...card, padding: 24, textAlign: 'center' }}><div style={{ fontSize: 26, marginBottom: 8 }}>🔒</div><h3 style={{ margin: '0 0 7px', color: NAVY }}>{label.locked}</h3><a href="/plans" style={{ display: 'inline-block', marginTop: 8, padding: '11px 20px', background: NAVY, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 800 }}>{label.viewPlans}</a></div>}
        {prediction?.access === 'NEEDS_COMMUNITY' && <div style={{ ...card, padding: 24, textAlign: 'center' }}><h3 style={{ margin: '0 0 7px', color: NAVY }}>{label.needCommunity}</h3><a href="/profile" style={{ display: 'inline-block', marginTop: 8, padding: '11px 20px', background: NAVY, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 800 }}>{label.profile}</a></div>}

        {prediction?.access === 'AVAILABLE' && (prediction.records.length === 0 ? (
          <div style={{ ...card, padding: 22, textAlign: 'center' }}><h3 style={{ margin: 0, color: NAVY }}>{label.noData}</h3></div>
        ) : (
          <>
            <section style={{ ...card, overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ padding: '11px 16px', background: NAVY, color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div><div style={{ fontSize: 10, letterSpacing: .9, opacity: .72 }}>{label.benchmark}</div><div style={{ fontSize: 13, fontWeight: 800 }}>{communityLabel(prediction.community)}</div></div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#F6D88B' }}>மொத்தம் 300</div>
              </div>
              {comparison ? (
                <div style={{ padding: 18 }}>
                  <div className="score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ padding: 14, background: PALE_BLUE, borderRadius: 10 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#65798A', marginBottom: 5 }}>{label.yourScore}</div><div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{comparison.practiceScore}<span style={{ fontSize: 13, fontWeight: 700, color: '#80909D' }}> / {comparison.totalMarks}</span></div><div style={{ marginTop: 4, fontSize: 11, color: '#687B8B' }}>{prediction.studentAccuracy}% · {prediction.studentQuestionsAnswered} {label.questions}</div></div>
                    <div style={{ padding: 14, background: PALE_GOLD, borderRadius: 10 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#806C42', marginBottom: 5 }}>{comparison.latest.year} · {label.range}</div><div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{markText(comparison.latest)}<span style={{ fontSize: 13, fontWeight: 700, color: '#80909D' }}> / 300</span></div><div style={{ marginTop: 4, fontSize: 11, color: '#806C42' }}>{recordKind(comparison.latest, isTamil)}</div></div>
                  </div>
                  <div style={{ marginTop: 12, padding: '11px 13px', borderRadius: 9, background: comparison.status === 'above' ? '#EFF8F3' : comparison.status === 'within' ? '#FFF8E8' : '#FFF3F3', color: comparison.status === 'above' ? GREEN : comparison.status === 'within' ? '#85651C' : RED, fontSize: 13, fontWeight: 850 }}>
                    {comparison.status === 'above' ? '✓ ' + label.above + (comparison.gap ? ' · +' + comparison.gap : '') : comparison.status === 'within' ? '• ' + label.within : '↑ ' + label.below + ' · ' + comparison.gap + (isTamil ? ' மதிப்பெண்கள் கூடுதல் தேவை' : ' marks to reach the range')}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 18, fontSize: 13, lineHeight: 1.6, color: '#66798A' }}>{prediction.studentQuestionsAnswered < 20 ? (isTamil ? 'குறைந்தது 20 கேள்விகள் முடித்த பிறகு உங்கள் பயிற்சி நிலை இங்கே ஒப்பிடப்படும். இப்போது ' + prediction.studentQuestionsAnswered + ' கேள்விகள் முடித்துள்ளீர்கள்.' : 'Complete at least 20 questions to compare your practice score. You have completed ' + prediction.studentQuestionsAnswered + '.') : (isTamil ? 'உங்கள் பயிற்சி மதிப்பெண் கிடைக்கும்போது இங்கே ஒப்பீடு காட்டப்படும்.' : 'Your practice comparison will appear here.')}</div>
              )}
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}><h2 style={{ margin: 0, fontSize: 16, color: NAVY }}>{label.history}</h2><span style={{ fontSize: 10, color: '#778897' }}>{prediction.records.length} years</span></div>
              <div style={{ ...card, overflow: 'hidden' }}>
                {prediction.records.map((r, index) => (
                  <div key={r.year} style={{ padding: '15px 16px', borderBottom: index === prediction.records.length - 1 ? 'none' : '1px solid #E7EDF1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                      <div><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{r.year}</span><span style={{ fontSize: 9.5, fontWeight: 850, padding: '4px 7px', borderRadius: 20, background: r.isOfficialConfirmed ? '#EAF6F0' : '#EEF3F7', color: r.isOfficialConfirmed ? GREEN : '#536B7C' }}>{recordKind(r, isTamil)}</span></div><div style={{ marginTop: 4, fontSize: 11.5, color: '#718290' }}>{communityLabel(prediction.community)} · 300 மதிப்பெண்கள்</div></div>
                      <div style={{ textAlign: 'right' }}><div style={{ fontSize: 23, lineHeight: 1, fontWeight: 900, color: NAVY }}>{markText(r)}</div><div style={{ marginTop: 4, fontSize: 9.5, color: '#81909B' }}>marks</div></div>
                    </div>
                    <div style={{ marginTop: 9, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10.5, color: '#778896' }}><span>{label.verified}: {new Date(r.verifiedAt).toLocaleDateString()}</span>{r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: BLUE, fontWeight: 700 }}>{label.source} ↗</a>}</div>
                  </div>
                ))}
              </div>
            </section>
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#F2F5F7', borderLeft: '3px solid ' + GOLD, fontSize: 11, lineHeight: 1.6, color: '#607181' }}>{label.note}</div>
          </>
        ))}
      </div>

      <style jsx>{`
        @media (max-width: 520px) {
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .score-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}