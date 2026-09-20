'use client';

// TNTET SEO landing hub (Sept 2026). Facts grounded in the Tamil Nadu
// Teacher Eligibility Test as conducted by the Teachers Recruitment Board
// (TRB): two papers, 150 MCQs / 150 marks / 3 hours each, no negative
// marking, 60% general qualifying mark with reserved-category relaxation.

import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';
import { SeoPageHeader, Breadcrumb } from '../../components/SeoPageHeader';

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{children}</h2>;
}

function Section({ children }: { children: React.ReactNode }) {
  return <section style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px 44px' }}>{children}</section>;
}

export default function TntetPage() {
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, paddingBottom: 60 }}>
      <BitterFontLinks />
      <SeoPageHeader />
      <Breadcrumb items={[{ name: 'Home', url: '/' }, { name: 'TNTET', url: '/tntet' }]} />

      <Section>
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: 700, margin: '20px 0 10px', lineHeight: 1.2 }}>
          TNTET — Paper 1 & Paper 2 Syllabus, Exam Pattern & Practice
        </h1>
        <p style={{ fontSize: 16, color: COLORS.inkMuted, lineHeight: 1.7 }}>
          Tamil Nadu Teacher Eligibility Test (TNTET)-ஐ Teachers Recruitment Board (TRB), Tamil Nadu நடத்துகிறது. தமிழ்நாட்டு அரசு மற்றும் aided
          பள்ளிகளில் ஆசிரியராக பணியாற்ற இந்த தேர்வில் தகுதி பெற வேண்டும்.
        </p>
      </Section>

      <Section>
        <H2>இரண்டு Papers</H2>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ padding: '16px 18px', border: `1px solid ${COLORS.line}`, borderRadius: 12 }}>
            <strong style={{ fontSize: 15 }}>Paper 1 — Classes 1 to 5 (Primary)</strong>
            <p style={{ fontSize: 13.5, color: COLORS.inkMuted, margin: '4px 0 0' }}>
              Child Development & Pedagogy, Language I, Language II, Mathematics, Environmental Studies — 150 questions, 150 marks.
            </p>
          </div>
          <div style={{ padding: '16px 18px', border: `1px solid ${COLORS.line}`, borderRadius: 12 }}>
            <strong style={{ fontSize: 15 }}>Paper 2 — Classes 6 to 8 (Upper Primary)</strong>
            <p style={{ fontSize: 13.5, color: COLORS.inkMuted, margin: '4px 0 0' }}>
              Child Development & Pedagogy, Language I, Language II, Mathematics & Science or Social Science — 150 questions, 150 marks.
            </p>
          </div>
        </div>
        <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginTop: 14, lineHeight: 1.7 }}>
          இரண்டு papers-உமே objective-type, 3 மணி நேரம், negative marking கிடையாது. பொது தகுதி மதிப்பெண் 60% (reserved categories-க்கு relaxation உண்டு).
          Classes 1-8 வரை கற்பிக்க விரும்புபவர்கள் இரண்டு papers-க்கும் விண்ணப்பிக்கலாம்.
        </p>
      </Section>

      <Section>
        <H2>Paper-வாரியான Practice</H2>
        <div style={{ display: 'grid', gap: 10 }}>
          <a href="/tntet/paper-1" style={{ display: 'block', padding: '16px 18px', border: `1px solid ${COLORS.line}`, borderRadius: 12, textDecoration: 'none', color: COLORS.ink }}>
            <strong style={{ fontSize: 15 }}>TNTET Paper 1 Syllabus & Practice →</strong>
          </a>
          <a href="/tntet/paper-2" style={{ display: 'block', padding: '16px 18px', border: `1px solid ${COLORS.line}`, borderRadius: 12, textDecoration: 'none', color: COLORS.ink }}>
            <strong style={{ fontSize: 15 }}>TNTET Paper 2 Syllabus & Practice →</strong>
          </a>
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
          தேர்வுக்கு முன் உங்கள் நிலையை அறிய <a href="/test-your-ability" style={{ color: COLORS.gold }}>Free Diagnostic Test</a> எடுங்கள்.
        </p>
      </Section>
    </main>
  );
}
