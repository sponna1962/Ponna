// WhatsApp Daily Reminder (finalized requirement, ₹999 Annual Plan
// value-add, item 3b). Finds students inactive for the configured
// threshold and sends a templated WhatsApp reminder. Never touches
// quota/ranking/allocation -- purely a re-engagement nudge, same
// philosophy as the Ask Ponna Dashboard nudge (nudge.ts) but delivered
// outside the app since the whole point is reaching someone who isn't
// currently using it.

import { prisma } from '../../lib/prisma';
import { sendWhatsAppTemplate, WhatsAppSendError } from './whatsapp-adapter';

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function daysAgoIst(n: number): Date {
  const nowIst = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
  nowIst.setUTCDate(nowIst.getUTCDate() - n);
  return new Date(nowIst.getTime() - IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Runs once daily (scheduled-jobs.ts). Finds paid students whose
 * lastStreakDate is at least whatsappReminderInactivityDays old (or who
 * have never had any activity), have a verified phone, and sends each
 * one the configured template. Failures for one student never block the
 * rest -- logged and skipped individually.
 */
export async function runWhatsAppReminderSweep(): Promise<{ sent: number; failed: number; skippedNoPhone: number }> {
  const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
  if (!settings.whatsappReminderEnabled) return { sent: 0, failed: 0, skippedNoPhone: 0 };

  const threshold = daysAgoIst(settings.whatsappReminderInactivityDays);

  const candidates = await prisma.user.findMany({
    where: {
      isTestAccount: false,
      phone: { not: null },
      subscriptions: { some: { status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false } } },
      OR: [{ lastStreakDate: null }, { lastStreakDate: { lt: threshold } }],
    },
    select: { id: true, phone: true, name: true },
  });

  let sent = 0;
  let failed = 0;
  let skippedNoPhone = 0;

  for (const student of candidates) {
    if (!student.phone) {
      skippedNoPhone++;
      continue;
    }
    try {
      await sendWhatsAppTemplate(student.phone, settings.whatsappTemplateName, [student.name ?? 'மாணவரே']);
      sent++;
    } catch (err) {
      failed++;
      if (err instanceof WhatsAppSendError) {
        console.error(`[WhatsApp reminder] Failed for user ${student.id}: ${err.message}`);
      } else {
        console.error(`[WhatsApp reminder] Unexpected error for user ${student.id}:`, err);
      }
    }
  }

  return { sent, failed, skippedNoPhone };
}
