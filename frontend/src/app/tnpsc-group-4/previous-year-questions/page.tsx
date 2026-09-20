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
          { name: 'Previous Year Questions', url: '/tnpsc-group-4/previous-year-questions' },
        ]}
      />
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 30px' }}>
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.2 }}>
          TNPSC Group 4 Previous Year Question Papers
        </h1>
        <p style={{ fontSize: 15.5, color: COLORS.inkMuted, lineHeight: 1.75, marginBottom: 16 }}>
          முந்தைய ஆண்டு கேள்விகள் பயிற்சி செய்வது, real exam-ல் அடிக்கடி repeat ஆகும் கேள்வி வகைகளையும், TNPSC-யின் கேள்வி கேட்கும் style-ஐயும் புரிந்துகொள்ள
          மிகவும் உதவும். PONNA-வில் முந்தைய ஆண்டு Group 4 கேள்விகள் subject-வாரியாக பிரிக்கப்பட்டு, ஒவ்வொரு கேள்விக்கும் பிறகும் சரியான விடை உடனடியாக காட்டப்படும்.
        </p>
        <p style={{ fontSize: 15.5, color: COLORS.inkMuted, lineHeight: 1.75, marginBottom: 24 }}>
          Practising previous year TNPSC Group 4 papers helps you spot recurring question patterns and get comfortable with the exact SSLC-standard difficulty
          level TNPSC sets questions at, across General Studies, Aptitude & Mental Ability, and the Tamil Eligibility Test.
        </p>
        <a
          href="/quiz"
          style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, fontWeight: 700, textDecoration: 'none', fontSize: 15, marginBottom: 20 }}
        >
          Previous Year Questions Practice செய்யுங்கள்
        </a>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13.5 }}>
          <a href="/tnpsc-group-4/online-test" style={{ color: COLORS.gold, textDecoration: 'underline' }}>Online Test →</a>
          <a href="/tnpsc-group-4/question-bank" style={{ color: COLORS.gold, textDecoration: 'underline' }}>Question Bank →</a>
          <a href="/tnpsc-group-4" style={{ color: COLORS.gold, textDecoration: 'underline' }}>TNPSC Group 4 Overview →</a>
        </div>
      </section>
    </main>
  );
}
