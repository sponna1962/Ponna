// Push Notifications (Sept 2026, Priority 1 — Accessibility & Reach).
// Uses the Web Push standard through the PWA already set up in this app
// (manifest.json + next-pwa service worker + a small custom worker file,
// frontend/worker/index.js, that next-pwa merges in for the push/
// notificationclick event listeners — see that file's own comments).
//
// Scope deliberately kept to the three USEFUL, non-spam categories
// agreed for this release: Daily Challenge ready, practice/streak
// reminders, and admin-triggered important exam updates. No engagement-
// bait notifications, no marketing spam.
//
// Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in the
// environment (self-generated key pair, no external account needed —
// unlike Razorpay/Gemini). Every method here silently no-ops (never
// throws) if they're not set, so this is always safe to have wired in
// even before those env vars exist on Render.

import webpush from 'web-push';
import { prisma } from '../../lib/prisma';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:ponna@arlena.in';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string; // opened on notification click — see worker/index.js
}

export class PushNotificationService {
  isConfigured(): boolean {
    return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  }

  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async isSubscribed(userId: string): Promise<boolean> {
    const count = await prisma.pushSubscription.count({ where: { userId } });
    return count > 0;
  }

  private async sendToSubscription(sub: { id: string; endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (err: any) {
      // 404/410 = the browser's push service says this subscription is
      // gone (uninstalled, permission revoked, browser data cleared) —
      // clean it up rather than retrying it forever.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error('Push notification send failed:', err?.message ?? err);
      }
    }
  }

  /** Sends to every device this ONE student has subscribed. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.isConfigured()) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.all(subs.map((s) => this.sendToSubscription(s, payload)));
  }

  /** Admin-triggered only (important exam updates) — every subscribed
   * device, across every student. Deliberately no automatic trigger for
   * this category (e.g. auto-detecting a new exam date) — keeping this
   * release simple, per the agreed scope; an admin decides when
   * something is actually announcement-worthy. */
  async broadcastToAll(payload: PushPayload): Promise<{ sent: number }> {
    if (!this.isConfigured()) return { sent: 0 };
    const subs = await prisma.pushSubscription.findMany();
    await Promise.all(subs.map((s) => this.sendToSubscription(s, payload)));
    return { sent: subs.length };
  }

  /** Every device with a currently PUBLISHED Daily Quiz available today —
   * called from the same cron that flips a Daily Quiz SCHEDULED->
   * PUBLISHED (scheduled-jobs.ts), only when that just happened. */
  async notifyDailyChallengeReady(): Promise<{ sent: number }> {
    return this.broadcastToAll({
      title: 'இன்றைய Daily Challenge தயார்! 🎯',
      body: 'உங்க streak-ஐ தொடருங்க — இப்போ முயற்சி செய்யுங்க.',
      url: '/daily-quiz',
    });
  }

  /** Practice/streak reminder — own opt-in list (subscribed students
   * only), own simple "at risk" rule: has a live streak, hasn't
   * practiced yet today. Deliberately a separate, simpler query from the
   * WhatsApp reminder sweep's (different channel, different audience —
   * no need to share logic). */
  async sendPracticeReminders(): Promise<{ sent: number }> {
    if (!this.isConfigured()) return { sent: 0 };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const subscribedUserIds = await prisma.pushSubscription.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });

    let sent = 0;
    for (const { userId } of subscribedUserIds) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true, lastStreakDate: true } });
      if (!user || user.currentStreak <= 0) continue; // no active streak to protect
      if (user.lastStreakDate && user.lastStreakDate >= startOfToday) continue; // already practiced today

      await this.sendToUser(userId, {
        title: 'உங்க streak break ஆகும் முன்!',
        body: `${user.currentStreak}-நாள் streak-ஐ காப்பாத்த இன்று practice பண்ணுங்க.`,
        url: '/quiz',
      });
      sent++;
    }
    return { sent };
  }
}

export const pushNotificationService = new PushNotificationService();
