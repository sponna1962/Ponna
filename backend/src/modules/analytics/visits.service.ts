// Anonymous visitor counter (Oct 2026).
//
// Records one SiteVisit row per page view and answers the admin "Visitors"
// page. Nothing personal is stored — see the SiteVisit model comment.

import { prisma } from '../../lib/prisma';

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch/i;

// Simple in-memory per-IP limiter (this endpoint is public).
const hits = new Map<string, { n: number; t: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > 60_000) hits.delete(k);
    return true;
  }
  h.n += 1;
  return h.n <= 120;
}

function classifySource(referrer: string, utmSource: string, fbclid: boolean, isEntry: boolean): string {
  if (!isEntry) return 'internal';
  const utm = utmSource.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
  if (utm) return utm;
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); } catch { host = ''; }
  if (host === 'ponna.in' || host.endsWith('.ponna.in')) return 'internal';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)(facebook|fb)\.com$/.test(host) || host === 'fb.me' || fbclid) return 'facebook';
  if (/(^|\.)google\./.test(host)) return 'google';
  if (/whatsapp|wa\.me/.test(host)) return 'whatsapp';
  if (/(^|\.)(t\.me|telegram\.org)$/.test(host)) return 'telegram';
  if (/youtube\.com|youtu\.be/.test(host)) return 'youtube';
  if (/(^|\.)(twitter|x)\.com$|^t\.co$/.test(host)) return 'twitter';
  if (!host) return 'direct';
  return `other:${host.slice(0, 40)}`;
}

