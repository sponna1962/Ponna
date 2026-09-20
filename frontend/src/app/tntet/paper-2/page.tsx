'use client';

import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../../lib/brand-theme';
import { SeoPageHeader, Breadcrumb } from '../../../components/SeoPageHeader';

const SUBJECTS: [string, string][] = [
  ['Child Development and Pedagogy', '30'],
  ['Language I (Tamil/other)', '30'],
  ['Language II (English)', '30'],
  ['Mathematics & Science, or Social Science', '60'],
];

export default function Page() {
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, paddingBottom: 60 }}>
      <BitterFontLinks />
      <SeoPageHeader />
      <Breadcrumb items={[{ name: 'Home', url: '/' }, { name: 'TNTET', url: '/tntet' }, { name: 'Paper 2', url: '/tntet/paper-2' }]} />
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 30px' }}>
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.2 }}>
          TNTET Paper 2 — Classes 6 to 8 (Upper Primary Level)
        </h1>
        <p style={{ fontSize: 15.5, color: COLORS.inkMuted, lineHeight: 1.75, marginBottom: 16 }}>
          TNTET Paper 2, Upper Primary level (Classes 6-8) ஆசிரியர் பணிகளுக்கான தகுதி தேர்வு. 150 objective-type questions, 150 marks, 3 மணி நேரம், negative
          marking கிடையாது. Mathematics & Science அல்லது Social Science — உங்கள் subject choice-ன் அடிப்படையில் ஒன்றை தேர்வு செய்யலாம்.
        </p>
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `2px solid ${COLORS.line}` }}>
                <th style={{ padding: '8px 6px' }}>Subject</th>
                <th style={{ padding: '8px 6px' }}>Marks</th>
              </tr>
            </thead>
            <tbody>
              {SUBJECTS.map(([name, marks]) => (
                <tr key={name} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td style={{ padding: '8px 6px' }}>{name}</td>
                  <td style={{ padding: '8px 6px' }}>{marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a
          href="/quiz"
          style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, fontWeight: 700, textDecoration: 'none', fontSize: 15, marginBottom: 20 }}
        >
          TNTET Paper 2 Practice தொடங்குங்கள்
        </a>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13.5 }}>
          <a href="/tntet/paper-1" style={{ color: COLORS.gold, textDecoration: 'underline' }}>TNTET Paper 1 →</a>
          <a href="/tntet" style={{ color: COLORS.gold, textDecoration: 'underline' }}>TNTET Overview →</a>
        </div>
      </section>
    </main>
  );
}
