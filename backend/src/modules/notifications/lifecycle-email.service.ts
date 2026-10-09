// Lifecycle e-mails (Oct 2026) — the few messages that move a student one
// step toward practising and paying. Each is sent ONCE per student (or once
// per payment / subscription) — the DailyEmailLog (kind, day) unique key is
// the guard, with `day` holding the student / payment / subscription id.
// Never sent to opted-out students or test accounts, and a student gets at
// most one lifecycle mail per run. Nothing here throws into the scheduler.
//
//   NO_PRACTICE   signed up 1–3 days ago and never started practice
//   TRIAL_OFFER   signed up 2–14 days ago, has practised, never bought → ₹10 offer
//   PAY_ABANDONED started a PayU payment 45 min–24 h ago and never completed it
//   TRIAL_ENDING  the ₹10 trial ends within ~30 h → ₹499 Pass
//   TRIAL_ENDED   the ₹10 trial ended 2–48 h ago → ₹499 Pass
//
// Only statements that are true today are used (₹10 = 3 days, 75 questions a
// day, Cut-off Predictor; ₹499 Pass to 12 Jan 2027 adds Live Exam, Adaptive
// Mock and the Ask PONNA chat). No fake urgency.

import { prisma } from '../../lib/prisma';
import { brevoSend, layout, FRONT, daysToExam, type Built } from './daily-email.service';

type Kind = 'NO_PRACTICE' | 'TRIAL_OFFER' | 'PAY_ABANDONED' | 'TRIAL_ENDING' | 'TRIAL_ENDED';
const H = 3_600_000;

function build(kind: Kind): Built {
  const days = Math.max(daysToExam(), 0);
  switch (kind) {
    case 'NO_PRACTICE':
      return {
        subject: 'இன்றைய 5 இலவசக் கேள்விகள் உங்களுக்காகக் காத்திருக்கின்றன',
        headline: 'முதல் படி',
        bodyHtml: `<p>PONNA.in-ல் பதிவு செய்தீர்கள் — நன்றி! இன்னும் பயிற்சி தொடங்கவில்லை. தினமும் <b>5 கேள்விகள் இலவசம்</b>; ஒவ்வொன்றுக்கும் "ஏன் இது சரி?" விளக்கமும் உண்டு. 5 நிமிடம் போதும்.</p>`,
        button: { label: 'இன்றைய 5 கேள்விகளைத் தொடங்குங்கள் →', url: `${FRONT}/quiz` },
      };
    case 'TRIAL_OFFER':
      return {
        subject: `தேர்வுக்கு ${days} நாள் — ₹10-ல் 3 நாள் தினமும் 75 கேள்விகள்`,
        headline: 'மேலும் பயிற்சி',
        bodyHtml: `<p>தினமும் 5 கேள்விகள் போதவில்லை என்றால், <b>₹10 சோதனை</b> உங்களுக்கு:</p>
<ul style="padding-left:20px;margin:6px 0"><li>3 நாள், தினமும் 75 கேள்விகள் வரை பயிற்சி</li><li>தவறுகள் மறுஆய்வு</li><li>Cut-off Predictor</li></ul>
<p style="color:#666;margin-top:8px">தானாகப் பணம் எடுக்கப்படாது. 3 நாள் முடிந்தால் நின்றுவிடும்.</p>`,
        button: { label: '₹10 சோதனையைத் தொடங்குங்கள் →', url: `${FRONT}/trial` },
      };
    case 'PAY_ABANDONED':
      return {
        subject: 'உங்கள் பணம் செலுத்தும் செயல் முடிவடையவில்லை',
        headline: 'பணம் செலுத்துதல்',
        bodyHtml: `<p>நீங்கள் பணம் செலுத்தத் தொடங்கினீர்கள், ஆனால் அது முடிவடையவில்லை. மீண்டும் முயல கீழே உள்ள பொத்தானை அழுத்துங்கள்; ஏற்கனவே உள்நுழைந்திருந்தால் நேரடியாகப் பணம் செலுத்தும் பக்கம் திறக்கும்.</p>
<p style="color:#666">உங்கள் வங்கியில் பணம் எடுக்கப்பட்டிருந்தால், அது இங்கே பதிவாகியுள்ளதா என்று பார்க்க <a href="${FRONT}/contact" style="color:#0B3864">தொடர்புப் பக்கம்</a> மூலம் எங்களுக்குத் தெரிவியுங்கள்.</p>`,
        button: { label: 'மீண்டும் முயல்க →', url: `${FRONT}/trial` },
      };
    case 'TRIAL_ENDING':
      return {
        subject: 'உங்கள் ₹10 சோதனை நாளை முடிகிறது',
        headline: 'சோதனை முடிகிறது',
        bodyHtml: `<p>உங்கள் 3 நாள் சோதனை விரைவில் முடிகிறது. தேர்வு வரை (ஜன. 12, 2027) தொடர <b>₹499 Pass</b>: Live Exam, Adaptive Mock, Ask PONNA கேள்வி-பதில் உட்பட அனைத்தும்.</p><p>தேர்வுக்கு இன்னும் <b>${days} நாள்</b>.</p>`,
        button: { label: '₹499 Pass-ஐப் பார்க்க →', url: `${FRONT}/plans` },
      };
    case 'TRIAL_ENDED':
      return {
        subject: 'உங்கள் ₹10 சோதனை முடிந்தது — தேர்வு வரை தொடரலாம்',
        headline: 'தொடர்ந்து படியுங்கள்',
        bodyHtml: `<p>சோதனை முடிந்தாலும் தினமும் 5 கேள்விகள், Daily Quiz, Study Notes தொடர்ந்து இலவசம். தேர்வு வரை முழுப் பயிற்சிக்கு <b>₹499 Pass</b> (ஜன. 12, 2027 வரை).</p><p>தேர்வுக்கு இன்னும் <b>${days} நாள்</b>.</p>`,
        button: { label: '₹499 Pass-ஐப் பார்க்க →', url: `${FRONT}/plans` },
      };
  }
}