function deviceOf(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function cleanPath(p: unknown): string {
  let s = String(p ?? '/').split('#')[0].split('?')[0].trim() || '/';
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s.slice(0, 120);
}

export async function recordVisit(
  ip: string,
  userAgent: string,
  body: { visitorId?: unknown; path?: unknown; referrer?: unknown; utmSource?: unknown; fbclid?: unknown; isNew?: unknown; isEntry?: unknown },
): Promise<void> {
  if (!allowed(ip) || !userAgent || BOT_UA.test(userAgent)) return;
  const visitorId = String(body.visitorId ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  if (visitorId.length < 8) return;
  const path = cleanPath(body.path);
  if (path.startsWith('/admin') || path.startsWith('/api')) return;
  const isEntry = body.isEntry === true;
  await prisma.siteVisit.create({
    data: {
      visitorId,
      path,
      source: classifySource(String(body.referrer ?? ''), String(body.utmSource ?? ''), body.fbclid === true, isEntry),
      device: deviceOf(userAgent),
      isNewVisitor: body.isNew === true,
      isEntry,
    },
  });
}

const IST_DAY = `(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date)`;

type Win = { visitors: number; pageviews: number; newVisitors: number; returning: number };

export async function getVisitSummary(range: 'today' | '7' | '30') {
  // Start of "today" in IST, expressed as a UTC instant.
  const startToday: Date = (await prisma.$queryRawUnsafe<{ d: Date }[]>(
    `SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date::timestamp AT TIME ZONE 'Asia/Kolkata') AS d`,
  ))[0].d;
  const dayMs = 86_400_000;
  const startOf = (n: number) => new Date(startToday.getTime() - n * dayMs);
  const rangeStart = range === 'today' ? startToday : range === '7' ? startOf(6) : startOf(29);

  const win = async (from: Date, to: Date | null): Promise<Win> => {
    const r = await prisma.$queryRawUnsafe<{ visitors: number; pageviews: number; newv: number }[]>(
      `SELECT COUNT(DISTINCT "visitorId")::int AS visitors, COUNT(*)::int AS pageviews,
              COUNT(DISTINCT CASE WHEN "isNewVisitor" THEN "visitorId" END)::int AS newv
         FROM "SiteVisit" WHERE "createdAt" >= $1 ${to ? 'AND "createdAt" < $2' : ''}`,
      ...(to ? [from, to] : [from]),
    );
    const x = r[0] ?? { visitors: 0, pageviews: 0, newv: 0 };
    return { visitors: x.visitors, pageviews: x.pageviews, newVisitors: x.newv, returning: Math.max(0, x.visitors - x.newv) };
  };

  const [today, yesterday, last7, last30, live, totalRow, firstRow] = await Promise.all([
    win(startToday, null),
    win(startOf(1), startToday),
    win(startOf(6), null),
    win(startOf(29), null),
    prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(DISTINCT "visitorId")::int AS n FROM "SiteVisit" WHERE "createdAt" >= (now() AT TIME ZONE 'UTC') - interval '5 minutes'`),
    prisma.$queryRawUnsafe<{ visitors: number; pageviews: number }[]>(`SELECT COUNT(DISTINCT "visitorId")::int AS visitors, COUNT(*)::int AS pageviews FROM "SiteVisit"`),
    prisma.$queryRawUnsafe<{ d: Date | null }[]>(`SELECT MIN("createdAt") AS d FROM "SiteVisit"`),
  ]);

  const daily = await prisma.$queryRawUnsafe<{ day: string; visitors: number; pageviews: number; fb: number }[]>(
    `SELECT to_char(${IST_DAY}, 'YYYY-MM-DD') AS day,
            COUNT(DISTINCT "visitorId")::int AS visitors, COUNT(*)::int AS pageviews,
            COUNT(DISTINCT CASE WHEN "source" IN ('facebook','instagram') OR "source" LIKE 'fb%' OR "source" LIKE 'ig%' THEN "visitorId" END)::int AS fb
       FROM "SiteVisit" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`,
    startOf(13),
  );
  const signups = await prisma.$queryRawUnsafe<{ day: string; n: number }[]>(
    `SELECT to_char((("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
       FROM "User" WHERE "createdAt" >= $1 AND "isTestAccount" = false GROUP BY 1`,
    startOf(13),
  );
  const sMap = new Map(signups.map((s) => [s.day, s.n]));
  const dMap = new Map(daily.map((d) => [d.day, d]));
  const days: { day: string; visitors: number; pageviews: number; fromFacebook: number; signups: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const t = new Date(startOf(i).getTime() + 5.5 * 3_600_000); // IST wall-clock date
    const day = t.toISOString().slice(0, 10);
    const d = dMap.get(day);
    days.push({ day, visitors: d?.visitors ?? 0, pageviews: d?.pageviews ?? 0, fromFacebook: d?.fb ?? 0, signups: sMap.get(day) ?? 0 });
  }

  const [sources, pages, devices, hours, signupsRange] = await Promise.all([
    prisma.$queryRawUnsafe<{ source: string; visitors: number }[]>(
      `SELECT "source", COUNT(DISTINCT "visitorId")::int AS visitors FROM "SiteVisit"
        WHERE "createdAt" >= $1 AND "isEntry" = true GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, rangeStart),
    prisma.$queryRawUnsafe<{ path: string; pageviews: number; visitors: number }[]>(
      `SELECT "path", COUNT(*)::int AS pageviews, COUNT(DISTINCT "visitorId")::int AS visitors FROM "SiteVisit"
        WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 15`, rangeStart),
    prisma.$queryRawUnsafe<{ device: string; visitors: number }[]>(
      `SELECT "device", COUNT(DISTINCT "visitorId")::int AS visitors FROM "SiteVisit"
        WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 2 DESC`, rangeStart),
    prisma.$queryRawUnsafe<{ hour: number; pageviews: number }[]>(
      `SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'))::int AS hour, COUNT(*)::int AS pageviews
         FROM "SiteVisit" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`, startToday),
    prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM "User" WHERE "createdAt" >= $1 AND "isTestAccount" = false`, rangeStart),
  ]);

  const rangeVisitors = (await win(rangeStart, null)).visitors;
  return {
    range,
    liveNow: live[0]?.n ?? 0,
    today, yesterday, last7, last30,
    allTime: { visitors: totalRow[0]?.visitors ?? 0, pageviews: totalRow[0]?.pageviews ?? 0, since: firstRow[0]?.d ?? null },
    days,
    sources, pages, devices,
    hoursToday: hours,
    rangeSignups: signupsRange[0]?.n ?? 0,
    rangeVisitors,
  };
}
