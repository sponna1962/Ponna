// WhatsApp inbox (Oct 2026). Stores every message sent to / from the PONNA
// business number and answers with FIXED text only -- no AI (only the daily
// current-affairs news, Daily Quiz and Brain Challenge may use AI on their own).
// A person who messages us first is treated as opted in; "STOP" opts them out
// and nothing marketing-like is ever sent to an opted-out number.

import { prisma } from '../../lib/prisma';
import { sendWhatsAppText } from './whatsapp-adapter';

const SITE = 'https://ponna.in';
const SIX_HOURS = 6 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const MENU =
  'வணக்கம்! PONNA.in-க்கு வரவேற்கிறோம். TNPSC குரூப் 4 தேர்வுக்கான பயிற்சித் தளம்.\n\n' +
  'உங்களுக்கு என்ன வேண்டும்? எண்ணை மட்டும் அனுப்புங்கள்:\n' +
  '1 - இலவசப் பயிற்சி\n2 - இன்றைய Daily Quiz\n3 - PONNA Pass விவரம்\n4 - உதவி\n5 - எங்களைத் தொடர்பு கொள்ளுங்கள் (நாங்கள் உங்களுக்கு போன் செய்கிறோம்)\n\n' +
  'செய்திகளை நிறுத்த STOP என அனுப்புங்கள்.';

// Ready-typed first message of the website's WhatsApp button (frontend
// WhatsAppButton.tsx). A person who taps the button always gets the menu,
// even if they already received it earlier today.
const OLD_BUTTON_TEXT = 'வணக்கம், PONNA.in பற்றி ஒரு சந்தேகம்'; // first version of the button
const BUTTON_TEXT = 'வணக்கம், பொன்னா.இன் பற்றி எனக்கு முழுமையாகச் சொல்லவும்';

// First message of the /teachers page's WhatsApp button.
const TEACHER_TEXT = 'வணக்கம், நான் TNPSC ஆசிரியர். PONNA.in-உடன் இணைய விரும்புகிறேன்';
const TEACHER_REPLY =
  'வணக்கம்! PONNA.in-உடன் இணைய விரும்பியதற்கு நன்றி. உங்கள் பெயர், பயிற்சி மையம் அல்லது சேனல் பெயர், போன் எண் ஆகியவற்றை இங்கே எழுதி அனுப்புங்கள். நாங்கள் உங்களைத் தொடர்பு கொள்கிறோம்.';

const REPLIES: Record<string, string> = {
  '1': `இலவசப் பயிற்சியைத் தொடங்க:\n${SITE}/free-practice?utm_source=wa`,
  '2': `இன்றைய Daily Quiz:\n${SITE}/daily-quiz?utm_source=wa`,
  '3': `PONNA Pass விவரங்கள் மற்றும் விலை:\n${SITE}/plans?utm_source=wa`,
  '5': 'நன்றி! உங்கள் பெயரையும், போன் செய்ய வசதியான நேரத்தையும் இங்கே எழுதி அனுப்புங்கள். நாங்கள் இந்த எண்ணில் உங்களைத் தொடர்பு கொள்கிறோம்.',
  '4': `உதவிக்கு:\n${SITE}/help?utm_source=wa\n\nஉங்கள் கேள்வியை இங்கேயே எழுதுங்கள், விரைவில் பதிலளிக்கிறோம்.`,
};
const STOP_REPLY = 'சரி, இனி செய்திகள் அனுப்பமாட்டோம். மீண்டும் பெற விரும்பினால் START என அனுப்புங்கள்.';
const START_REPLY = 'நன்றி! செய்திகளைத் தொடர்ந்து அனுப்புவோம்.';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.!\s]+$/g, '');
}

async function record(phone: string, direction: 'IN' | 'OUT', kind: string, body: string | null, waMessageId?: string): Promise<boolean> {
  try {
    await prisma.whatsAppMessage.create({ data: { phone, direction, kind, body, waMessageId: waMessageId ?? null } });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false; // Meta retried a message we already stored
    throw err;
  }
}

async function reply(phone: string, text: string, kind: 'auto' | 'manual'): Promise<void> {
  const id = await sendWhatsAppText(phone, text);
  await record(phone, 'OUT', kind, text, id);
}