const SUBJECT_OK = { email: { not: null }, emailOptOut: false, isTestAccount: false } as const;

export class LifecycleEmailService {
  private async claim(kind: Kind, id: string): Promise<boolean> {
    try { await prisma.dailyEmailLog.create({ data: { kind: `LC_${kind}`, day: id, sentCount: 1 } }); return true; } catch { return false; }
  }

  private async send(kind: Kind, userId: string, refId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, emailOptOut: true, isTestAccount: true } });
    if (!user?.email || user.emailOptOut || user.isTestAccount) return false;
    if (!(await this.claim(kind, refId))) return false;
    const b = build(kind);
    const ok = await brevoSend(user.email, user.name, b.subject, layout(b, user.name ?? '', userId)).catch(() => false);
    if (!ok) await prisma.dailyEmailLog.delete({ where: { kind_day: { kind: `LC_${kind}`, day: refId } } }).catch(() => {});
    return ok;
  }

  private async hasActivePass(userId: string): Promise<boolean> {
    const n = await prisma.subscription.count({ where: { userId, status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false, isTrial: false } } });
    return n > 0;
  }

  async runAll(): Promise<Record<string, number>> {
    if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM?.trim()) return {};
    const now = Date.now();
    const out: Record<string, number> = {};
    const mailed = new Set<string>(); // one lifecycle mail per student per run
    const go = async (kind: Kind, userId: string, refId: string) => {
      if (mailed.has(userId)) return;
      if (await this.send(kind, userId, refId)) { mailed.add(userId); out[kind] = (out[kind] ?? 0) + 1; }
      await new Promise((r) => setTimeout(r, 120));
    };

    // Unfinished payments first — the most valuable one.
    const stuck = await prisma.payuPayment.findMany({
      where: { status: 'INITIATED', createdAt: { gte: new Date(now - 24 * H), lte: new Date(now - 45 * 60_000) }, user: SUBJECT_OK },
      select: { id: true, userId: true },
    });
    for (const p of stuck) {
      const paid = await prisma.payuPayment.count({ where: { userId: p.userId, status: 'SUCCESS', createdAt: { gte: new Date(now - 25 * H) } } });
      if (paid > 0 || (await this.hasActivePass(p.userId))) continue;
      await go('PAY_ABANDONED', p.userId, p.id);
    }

    const trialSubs = await prisma.subscription.findMany({
      where: { plan: { isTrial: true }, cycleEnd: { gte: new Date(now - 48 * H), lte: new Date(now + 30 * H) }, user: SUBJECT_OK },
      select: { id: true, userId: true, cycleEnd: true },
    });
    for (const s of trialSubs) {
      if (await this.hasActivePass(s.userId)) continue;
      const ended = s.cycleEnd.getTime() <= now - 2 * H;
      const ending = s.cycleEnd.getTime() > now;
      if (ending) await go('TRIAL_ENDING', s.userId, s.id);
      else if (ended) await go('TRIAL_ENDED', s.userId, s.id);
    }

    const fresh = await prisma.user.findMany({
      where: { ...SUBJECT_OK, createdAt: { gte: new Date(now - 14 * 24 * H), lte: new Date(now - 20 * H) } },
      select: { id: true, createdAt: true },
      take: 500,
    });
    for (const u of fresh) {
      const age = now - u.createdAt.getTime();
      const practised = (await prisma.quizSession.count({ where: { userId: u.id } })) > 0;
      if (!practised && age <= 72 * H) { await go('NO_PRACTICE', u.id, u.id); continue; }
      if (practised && age >= 48 * H) {
        const everPaid = (await prisma.subscription.count({ where: { userId: u.id, plan: { isFree: false } } })) > 0
          || (await prisma.payuPayment.count({ where: { userId: u.id, status: 'SUCCESS' } })) > 0;
        if (!everPaid) await go('TRIAL_OFFER', u.id, u.id);
      }
    }
    if (Object.keys(out).length) console.log('[lifecycle-email]', JSON.stringify(out));
    return out;
  }
}

export const lifecycleEmailService = new LifecycleEmailService();
