'use client';

// TNPSC Group 4 SEO landing hub (Sept 2026). Content grounded in the
// official Combined Civil Services Examination — IV syllabus (Code 496,
// dated 12.12.2024): single objective paper, SSLC standard, 200 questions
// total across General Studies, Aptitude & Mental Ability, and the Tamil
// Eligibility-cum-Scoring Test (or General English for differently-abled
// candidates only).

import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';
import { SeoPageHeader, Breadcrumb } from '../../components/SeoPageHeader';

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{children}</h2>;
}

function Section({ children }: { children: React.ReactNode }) {
  return <section style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px 44px' }}>{children}</section>;
}

const UNITS = [
  ['General Science', '5', 'இயற்பியல், வேதியியல், உயிரியல் — அன்றாட அறிவியல் கருத்துக்கள்'],
  ['Geography', '5', 'தமிழ்நாடு மற்றும் இந்தியா — நிலவியல், வளங்கள், பேரிடர் மேலாண்மை'],
  ['History, Culture of India & Indian National Movement', '10', 'சிந்து சமவெளி முதல் சுதந்திரப் போராட்டம் வரை'],
  ['Indian Polity', '15', 'அரசியலமைப்பு, உரிமைகள், நிர்வாக அமைப்பு'],
  ['Indian Economy & Development Administration in TN', '20', 'பொருளாதாரம், திட்டங்கள், தமிழ்நாட்டு வளர்ச்சி'],
  ['History, Culture, Heritage & Socio-Political Movements of TN', '20', 'தமிழக வரலாறு, பண்பாடு, சமூக இயக்கங்கள்'],
];

export default function TnpscGroup4Page() {
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, paddingBottom: 60 }}>
      <BitterFontLinks />
      <SeoPageHeader />
      <Breadcrumb items={[{ name: 'Home', url: '/' }, { name: 'TNPSC Group 4', url: '/tnpsc-group-4' }]} />

      <Section>
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: 700, margin: '20px 0 10px', lineHeight: 1.2 }}>
          TNPSC Group 4 — Syllabus, Exam Pattern & Free Practice
        </h1>
        <p style={{ fontSize: 16, color: COLORS.inkMuted, lineHeight: 1.7 }}>
          TNPSC Group 4 (Combined Civil Services Examination — IV) நேரடியா தமிழ்நாடு அரசு துறைகளில் Village Administrative Officer, Junior Assistant, Typist போன்ற பணிகளுக்கு
          ஆட்சேர்ப்பு செய்யும் தேர்வு — Tamil Nadu Public Service Commission (TNPSC) நடத்துகிறது.
        </p>
      </Section>

      <Section>
        <H2>தேர்வு அமைப்பு (Exam Pattern)</H2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: COLORS.inkMuted, marginBottom: 16 }}>
          SSLC தரத்தில், ஒரே Objective-type paper — மொத்தம் <strong>200 கேள்விகள்</strong>. Negative marking கிடையாது.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `2px solid ${COLORS.line}` }}>
                <th style={{ padding: '8px 6px' }}>பகுதி</th>
                <th style={{ padding: '8px 6px' }}>கேள்விகள்</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <td style={{ padding: '8px 6px' }}>Part A — General Studies</td>
                <td style={{ padding: '8px 6px' }}>75</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <td style={{ padding: '8px 6px' }}>Part B — Aptitude and Mental Ability</td>
                <td style={{ padding: '8px 6px' }}>25</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 6px' }}>Part C — Tamil Eligibility-cum-Scoring Test *</td>
                <td style={{ padding: '8px 6px' }}>100</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12.5, color: COLORS.inkMuted, marginTop: 10 }}>
          * மாற்றுத்திறனாளி (Differently Abled) விண்ணப்பதாரர்களுக்கு Part C-க்கு பதிலாக General English track இருக்கிறது.
        </p>
      </Section>

      <Section>
        <H2>General Studies — Unit-வாரியான Marks</H2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `2px solid ${COLORS.line}` }}>
                <th style={{ padding: '8px 6px' }}>Unit</th>
                <th style={{ padding: '8px 6px' }}>Marks</th>
              </tr>
            </thead>
            <tbody>
              {UNITS.map(([name, marks]) => (
                <tr key={name} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td style={{ padding: '8px 6px' }}>{name}</td>
                  <td style={{ padding: '8px 6px' }}>{marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <H2>PONNA-வுடன் எப்படி தயாராவது</H2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: COLORS.inkMuted, marginBottom: 18 }}>
          Subject-வாரியான practice, முந்தைய ஆண்டு கேள்விகள், மற்றும் ஒவ்வொரு கேள்விக்கும் உடனடி விடை — இவை மூன்றையும் PONNA இலவசமாகவும், Annual Plan-லும் தருகிறது.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            ['முந்தைய ஆண்டு கேள்விகள்', 'Previous year TNPSC Group 4 question papers, subject-வாரியாக பிரிக்கப்பட்டவை.', '/tnpsc-group-4/previous-year-questions'],
            ['Online Test', 'நேரம் குறித்த, real-exam மாதிரி online mock test.', '/tnpsc-group-4/online-test'],
            ['Question Bank', 'Indian Polity முதல் தமிழ் தகுதி வரை, subject-வாரியான ஆயிரக்கணக்கான கேள்விகள்.', '/tnpsc-group-4/question-bank'],
          ].map(([title, desc, href]) => (
            <a
              key={href}
              href={href}
              style={{ display: 'block', padding: '16px 18px', border: `1px solid ${COLORS.line}`, borderRadius: 12, textDecoration: 'none', color: COLORS.ink }}
            >
              <strong style={{ fontSize: 15 }}>{title} →</strong>
              <p style={{ fontSize: 13.5, color: COLORS.inkMuted, margin: '4px 0 0' }}>{desc}</p>
            </a>
          ))}
        </div>
      </Section>

      <Section>
        <a
          href="/quiz"
          style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, fontWeight: 700, textDecoration: 'none', fontSize: 15 }}
        >
          இலவசமாக Practice தொடங்குங்கள் / Start Practising Free
        </a>
        <p style={{ fontSize: 12.5, color: COLORS.inkMuted, textAlign: 'center', marginTop: 10 }}>
          தினமும் புதிய நடப்பு நிகழ்வுகள் வேண்டுமா? <a href="/current-affairs" style={{ color: COLORS.gold }}>Current Affairs பக்கத்தைப் பாருங்கள்</a>.
        </p>
      </Section>
    </main>
  );
}
