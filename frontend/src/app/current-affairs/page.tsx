'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../../lib/api-config';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { ProtectLayer } from '../../components/ProtectLayer';
import { ShareButton } from '../../components/ShareButton';
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
  // Header is position:fixed (not sticky) so it stays put on every phone/browser;
  // a spacer of the same measured height keeps the content from sliding under it.
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerH, setHeaderH] = useState(72);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderH(el.offsetHeight);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  // null = not known yet; false = logged-out visitor (read-only, last 7 days)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
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

  // News is shown only from the day the student joined (first login)
  // onward — older news is hidden. Logged-out visitors see everything.
  useEffect(() => {
    // Logged-out visitors can read this page: skip the profile call (a 401 there
    // would redirect them to the home page).
    if (!localStorage.getItem('ponna_student_token')) { setLoggedIn(false); return; }
    setLoggedIn(true);
    studentFetch('/students/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (p?.createdAt) setJoinedAt(dateKey(p.createdAt)); })
      .catch(() => {})
      .finally(() => setProfileLoaded(true));
  }, []);

  const grouped = useMemo(() => {
    const groups: { date: string; items: Item[] }[] = [];
    if (loggedIn === null || (loggedIn && !profileLoaded)) return groups; // avoid flashing old news
    // Logged-out visitors: last 7 days only. Students: from their join day onward.
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const fromKey = loggedIn ? joinedAt : sevenDaysAgo;
    for (const item of items) {
      if (fromKey && dateKey(item.date) < fromKey) continue;
      const key = dateKey(item.date);
      const last = groups[groups.length - 1];
      if (!last || last.date !== key) groups.push({ date: key, items: [item] });
      else last.items.push(item);
    }
    return groups;
  }, [items, joinedAt, loggedIn, profileLoaded]);

  return (
    <main className="ponna-protect" style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: COLORS.paper, color: COLORS.ink, fontFamily: FONT_FAMILY }}>
      <BitterFontLinks />
      <ProtectLayer />
      <header ref={headerRef} className="ponna-noprint" style={{ position: 'fixed', top: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', zIndex: 20, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <StudentMenu iconColor="#fff" />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{PAGE_TITLE}</div><div style={{ fontSize: 12, color: '#FFE9A8' }}>{s.subtitle}</div></div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,233,168,0.5)', borderRadius: 8, padding: 3 }}>
            {(['ta', 'en'] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: lang === code ? '#FFE9A8' : 'transparent',
                  color: lang === code ? '#2b1c00' : '#e5f1f0',
                }}
              >
                {code === 'ta' ? 'தமிழ்' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div style={{ height: headerH }} aria-hidden />

      <section style={{ padding: '22px 16px 70px' }}>
        <div style={{ background: 'var(--color-goldDisc)', border: `1px solid ${COLORS.line}`, borderLeft: '5px solid #E2B04A', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <strong style={{ fontSize: 15 }}>{s.bannerTitle}</strong>
          <div style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.65, color: COLORS.inkMuted }}>{s.bannerBody}</div>
        </div>

        {loading && <p style={{ color: COLORS.inkMuted }}>{s.loading}</p>}
        {error && <p style={{ color: 'var(--color-bad)' }}>{error}</p>}
        {!loading && !error && loggedIn !== null && (!loggedIn || profileLoaded) && grouped.length === 0 && <p style={{ color: COLORS.inkMuted }}>{s.empty}</p>}

        {grouped.map((group) => (
          <section key={group.date} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: COLORS.line }} />
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', background: COLORS.paperAlt, color: COLORS.ink, padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLORS.line}` }}>{formatDate(group.items[0].date, lang)}</h2>
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
                <article key={item.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderLeft: '4px solid #FFD22A', borderRadius: 10, padding: '15px 15px 15px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}><span style={{ fontSize: 12, fontWeight: 800, color: COLORS.gold, background: 'var(--color-goldDisc)', borderRadius: 4, padding: '4px 9px' }}>{category}</span><span style={{ fontSize: 12, color: COLORS.inkMuted }}>#{index + 1}</span></div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, lineHeight: 1.45 }}>{title}</h3>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8 }}>{summary}</p>
                  {relevance && <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-field)', borderLeft: '4px solid #E2B04A', borderRadius: 6, fontSize: 13.5, lineHeight: 1.65 }}><strong>{s.relevanceLabel}</strong> {relevance}</div>}
                  {memory && <div style={{ marginTop: 8, fontSize: 13, color: COLORS.inkMuted }}><strong>{s.memoryLabel}</strong> {memory}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 10 }}>
                    <ShareButton
                      title={title}
                      text={[`📰 ${title}`, '', summary, relevance ? `\n${s.relevanceLabel} ${relevance}` : '', '', 'PONNA.in — நடப்பு நிகழ்வுகள்'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')}
                      path="/current-affairs"
                      label={lang === 'ta' ? 'பகிர்க ↗' : 'Share ↗'}
                    />
                    {item.sourceUrl && <a className="ponna-noprint" href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: COLORS.gold, textDecoration: 'none', fontWeight: 700 }}>{s.source}</a>}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
        {loggedIn === false && (
          <div style={{ marginTop: 8, padding: 16, textAlign: 'center', background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 10 }}>
            <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.6 }}>மேலும் செய்திகளையும் பயிற்சிகளையும் பெற Login செய்யுங்கள்.</p>
            <a href="/?startLogin=1" style={{ display: 'block', padding: 13, borderRadius: 14, background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700, fontSize: 15.5, textDecoration: 'none' }}>Login / Sign up</a>
          </div>
        )}
      </section>
    </main>
  );
}
