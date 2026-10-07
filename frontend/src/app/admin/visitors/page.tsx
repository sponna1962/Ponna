'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Oct 2026 — Visitors: how many people are visiting PONNA.in, where they come
// from, which pages they open, and how many of them sign up. Counts are
// anonymous (see backend SiteVisit model); staff browsing and bots are excluded.

type Win = { visitors: number; pageviews: number; newVisitors: number; returning: number };
type Summary = {
  range: 'today' | '7' | '30';
  liveNow: number;
  today: Win; yesterday: Win; last7: Win; last30: Win;
  allTime: { visitors: number; pageviews: number; since: string | null };
  days: { day: string; visitors: number; pageviews: number; fromFacebook: number; signups: number }[];
  sources: { source: string; visitors: number }[];
  pages: { path: string; pageviews: number; visitors: number }[];
  devices: { device: string; visitors: number }[];
  hoursToday: { hour: number; pageviews: number }[];
  rangeSignups: number;
  rangeVisitors: number;
};

const PAGE_NAMES: Record<string, string> = {
  '/': 'Home (முகப்பு)',
  '/tnpsc-group-4/notification-2026': 'Group 4 அறிவிப்பு வழிகாட்டி',
  '/tnpsc-group-4': 'TNPSC Group 4',
  '/ask-ponna': 'Ask PONNA',
  '/quiz': 'Quiz (பயிற்சி)',
  '/dashboard': 'Dashboard',
  '/current-affairs': 'Current Affairs',
  '/plans': 'Plans (திட்டங்கள்)',
  '/mistakes': 'Review Mistakes',
  '/test-your-ability': 'Test Your Ability',
};

const SOURCE_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  direct: 'Direct (நேரடி / தெரியாதது)',
};

const DEVICE_NAMES: Record<string, string> = { mobile: '📱 Mobile', desktop: '💻 Desktop', tablet: 'Tablet' };

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#0f172a' };

function Bar({ value, max, color = '#0ea5a5' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 6, height: 10, flex: 1, minWidth: 60 }}>
      <div style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, height: 10, borderRadius: 6, background: color }} />
    </div>
  );
}

function Stat({ title, w }: { title: string; w: Win }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{w.visitors}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
        visitors · {w.pageviews} page views
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        🆕 {w.newVisitors} new · 🔁 {w.returning} returning
      </div>
    </div>
  );
}

