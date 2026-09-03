'use client';

// Live Exam — nav placeholder only (finalized requirement). Detailed
// functionality/rules to be designed and implemented separately later.

import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

export default function LiveExamPage() {
  const { t } = useLanguage();
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.menu.liveExam}</h1>
      </div>
      <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.comingSoon}</p>
      </div>
    </main>
  );
}
