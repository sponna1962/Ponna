'use client';

// Help & Support — minimal placeholder page linked from the student nav
// menu (finalized navigation requirement). Contact channel is a simple
// mailto for now; can grow into a real FAQ/ticket flow later without
// affecting anything else in the app.

import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';

export default function HelpPage() {
  const { t, lang } = useLanguage();
  const isTamil = lang === 'ta';

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.menu.help}</h1>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <p style={{ fontSize: 14, color: '#334155', marginBottom: 12 }}>
          {isTamil
            ? 'ஏதேனும் சந்தேகங்கள் அல்லது பிரச்சனைகள் இருந்தால், எங்களை தொடர்பு கொள்ளுங்கள்:'
            : 'For any questions or issues, reach out to us:'}
        </p>
        <a href="mailto:support@ponna.in" style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}>
          📧 support@ponna.in
        </a>
      </div>
    </main>
  );
}
