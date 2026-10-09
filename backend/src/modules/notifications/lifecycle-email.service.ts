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
//   BOUGHT_TRIAL  a ₹10 PayU payment succeeded in the last 48 h → how to start
//   BOUGHT_PASS   a ₹499 PayU payment succeeded in the last 48 h → what is unlocked
//   WINBACK       registered > 7 days ago, no practice for 7 days (at most once per 14 days)
// Plus dated exam-milestone mails (EVENTS below, 12:00 IST) and a Sunday
// personal summary (the student's OWN numbers only — never a comparison).
//
// Only statements that are true today are used (₹10 = 3 days, 75 questions a
// day, Cut-off Predictor; ₹499 Pass to 12 Jan 2027 adds Live Exam, Adaptive
// Mock and the Ask PONNA chat). No fake urgency.

import { prisma } from '../../lib/prisma';
import { brevoSend, layout, FRONT, daysToExam, istDayString, type Built } from './daily-email.service';

type Kind = 'NO_PRACTICE' | 'TRIAL_OFFER' | 'PAY_ABANDONED' | 'TRIAL_ENDING' | 'TRIAL_ENDED' | 'BOUGHT_TRIAL' | 'BOUGHT_PASS' | 'WINBACK';
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
    case 'BOUGHT_TRIAL':
      return {
        subject: 'உங்கள் ₹10 சோதனை தொடங்கிவிட்டது ✅',
        headline: 'வரவேற்பு',
        bodyHtml: `<p>பணம் பெறப்பட்டது — நன்றி! அடுத்த 3 நாட்களுக்கு தினமும் 75 கேள்விகள் வரை பயிற்சி, தவறுகள் மறுஆய்வு, Cut-off Predictor, Daily Quiz எல்லாம் திறந்துள்ளன.</p><p>முதலில்: <b>Profile-ஐ நிரப்பி</b> பயிற்சியைத் தொடங்குங்கள்.</p>`,
        button: { label: 'பயிற்சியைத் தொடங்குங்கள் →', url: `${FRONT}/quiz` },
      };
    case 'BOUGHT_PASS':
      return {
        subject: 'உங்கள் ₹499 Pass செயல்பட்டது 🎉',
        headline: 'Pass செயல்பட்டது',
        bodyHtml: `<p>நன்றி! தேர்வு வரை (ஜன. 12, 2027) எல்லா வசதிகளும் உங்களுக்கே:</p><ul style="padding-left:20px;margin:6px 0"><li>தினமும் 75 கேள்விகள் வரை பயிற்சி, தவறுகள் மறுஆய்வு</li><li>Live Exam (முழு மாதிரித் தேர்வு), Adaptive Mock</li><li>Ask PONNA — தேர்வு பற்றிய உங்கள் சந்தேகங்களுக்குப் பதில்</li><li>Cut-off Predictor, Daily Quiz, Brain Challenge</li></ul><p>தேர்வுக்கு இன்னும் <b>${days} நாள்</b>.</p>`,
        button: { label: 'பயிற்சியைத் தொடங்குங்கள் →', url: `${FRONT}/quiz` },
      };
    case 'WINBACK':
      return {
        subject: 'உங்களை எதிர்பார்க்கிறோம் — இன்று 5 கேள்விகள் போதும்',
        headline: 'மீண்டும் தொடங்குவோம்',
        bodyHtml: `<p>ஒரு வாரமாக பயிற்சி இல்லை. பரவாயில்லை — இன்றே தொடங்கலாம். 5 நிமிடம், 5 கேள்விகள், ஒவ்வொன்றுக்கும் "ஏன் இது சரி?" விளக்கம்.</p><p>தேர்வுக்கு இன்னும் <b>${days} நாள்</b>.</p>`,
        button: { label: 'இன்று தொடங்கு →', url: `${FRONT}/quiz` },
      };
  }
}