function fmtDay(d: string) {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

export default function VisitorsPage() {
  const [range, setRange] = useState<'today' | '7' | '30'>('7');
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(`/admin/visitors/summary?range=${range}`);
      if (!res.ok) throw new Error('Could not load');
      setData(await res.json());
      setUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load visitor statistics');
    }
  }, [range]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) {
    return <div style={{ padding: 24 }}>{error ? <p style={{ color: '#b91c1c' }}>{error}</p> : 'Loading…'}</div>;
  }

  const maxDay = Math.max(1, ...data.days.map((d) => d.visitors));
  const maxHour = Math.max(1, ...data.hoursToday.map((h) => h.pageviews));
  const srcTotal = data.sources.reduce((a, s) => a + s.visitors, 0) || 1;
  const maxSrc = Math.max(1, ...data.sources.map((s) => s.visitors));
  const maxPage = Math.max(1, ...data.pages.map((p) => p.pageviews));
  const devTotal = data.devices.reduce((a, s) => a + s.visitors, 0) || 1;
  const conv = data.rangeVisitors > 0 ? ((data.rangeSignups / data.rangeVisitors) * 100).toFixed(1) : '0.0';
  const rangeLabel = range === 'today' ? 'Today' : range === '7' ? 'Last 7 days' : 'Last 30 days';
  const hoursMap = new Map(data.hoursToday.map((h) => [h.hour, h.pageviews]));

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Visitors (இணையதள வருகையாளர்கள்)</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: data.liveNow > 0 ? '#dcfce7' : '#f1f5f9', color: data.liveNow > 0 ? '#166534' : '#64748b', padding: '6px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}>
            ● Live now (கடந்த 5 நிமிடம்): {data.liveNow}
          </span>
          <button onClick={load} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 16px' }}>
        Anonymous counts — no names or phone numbers are stored. Bots and staff browsing are not counted. Times are IST.
        {updated ? ` Updated ${updated.toLocaleTimeString()}.` : ''}
        {data.allTime.since ? ` Counting since ${new Date(data.allTime.since).toLocaleString()}.` : ' No visits recorded yet.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Stat title="Today (இன்று)" w={data.today} />
        <Stat title="Yesterday (நேற்று)" w={data.yesterday} />
        <Stat title="Last 7 days" w={data.last7} />
        <Stat title="Last 30 days" w={data.last30} />
        <div style={card}>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 6 }}>All time (மொத்தம்)</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{data.allTime.visitors}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>visitors · {data.allTime.pageviews} page views</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#475569' }}>Details for:</span>
        {([['today', 'Today'], ['7', '7 days'], ['30', '30 days']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setRange(k)} style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid ' + (range === k ? '#0f172a' : '#cbd5e1'), background: range === k ? '#0f172a' : '#fff', color: range === k ? '#fff' : '#0f172a', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 18, background: '#f0fdfa', borderColor: '#99f6e4' }}>
        <div style={{ fontSize: 14, color: '#0f172a' }}>
          <strong>{rangeLabel}:</strong> {data.rangeVisitors} visitors → <strong>{data.rangeSignups} new sign-ups</strong>
          {' '}(<strong>{conv}%</strong> of visitors signed up)
        </div>
      </div>

      <div style={{ ...card, marginBottom: 18 }}>
        <h2 style={h2}>Daily visitors — last 14 days (தினசரி வருகை)</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12 }}>
                <th style={{ padding: '6px 8px' }}>Date</th>
                <th style={{ padding: '6px 8px', width: '36%' }}>Visitors</th>
                <th style={{ padding: '6px 8px' }}>Page views</th>
                <th style={{ padding: '6px 8px' }}>From Facebook / Instagram</th>
                <th style={{ padding: '6px 8px' }}>New sign-ups</th>
              </tr>
            </thead>
            <tbody>
              {[...data.days].reverse().map((d) => (
                <tr key={d.day} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{fmtDay(d.day)}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Bar value={d.visitors} max={maxDay} />
                      <strong style={{ minWidth: 28, textAlign: 'right' }}>{d.visitors}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '7px 8px' }}>{d.pageviews}</td>
                  <td style={{ padding: '7px 8px' }}>{d.fromFacebook}</td>
                  <td style={{ padding: '7px 8px', fontWeight: d.signups ? 700 : 400, color: d.signups ? '#166534' : undefined }}>{d.signups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 18 }}>
        <div style={card}>
          <h2 style={h2}>Where visitors came from — {rangeLabel} (எங்கிருந்து வந்தார்கள்)</h2>
          {data.sources.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>No data yet.</p>}
          {data.sources.map((s) => (
            <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13.5 }}>
              <div style={{ width: 150, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {SOURCE_NAMES[s.source] ?? (s.source === 'internal' ? 'Internal' : s.source.replace('other:', ''))}
              </div>
              <Bar value={s.visitors} max={maxSrc} color={s.source === 'facebook' || s.source === 'instagram' ? '#2563eb' : '#0ea5a5'} />
              <div style={{ width: 80, textAlign: 'right' }}><strong>{s.visitors}</strong> <span style={{ color: '#64748b', fontSize: 12 }}>({Math.round((s.visitors / srcTotal) * 100)}%)</span></div>
            </div>
          ))}
          <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '10px 0 0' }}>
            “Direct” = typed address, bookmark, or an app that hides where the click came from. Facebook ad clicks are counted under Facebook.
          </p>
        </div>

        <div style={card}>
          <h2 style={h2}>Devices — {rangeLabel} (சாதனங்கள்)</h2>
          {data.devices.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>No data yet.</p>}
          {data.devices.map((d) => (
            <div key={d.device} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13.5 }}>
              <div style={{ width: 110, flex: 'none' }}>{DEVICE_NAMES[d.device] ?? d.device}</div>
              <Bar value={d.visitors} max={devTotal} color="#7c3aed" />
              <div style={{ width: 80, textAlign: 'right' }}><strong>{d.visitors}</strong> <span style={{ color: '#64748b', fontSize: 12 }}>({Math.round((d.visitors / devTotal) * 100)}%)</span></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 18 }}>
        <h2 style={h2}>Most visited pages — {rangeLabel} (அதிகம் பார்த்த பக்கங்கள்)</h2>
        {data.pages.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>No data yet.</p>}
        {data.pages.map((p) => (
          <div key={p.path} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13.5 }}>
            <div style={{ width: 260, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.path}>
              {PAGE_NAMES[p.path] ?? p.path}
            </div>
            <Bar value={p.pageviews} max={maxPage} />
            <div style={{ width: 150, textAlign: 'right', fontSize: 12.5 }}><strong>{p.pageviews}</strong> views · {p.visitors} people</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={h2}>Today by hour — page views (இன்று மணி வாரியாக)</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
          {Array.from({ length: 24 }, (_, h) => {
            const v = hoursMap.get(h) ?? 0;
            return (
              <div key={h} title={`${h}:00 — ${v}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ fontSize: 10, color: '#64748b' }}>{v || ''}</div>
                <div style={{ width: '100%', height: `${(v / maxHour) * 80}%`, minHeight: v ? 3 : 0, background: '#0ea5a5', borderRadius: 3 }} />
                <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>{h}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
