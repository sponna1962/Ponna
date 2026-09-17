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
  headlineEn: string | null;
  summaryEn: string | null;
  sourceUrl: string | null;
  examRelevanceNote: string | null;
  examRelevanceNoteEn: string | null;
  verifiedAt: string;
};

function splitHeadline(headline: string, fallbackCategory: string) {
  const match = headline.match(/^\[([^\]]+)\]\s*(.*)$/);
  return match ? { category: match[1], title: match[2] } : { category: fallbackCategory, title: headline };
}

function dateKey(value: string) { return new Date(value).toISOString().slice(0, 10); }

function formatDate(value: string, lang: 'ta' | 'en') {
  return new Intl.DateTimeFormat(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

const STRINGS = {
  ta: {
    subtitle: 'தினமும் படித்து தெரிந்துகொள்ளுங்கள்',
    bannerTitle: '📖 இது படிப்பதற்கான பகுதி.',
    bannerBody: 'தேர்வுக்கு பயன்படும் முக்கியமான நிகழ்வுகள் மட்டும் சுருக்கமாக வழங்கப்படுகின்றன. புதிய நிகழ்வுகள் மேலே சேரும்; பழைய நிகழ்வுகள் கீழே தொடர்ந்து இருக்கும்.',
    loading: 'நடப்பு நிகழ்வுகள் ஏற்றப்படுகின்றன...',
    empty: 'இன்னும் நடப்பு நிகழ்வுகள் வெளியிடப்படவில்லை.',
    relevanceLabel: 'தேர்வுக்கு முக்கியம்:',
    memoryLabel: 'நினைவில் வைக்க:',
    source: 'ஆதாரம் ↗',
    fallbackCategory: 'நடப்பு நிகழ்வு',
  },
  en: {
    subtitle: 'Read and learn every day',
    bannerTitle: '📖 This section is for reading.',
    bannerBody: 'Only the events most relevant for your exam are summarised here. New events are added at the top; older ones stay below.',
    loading: 'Loading current affairs...',
    empty: 'No current affairs have been published yet.',
    relevanceLabel: 'Important for the exam:',
    memoryLabel: 'Remember:',
    source: 'Source ↗',
    fallbackCategory: 'Current Affairs',
  },
} as const;
// The page title itself stays "Current Affairs" in English regardless of
// the content-language toggle below (Sept 2026, explicit request) — only
// the article content and supporting labels switch with the toggle.
const PAGE_TITLE = 'Current Affairs';

export default function CurrentAffairsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<'ta' | 'en'>('ta');
  const s = STRINGS[lang];

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
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,253,247,0.98)', borderBottom: `1px solid ${COLORS.line}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <StudentMenu />
          <div style={{ flex: 1 }}><div style={{ fontSize: 21, fontWeight: 800 }}>{PAGE_TITLE}</div><div style={{ fontSize: 12, color: COLORS.inkMuted }}>{s.subtitle}</div></div>
          <div style={{ display: 'flex', border: `1px solid ${COLORS.line}`, borderRadius: 999, padding: 2 }}>
            {(['ta', 'en'] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 11px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: lang === code ? COLORS.ink : 'transparent',
                  color: lang === code ? COLORS.paper : COLORS.inkMuted,
                }}
              >
                {code === 'ta' ? 'தமிழ்' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section style={{ maxWidth: 900, margin: '0 auto', padding: '22px 18px 70px' }}>
        <div style={{ background: '#f6efe1', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: '15px 16px', marginBottom: 22 }}>
          <strong>{s.bannerTitle}</strong>
          <div style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.65, color: COLORS.inkMuted }}>{s.bannerBody}</div>
        </div>

        {loading && <p style={{ color: COLORS.inkMuted }}>{s.loading}</p>}
        {error && <p style={{ color: '#b42318' }}>{error}</p>}
        {!loading && !error && grouped.length === 0 && <p style={{ color: COLORS.inkMuted }}>{s.empty}</p>}

        {grouped.map((group) => (
          <section key={group.date} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: COLORS.line }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap' }}>{formatDate(group.items[0].date, lang)}</h2>
              <div style={{ height: 1, flex: 1, background: COLORS.line }} />
            </div>
            {group.items.map((item, index) => {
              const useEnglish = lang === 'en' && !!item.headlineEn;
              const { category, title } = useEnglish
                ? splitHeadline(item.headlineEn!, s.fallbackCategory)
                : splitHeadline(item.headline, s.fallbackCategory);
              const summary = useEnglish && item.summaryEn ? item.summaryEn : item.summary;
              const relevanceNote = useEnglish && item.examRelevanceNoteEn ? item.examRelevanceNoteEn : item.examRelevanceNote;
              const relevance = relevanceNote?.split('\n').find((line) => line.startsWith(s.relevanceLabel))?.replace(s.relevanceLabel, '').trim();
              const memory = relevanceNote?.split('\n').find((line) => line.startsWith(s.memoryLabel))?.replace(s.memoryLabel, '').trim();
              return (
                <article key={item.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: '17px 17px 15px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.035)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}><span style={{ fontSize: 11, fontWeight: 800, color: COLORS.gold, background: '#fbf3df', borderRadius: 999, padding: '4px 9px' }}>{category}</span><span style={{ fontSize: 11, color: COLORS.inkMuted }}>#{index + 1}</span></div>
                  <h3 style={{ margin: '0 0 9px', fontSize: 18, lineHeight: 1.35 }}>{title}</h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75 }}>{summary}</p>
                  {relevance && <div style={{ marginTop: 12, padding: '9px 11px', background: '#f7f9fc', borderRadius: 9, fontSize: 13, lineHeight: 1.55 }}><strong>{s.relevanceLabel}</strong> {relevance}</div>}
                  {memory && <div style={{ marginTop: 7, fontSize: 12.5, color: COLORS.inkMuted }}><strong>{s.memoryLabel}</strong> {memory}</div>}
                  {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: COLORS.gold, textDecoration: 'none', fontWeight: 700 }}>{s.source}</a>}
                </article>
              );
            })}
          </section>
        ))}
      </section>
    </main>
  );
}
