// Daily e-mails to registered students (Oct 2026). Three regular messages,
// all in one fixed PONNA format (logo on top, "வெற்றியின் முதல் படி" tagline
// at the bottom, one-click unsubscribe):
//   MORNING        06:30 IST  "தேர்வுக்கு இன்னும் N நாள்" + today's goal
//   CURRENT_AFFAIRS 17:00 IST  (as soon as today's items exist) headlines + link
//   QUIZ           19:00 IST  (as soon as today's Daily Quiz / Brain Challenge is live)
// Sent through Brevo's HTTP API (BREVO_API_KEY + MAIL_FROM on Render), the
// same way customer-notify.service.ts does. Nothing here may ever throw into
// a request; a DailyEmailLog row (unique per kind per IST day) guarantees one
// send per day even if the job fires twice.

import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

export type DailyEmailKind = 'MORNING' | 'CURRENT_AFFAIRS' | 'QUIZ';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const FRONT = (process.env.FRONTEND_URL?.trim() || 'https://www.ponna.in').replace(/\/$/, '');
const API = (process.env.API_PUBLIC_URL?.trim() || 'https://ponna.onrender.com').replace(/\/$/, '');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
// TNPSC Group 4 exam day (admin can override with EXAM_DATE=YYYY-MM-DD on Render).
const EXAM_DATE = process.env.EXAM_DATE?.trim() || '2027-01-10';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function istDayString(now = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function unsubscribeToken(userId: string): string {
  return crypto.createHmac('sha256', SECRET).update(`unsub:${userId}`).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = unsubscribeToken(userId);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function daysToExam(now = Date.now()): number {
  const [ey, em, ed] = EXAM_DATE.split('-').map(Number);
  const [ty, tm, td] = istDayString(now).split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

type Built = { subject: string; headline: string; bodyHtml: string; button: { label: string; url: string } };

function layout(b: Built, name: string, userId: string): string {
  const unsub = `${API}/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
  return `<div style="background:#f3f1ea;padding:16px 8px;font-family:Arial,'Noto Sans Tamil',sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #ddd">
<div style="background:#0B3864;border-bottom:3px solid #E2B04A;padding:12px 14px"><span style="display:inline-block;background:#fff;border-radius:8px;padding:4px 9px"><img src="${FRONT}/logo-wordmark.png" alt="PONNA.in" height="26" style="display:block;height:26px"></span><span style="color:#fff;font-size:13px;margin-left:10px">${esc(b.headline)}</span></div>
<div style="padding:16px 16px 6px;font-size:15px;line-height:1.7;color:#0f172a">
<p style="margin:0 0 8px">வணக்கம் ${esc(name || 'மாணவரே')},</p>${b.bodyHtml}
<a href="${b.button.url}" style="display:block;background:#FFD22A;color:#0B3864;text-align:center;font-weight:800;padding:12px;border-radius:8px;text-decoration:none;margin:16px 0">${esc(b.button.label)}</a></div>
<div style="text-align:center;color:#0B3864;font-weight:800;border-top:1px solid #eee;padding:11px;font-family:Georgia,serif">வெற்றியின் முதல் படி — PONNA.in</div>
<div style="font-size:11px;color:#888;padding:0 16px 14px;text-align:center">இந்த மின்னஞ்சல் வேண்டாமெனில் <a href="${unsub}" style="color:#888">இங்கே சொடுக்கவும்</a> • ARLENA (OPC) PRIVATE LIMITED</div>
</div></div>`;
}

async function build(kind: DailyEmailKind): Promise<Built | null> {
  const today = istDayString();
  if (kind === 'MORNING') {
    const days = daysToExam();
    if (days < 0) return null;
    const when = days === 0 ? 'இன்று தேர்வு நாள்!' : `தேர்வுக்கு இன்னும் ${days} நாள்`;
    return {
      subject: `${when} — இன்றைய இலக்கு தயார் 💪`,
      headline: 'காலை வணக்கம்',
      bodyHtml: `<div style="text-align:center;font-size:34px;font-weight:900;color:#D02B2B;margin:6px 0">${days === 0 ? 'இன்று' : `${days} நாள்`}</div>
<p style="text-align:center;margin:0 0 10px">TNPSC Group 4 தேர்வு (ஜன. 10) வரை</p>
<div style="background:#FFF6DC;border-left:4px solid #E2B04A;padding:9px 12px;font-weight:700;color:#5a3b00">உங்களால் முடியும்! ஒவ்வொரு நாளும் ஒரு படி முன்னேறுங்கள்.</div>
<p>இன்றைய இலக்கு: 20 கேள்விகள் + ஒரு நடப்பு நிகழ்வுக் குறிப்பு.</p>`,
      button: { label: 'இன்றைய பயிற்சியைத் தொடங்கு →', url: `${FRONT}/quiz` },
    };
  }
  if (kind === 'CURRENT_AFFAIRS') {
    const [y, m, d] = today.split('-').map(Number);
    const items = await prisma.currentAffairsItem.findMany({ where: { date: new Date(Date.UTC(y, m - 1, d)) }, orderBy: { createdAt: 'asc' }, take: 5, select: { headline: true } });
    if (items.length === 0) return null;
    const lis = items.slice(0, 3).map((i) => `<li style="margin-bottom:5px">${esc(i.headline.replace(/^\[[^\]]+\]\s*/, ''))}</li>`).join('');
    return {
      subject: `📰 இன்றைய நடப்பு நிகழ்வுகள் தயார் — ${items.length} முக்கிய செய்திகள்`,
      headline: 'நடப்பு நிகழ்வுகள்',
      bodyHtml: `<p style="margin:0 0 4px">இன்றைய தேர்வுக்கு முக்கியமான செய்திகள்:</p><ul style="padding-left:20px;margin:6px 0">${lis}</ul><p style="color:#666">படித்த பின் இன்றைய Daily Quiz-ஐயும் முயலுங்கள்.</p>`,
      button: { label: 'முழுவதும் படிக்க →', url: `${FRONT}/current-affairs` },
    };
  }
  // QUIZ — live right now for today's IST date
  const now = new Date();
  const [y, m, d] = today.split('-').map(Number);
  const quizzes = await prisma.dailyQuiz.findMany({ where: { quizDate: new Date(Date.UTC(y, m - 1, d)), publishAt: { lte: now }, expiresAt: { gt: now } }, select: { quizType: true } });
  if (quizzes.length === 0) return null;
  const hasBrain = quizzes.some((q) => q.quizType === 'BRAIN_CHALLENGE');
  const hasDaily = quizzes.some((q) => q.quizType === 'DAILY_QUIZ');
  const what = hasBrain && hasDaily ? 'Daily Quiz மற்றும் Brain Challenge' : hasBrain ? 'Brain Challenge' : 'Daily Quiz';
  return {
    subject: `🧠 இன்றைய ${what} தயார் — 5 நிமிடம் போதும்`,
    headline: 'Daily Quiz',
    bodyHtml: `<p>இன்றைய ${esc(what)} தொடங்கிவிட்டது. தினமும் தொடர்ந்தால் தேர்வில் வித்தியாசம் தெரியும்.</p>`,
    button: { label: 'இப்போது முயல்க →', url: `${FRONT}/daily-quiz` },
  };
}

async function brevoSend(to: string, toName: string | null, subject: string, html: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM?.trim();
  if (!key || !from) {
    console.log(`Daily email skipped: ${!key ? 'BREVO_API_KEY not set' : 'MAIL_FROM not set'}`);
    return false;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'PONNA.in', email: from }, to: [{ email: to, name: toName ?? undefined }], subject, htmlContent: html }),
  });
  if (!res.ok) console.error('Brevo daily email failed:', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export class DailyEmailService {
  /** Sends `kind` to every opted-in student, once per IST day. Returns what happened. */
  async sendDaily(kind: DailyEmailKind): Promise<{ status: 'sent' | 'already-sent' | 'nothing-to-send'; sent: number; failed: number }> {
    const day = istDayString();
    const built = await build(kind);
    if (!built) return { status: 'nothing-to-send', sent: 0, failed: 0 };
    // Claim the (kind, day) slot first; a second concurrent run loses the race.
    try {
      await prisma.dailyEmailLog.create({ data: { kind, day } });
    } catch {
      return { status: 'already-sent', sent: 0, failed: 0 };
    }
    const users = await prisma.user.findMany({
      where: { email: { not: null }, isTestAccount: false, emailOptOut: false },
      select: { id: true, email: true, name: true },
    });
    let sent = 0;
    let failed = 0;
    for (const u of users) {
      try {
        const ok = await brevoSend(u.email!, u.name, built.subject, layout(built, u.name ?? '', u.id));
        if (ok) sent++; else failed++;
      } catch (err) {
        failed++;
        console.error('Daily email error:', err);
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    await prisma.dailyEmailLog.update({ where: { kind_day: { kind, day } }, data: { sentCount: sent } }).catch(() => {});
    console.log(`[daily-email] ${kind} ${day}: sent ${sent}, failed ${failed}`);
    return { status: 'sent', sent, failed };
  }

  /** Admin test: renders the real email and sends it to ONE address, never logs a day. */
  async sendTest(kind: DailyEmailKind, to: string): Promise<{ ok: boolean; note?: string }> {
    const built = await build(kind);
    if (!built) return { ok: false, note: 'இன்று இந்த மின்னஞ்சலுக்கான உள்ளடக்கம் இன்னும் இல்லை (நடப்பு நிகழ்வுகள் / Daily Quiz பதிவேற்றப்படவில்லை).' };
    const user = await prisma.user.findFirst({ where: { email: { equals: to, mode: 'insensitive' } }, select: { id: true, name: true } });
    const ok = await brevoSend(to, user?.name ?? null, `[சோதனை] ${built.subject}`, layout(built, user?.name ?? '', user?.id ?? 'test'));
    return { ok, note: ok ? undefined : 'அனுப்ப முடியவில்லை — Render-ல் BREVO_API_KEY / MAIL_FROM சரிபார்க்கவும் (log பார்க்கவும்).' };
  }
}

export const dailyEmailService = new DailyEmailService();