/** Handles one `value` object of Meta's webhook payload. Never throws. */
export async function handleWhatsAppWebhookValue(value: any): Promise<void> {
  try {
    // Ignore events for any other number on the same app (e.g. Meta's test number).
    const ownId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (ownId && value?.metadata?.phone_number_id && value.metadata.phone_number_id !== ownId) return;

    const names: Record<string, string> = {};
    for (const c of value?.contacts ?? []) if (c?.wa_id) names[c.wa_id] = c?.profile?.name ?? '';

    for (const msg of value?.messages ?? []) {
      const phone = String(msg.from ?? '');
      if (!phone) continue;
      const kind = String(msg.type ?? 'unknown');
      const text: string | null =
        kind === 'text' ? String(msg.text?.body ?? '') :
        kind === 'button' ? String(msg.button?.text ?? '') :
        kind === 'interactive' ? String(msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? '') : null;

      const isNew = await record(phone, 'IN', kind, text ? text.slice(0, 2000) : null, msg.id);
      if (!isNew) continue;

      const now = new Date();
      const existing = await prisma.whatsAppContact.findUnique({ where: { phone } });
      const contact = existing
        ? await prisma.whatsAppContact.update({ where: { phone }, data: { lastInboundAt: now, name: names[phone] || existing.name } })
        : await prisma.whatsAppContact.create({ data: { phone, name: names[phone] || null, lastInboundAt: now } });

      try {
        const word = text ? normalize(text) : '';
        if (['stop', 'unsubscribe', 'நிறுத்து', 'நிறுத்தவும்'].includes(word)) {
          await prisma.whatsAppContact.update({ where: { phone }, data: { optedIn: false, optedOutAt: now } });
          const last10 = phone.slice(-10);
          await prisma.user.updateMany({ where: { OR: [{ phone: { in: [`+${phone}`, phone] } }, { whatsappNumber: { contains: last10 } }] }, data: { whatsappOptIn: false } });
          await reply(phone, STOP_REPLY, 'auto');
        } else if (['start', 'subscribe', 'தொடங்கு'].includes(word)) {
          await prisma.whatsAppContact.update({ where: { phone }, data: { optedIn: true, optedOutAt: null } });
          await reply(phone, START_REPLY, 'auto');
        } else if (Object.prototype.hasOwnProperty.call(REPLIES, word)) {
          await reply(phone, REPLIES[word], 'auto');
          await prisma.whatsAppContact.update({ where: { phone }, data: { lastAutoReplyAt: now } });
        } else if (text && text.trim() === TEACHER_TEXT) {
          await reply(phone, TEACHER_REPLY, 'auto');
          await prisma.whatsAppContact.update({ where: { phone }, data: { lastAutoReplyAt: now } });
        } else if (text && (text.trim() === BUTTON_TEXT || text.trim() === OLD_BUTTON_TEXT)) {
          await reply(phone, MENU, 'auto');
          await prisma.whatsAppContact.update({ where: { phone }, data: { welcomedAt: contact.welcomedAt ?? now, lastAutoReplyAt: now } });
        } else if (!contact.welcomedAt) {
          await reply(phone, MENU, 'auto');
          await prisma.whatsAppContact.update({ where: { phone }, data: { welcomedAt: now, lastAutoReplyAt: now } });
        } else if (!contact.lastAutoReplyAt || now.getTime() - contact.lastAutoReplyAt.getTime() > SIX_HOURS) {
          // Free text we cannot understand: show the menu again, but at most once per 6 hours.
          await reply(phone, MENU, 'auto');
          await prisma.whatsAppContact.update({ where: { phone }, data: { lastAutoReplyAt: now } });
        }
      } catch (err) {
        console.error('[whatsapp-inbox] Auto-reply failed:', err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('[whatsapp-inbox] Processing failed:', err instanceof Error ? err.message : err);
  }
}

export async function listConversations() {
  const contacts = await prisma.whatsAppContact.findMany({ orderBy: { lastInboundAt: 'desc' }, take: 200 });
  const lasts = await prisma.whatsAppMessage.findMany({
    where: { phone: { in: contacts.map((c) => c.phone) } },
    orderBy: { createdAt: 'desc' },
    distinct: ['phone'],
  });
  const byPhone = new Map(lasts.map((m) => [m.phone, m]));
  return contacts.map((c) => ({
    phone: c.phone,
    name: c.name,
    optedIn: c.optedIn,
    lastInboundAt: c.lastInboundAt,
    canReply: !!c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < DAY,
    lastMessage: byPhone.get(c.phone)?.body ?? null,
    lastDirection: byPhone.get(c.phone)?.direction ?? null,
  }));
}

export async function listMessages(phone: string) {
  return prisma.whatsAppMessage.findMany({ where: { phone }, orderBy: { createdAt: 'asc' }, take: 300 });
}

/** Manual reply typed in Admin. Free-form text is only allowed within 24 h of their last message. */
export async function sendManualReply(phone: string, text: string): Promise<void> {
  const contact = await prisma.whatsAppContact.findUnique({ where: { phone } });
  if (!contact?.lastInboundAt || Date.now() - contact.lastInboundAt.getTime() >= DAY) {
    throw new Error('24 மணி நேரத்துக்குள் அவர் செய்தி அனுப்பியிருந்தால் மட்டுமே பதிலளிக்கலாம்.');
  }
  await reply(phone, text.slice(0, 1500), 'manual');
}

/** Records a template message sent from Admin, so it shows up in the Inbox thread. */
export async function recordOutbound(phone: string, kind: string, body: string, waMessageId?: string): Promise<void> {
  await record(phone, 'OUT', kind, body, waMessageId);
}

export async function isOptedOut(phone: string): Promise<boolean> {
  const c = await prisma.whatsAppContact.findUnique({ where: { phone } });
  return !!c && !c.optedIn;
}
