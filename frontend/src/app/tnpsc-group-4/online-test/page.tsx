'use client';

import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../../lib/brand-theme';
import { SeoPageHeader, Breadcrumb } from '../../../components/SeoPageHeader';

export default function Page() {
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, paddingBottom: 60 }}>
      <BitterFontLinks />
      <SeoPageHeader />
      <Breadcrumb
        items={[
          { name: 'Home', url: '/' },
          { name: 'TNPSC Group 4', url: '/tnpsc-group-4' },
          { name: 'Online Test', url: '/tnpsc-group-4/online-test' },
        ]}
      />
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 30px' }}>
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.2 }}>
          TNPSC Group 4 Online Test
        </h1>
        <p style={{ fontSize: 15.5, color: COLORS.inkMuted, lineHeight: 1.75, marginBottom: 16 }}>
          உண்மையான தேர்வு நேரத்திற்கு ஒத்த, 200 கேள்விகள் கொண்ட full-length mock test PONNA-வில் இருக்கிறது — Part A General Studies (75),
          Part B Aptitude and Mental Ability (25), Part C தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு (100). முடிந்தவுடன் உங்கள் மதிப்பெண், subject-வாரியான
          பலம்/பலவீனம் பகுப்பாய்வு கிடைக்கும்.
        </p>
        <p style={{ fontSize: 15.5, color: COLORS.inkMuted, lineHeight: 1.75, marginBottom: 24 }}>
          A timed, full-length TNPSC Group 4 mock test matching the real exam's structure — 200 questions across General Studies, Aptitude & Mental Ability, and
          the Tamil Eligibility Test — followed by a subject-wise performance breakdown so you know exactly where to focus next.
        </p>
        <a
          href="/live-exam"
          style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, fontWeight: 700, textDecoration: 'none', fontSize: 15, marginBottom: 20 }}
        >
          Online Test தொடங்குங்கள்
        </a>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13.5 }}>
          <a href="/tnpsc-group-4/previous-year-questions" style={{ color: COLORS.gold, textDecoration: 'underline' }}>Previous Year Questions →</a>
          <a href="/tnpsc-group-4/question-bank" style={{ color: COLORS.gold, textDecoration: 'underline' }}>Question Bank →</a>
          <a href="/tnpsc-group-4" style={{ color: COLORS.gold, textDecoration: 'underline' }}>TNPSC Group 4 Overview →</a>
        </div>
      </section>
    </main>
  );
}