// Dated exam-milestone mails, sent once to every opted-in student at 12:00 IST
// on `date` (dates from TNPSC notification 11/2026; the guide page has details).
const EVENTS: { id: string; date: string; subject: string; headline: string; body: string; label: string; url: string }[] = [
  { id: 'APPLY_7D', date: '2026-10-29', subject: 'Group 4 விண்ணப்பிக்க இன்னும் 7 நாள் மட்டுமே', headline: 'விண்ணப்பம்', body: '<p>விண்ணப்பிக்கக் கடைசி நாள் <b>05.11.2026, இரவு 11.59</b>. இன்னும் விண்ணப்பிக்கவில்லை என்றால் இன்றே தொடங்குங்கள்; கடைசி நாளுக்காகக் காத்திருக்க வேண்டாம்.</p>', label: 'விண்ணப்பிப்பது எப்படி? →', url: `${FRONT}/tnpsc-group-4/notification-2026#howto` },
  { id: 'APPLY_2D', date: '2026-11-03', subject: 'விண்ணப்பக் கடைசி நாளுக்கு இன்னும் 2 நாள்', headline: 'விண்ணப்பம்', body: '<p>கடைசி நாள் <b>05.11.2026, இரவு 11.59</b>. புகைப்படம், கையொப்பம், கட்டணம் (₹100) தயாராக வைத்துக்கொள்ளுங்கள்.</p>', label: 'படிப்படியான வழிகாட்டி →', url: `${FRONT}/tnpsc-group-4/notification-2026#howto` },
  { id: 'APPLY_LAST', date: '2026-11-05', subject: 'இன்றுதான் விண்ணப்பிக்கக் கடைசி நாள்', headline: 'கடைசி நாள்', body: '<p>இன்று இரவு <b>11.59</b> வரை மட்டுமே விண்ணப்பிக்கலாம். இறுதி நேரத்தில் இணையதளம் மெதுவாகலாம் — இப்போதே முடித்துவிடுங்கள்.</p>', label: 'விண்ணப்பிப்பது எப்படி? →', url: `${FRONT}/tnpsc-group-4/notification-2026#howto` },
  { id: 'CORRECT_OPEN', date: '2026-11-08', subject: 'விண்ணப்பத் திருத்தம்: நாளை முதல் 3 நாள்', headline: 'திருத்தச் சாளரம்', body: '<p>விண்ணப்பத்தில் திருத்தம் செய்ய <b>09.11.2026 12.01 AM முதல் 11.11.2026 11.59 PM</b> வரை வாய்ப்பு. திருத்தம் SUBMIT செய்த பின்னரே செல்லுபடியாகும்.</p>', label: 'விவரம் படிக்க →', url: `${FRONT}/tnpsc-group-4/notification-2026#howto` },
  { id: 'CORRECT_LAST', date: '2026-11-11', subject: 'திருத்தச் சாளரம் இன்று இரவு 11.59-க்கு முடிகிறது', headline: 'திருத்தம்', body: '<p>விண்ணப்பத்தில் தவறு இருந்தால் இன்று இரவு 11.59 வரை மட்டுமே திருத்தலாம்.</p>', label: 'விவரம் படிக்க →', url: `${FRONT}/tnpsc-group-4/notification-2026#howto` },
  { id: 'EXAM_30D', date: '2026-12-11', subject: 'Group 4 தேர்வுக்கு இன்னும் 30 நாள்', headline: '30 நாள்', body: '<p>தேர்வு <b>10.01.2027</b>. இனி ஒவ்வொரு நாளும் மதிப்புள்ளது — பழைய தவறுகளை மறுபார்வை செய்து, தினமும் பயிற்சி தொடருங்கள்.</p>', label: 'இன்றைய பயிற்சி →', url: `${FRONT}/quiz` },
  { id: 'EXAM_14D', date: '2026-12-27', subject: 'தேர்வுக்கு இன்னும் 14 நாள்', headline: '14 நாள்', body: '<p>இரண்டு வாரங்கள் மட்டுமே. புதிய பாடங்களை விட்டு, படித்தவற்றைத் திரும்பப் படிப்பதே இப்போது சிறந்தது.</p>', label: 'இன்றைய பயிற்சி →', url: `${FRONT}/quiz` },
  { id: 'EXAM_7D', date: '2027-01-03', subject: 'தேர்வுக்கு இன்னும் 7 நாள்', headline: '7 நாள்', body: '<p>Hall Ticket-ஐ www.tnpscexams.in-ல் பதிவிறக்க முடிகிறதா என்று பாருங்கள். தேர்வு மையம் எங்கே என்பதையும் முன்கூட்டியே தெரிந்துகொள்ளுங்கள்.</p>', label: 'தேர்வு வழிகாட்டி →', url: `${FRONT}/tnpsc-group-4/notification-2026` },
  { id: 'EXAM_1D', date: '2027-01-09', subject: 'நாளை Group 4 தேர்வு — வாழ்த்துகள்!', headline: 'நாளை தேர்வு', body: '<p>இன்று புதிதாக எதுவும் படிக்க வேண்டாம். Hall Ticket, அடையாள அட்டை, எழுதுபொருள் தயார்தானா என்று பாருங்கள்; நன்றாகத் தூங்குங்கள். தேர்வு காலை 9.30-க்கு. உங்களால் முடியும்!</p>', label: 'தேர்வு வழிகாட்டி →', url: `${FRONT}/tnpsc-group-4/notification-2026` },
];

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

    // Purchase confirmations (PayU sends the customer no mail of its own here).
    const bought = await prisma.payuPayment.findMany({
      where: { status: 'SUCCESS', updatedAt: { gte: new Date(now - 48 * H) }, user: SUBJECT_OK },
      select: { id: true, userId: true, plan: { select: { isTrial: true } } },
    });
    for (const p of bought) await go(p.plan.isTrial ? 'BOUGHT_TRIAL' : 'BOUGHT_PASS', p.userId, p.id);

    // Unfinished payments — the most valuable nudge.
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
    // Win-back: registered > 7 days ago, no practice for 7 days. Keyed by a 14-day bucket.
    const bucket = Math.floor(now / (14 * 24 * H));
    const older = await prisma.user.findMany({ where: { ...SUBJECT_OK, createdAt: { lte: new Date(now - 7 * 24 * H) } }, select: { id: true }, take: 2000 });
    for (const u of older) {
      if (mailed.has(u.id)) continue;
      const recent = await prisma.quizSession.count({ where: { userId: u.id, startedAt: { gte: new Date(now - 7 * 24 * H) } } });
      if (recent === 0) await go('WINBACK', u.id, `${u.id}:${bucket}`);
    }
    if (Object.keys(out).length) console.log('[lifecycle-email]', JSON.stringify(out));
    return out;
  }

  /** Dated exam-milestone mails: once, to every opted-in student, on `date`. */
  async runEvents(): Promise<number> {
    if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM?.trim()) return 0;
    const today = istDayString();
    const ev = EVENTS.find((e) => e.date === today);
    if (!ev) return 0;
    try { await prisma.dailyEmailLog.create({ data: { kind: `EV_${ev.id}`, day: today } }); } catch { return 0; }
    const built: Built = { subject: ev.subject, headline: ev.headline, bodyHtml: ev.body, button: { label: ev.label, url: ev.url } };
    const users = await prisma.user.findMany({ where: SUBJECT_OK, select: { id: true, email: true, name: true } });
    let sent = 0;
    for (const u of users) {
      const ok = await brevoSend(u.email!, u.name, built.subject, layout(built, u.name ?? '', u.id)).catch(() => false);
      if (ok) sent++;
      await new Promise((r) => setTimeout(r, 120));
    }
    await prisma.dailyEmailLog.update({ where: { kind_day: { kind: `EV_${ev.id}`, day: today } }, data: { sentCount: sent } }).catch(() => {});
    console.log(`[lifecycle-email] event ${ev.id}: sent ${sent}`);
    return sent;
  }

  /** Sunday personal summary — the student's OWN last-7-days numbers, never a comparison. */
  async runWeekly(): Promise<number> {
    if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM?.trim()) return 0;
    const today = istDayString();
    try { await prisma.dailyEmailLog.create({ data: { kind: 'WEEKLY', day: today } }); } catch { return 0; }
    const rows = await prisma.$queryRaw<{ userId: string; answered: bigint; correct: bigint }[]>`
      SELECT s."userId", COUNT(*) AS answered, SUM(CASE WHEN q."isCorrect" THEN 1 ELSE 0 END) AS correct
      FROM "QuizSessionQuestion" q JOIN "QuizSession" s ON s.id = q."sessionId"
      WHERE q."answeredAt" >= now() - interval '7 days'
      GROUP BY s."userId"`;
    let sent = 0;
    for (const r of rows) {
      const answered = Number(r.answered);
      const correct = Number(r.correct ?? 0);
      if (answered < 1) continue;
      const user = await prisma.user.findFirst({ where: { id: r.userId, ...SUBJECT_OK }, select: { id: true, email: true, name: true } });
      if (!user) continue;
      const b: Built = {
        subject: `இந்த வாரம் நீங்கள் ${answered} கேள்விகள் பயின்றீர்கள் 👏`,
        headline: 'உங்கள் வாரம்',
        bodyHtml: `<div style="text-align:center;font-size:30px;font-weight:900;color:#0B3864;margin:6px 0">${answered} கேள்விகள்</div><p style="text-align:center;margin:0 0 8px">சரியானவை: <b>${correct}</b></p><p>இது உங்கள் சொந்த முன்னேற்றம் மட்டும். அடுத்த வாரம் இன்னும் சிறிது கூட்டுங்கள். தேர்வுக்கு இன்னும் <b>${Math.max(daysToExam(), 0)} நாள்</b>.</p>`,
        button: { label: 'இந்த வாரம் தொடர →', url: `${FRONT}/quiz` },
      };
      const ok = await brevoSend(user.email!, user.name, b.subject, layout(b, user.name ?? '', user.id)).catch(() => false);
      if (ok) sent++;
      await new Promise((r2) => setTimeout(r2, 120));
    }
    await prisma.dailyEmailLog.update({ where: { kind_day: { kind: 'WEEKLY', day: today } }, data: { sentCount: sent } }).catch(() => {});
    console.log(`[lifecycle-email] weekly: sent ${sent}`);
    return sent;
  }
}

export const lifecycleEmailService = new LifecycleEmailService();
