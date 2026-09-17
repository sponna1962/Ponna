'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api-config';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Item = {
  id: string;
  date: string;
  headline: string;
  summary: string;
  sourceUrl: string | null;
  examRelevanceNote: string | null;
  verifiedAt: string;
};

function splitHeadline(headline: string) {
  const match = headline.match(/^\[([^\]]+)\]\s*(.*)$/);
  return match ? { category: match[1], title: match[2] } : { category: 'நடப்பு நிகழ்வு', title: headline };
}

function dateKey(value: string) { return new Date(value).toISOString().slice(0, 10); }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ta-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

export default function CurrentAffairsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/current-affairs?limit=1200'))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'நடப்பு நிகழ்வுகளை ஏற்ற முடியவில்லை');
        return data as Item[];
      })
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const groups: { date: string; items: Item[] }[] = [];
    for (const item of items) {
      const key = dateKey(item.date);
      const last = groups[groups.length - 1];
      if (!last || last.date !== key) groups.push({ date: key, items: [item] });
      else last.items.push(item);
    }
    return groups;
  }, [items]);

  return (
    <main style={{ minHeight: '100vh', background: COLORS.paper, color: COLORS.ink, fontFamily: FONT_FAMILY }}>
      <BitterFontLinks />
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,253,247,0.96)', borderBottom: `1px solid ${COLORS.line}`, backdropFilter: 'blur(8px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <StudentMenu />
          <div><div style={{ fontSize: 21, fontWeight: 800 }}>நடப்பு நிகழ்வுகள்</div><div style={{ fontSize: 12, color: COLORS.inkMuted }}>தினமும் படித்து தெரிந்துகொள்ளுங்கள்</div></div>
        </div>
      </header>

      <section style={{ maxWidth: 900, margin: '0 auto', padding: '22px 18px 70px' }}>
        <div style={{ background: '#f6efe1', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: '15px 16px', marginBottom: 22 }}>
          <strong>📖 இது படிப்பதற்கான பகுதி.</strong>
          <div style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.65, color: COLORS.inkMuted }}>தேர்வுக்கு பயன்படும் முக்கியமான நிகழ்வுகள் மட்டும் சுருக்கமாக வழங்கப்படுகின்றன. புதிய நிகழ்வுகள் மேலே சேரும்; பழைய நிகழ்வுகள் கீழே தொடர்ந்து இருக்கும்.</div>
        </div>

        {loading && <p style={{ color: COLORS.inkMuted }}>நடப்பு நிகழ்வுகள் ஏற்றப்படுகின்றன...</p>}
        {error && <p style={{ color: '#b42318' }}>{error}</p>}
        {!loading && !error && grouped.length === 0 && <p style={{ color: COLORS.inkMuted }}>இன்னும் நடப்பு நிகழ்வுகள் வெளியிடப்படவில்லை.</p>}

        {grouped.map((group) => (
          <section key={group.date} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: COLORS.line }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap' }}>{formatDate(group.items[0].date)}</h2>
              <div style={{ height: 1, flex: 1, background: COLORS.line }} />
            </div>
            {group.items.map((item, index) => {
              const { category, title } = splitHeadline(item.headline);
              const relevance = item.examRelevanceNote?.split('\n').find((line) => line.startsWith('தேர்வுக்கு முக்கியம்:'))?.replace('தேர்வுக்கு முக்கியம்:', '').trim();
              const memory = item.examRelevanceNote?.split('\n').find((line) => line.startsWith('நினைவில் வைக்க:'))?.replace('நினைவில் வைக்க:', '').trim();
              return (
                <article key={item.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: '17px 17px 15px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.035)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}><span style={{ fontSize: 11, fontWeight: 800, color: COLORS.gold, background: '#fbf3df', borderRadius: 999, padding: '4px 9px' }}>{category}</span><span style={{ fontSize: 11, color: COLORS.inkMuted }}>#{index + 1}</span></div>
                  <h3 style={{ margin: '0 0 9px', fontSize: 18, lineHeight: 1.35 }}>{title}</h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75 }}>{item.summary}</p>
                  {relevance && <div style={{ marginTop: 12, padding: '9px 11px', background: '#f7f9fc', borderRadius: 9, fontSize: 13, lineHeight: 1.55 }}><strong>தேர்வுக்கு முக்கியம்:</strong> {relevance}</div>}
                  {memory && <div style={{ marginTop: 7, fontSize: 12.5, color: COLORS.inkMuted }}><strong>நினைவில் வைக்க:</strong> {memory}</div>}
                  {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: COLORS.gold, textDecoration: 'none', fontWeight: 700 }}>ஆதாரம் ↗</a>}
                </article>
              );
            })}
          </section>
        ))}
      </section>
    </main>
  );
}
