// Instant alerts to the business owner (Oct 2026) — used by the manual UPI
// payment flow so a student's payment or problem is never sitting unseen.
// Two independent channels; each silently does nothing unless configured, and
// NOTHING here may ever throw or slow down the student's request:
//
//  1. Telegram (recommended — rings the owner's phone even with the browser
//     closed): TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
//  2. Web push to the owner's own PONNA account(s) via the existing push
//     service: ADMIN_ALERT_EMAILS (comma-separated registered emails). The
//     owner just has to have enabled notifications in the app once.

import { prisma } from '../../lib/prisma';
import { pushNotificationService } from '../notifications/push-notification.service';

export class AdminAlertService {
  /** Fire-and-forget. Always resolves; failures are logged only. */
  notify(title: string, body: string, url = '/admin/manual-payments'): void {
    this.send(title, body, url).catch((err) => console.error('Admin alert failed:', err?.message ?? err));
  }

  private async send(title: string, body: string, url: string) {
    await Promise.allSettled([this.telegram(title, body), this.push(title, body, url)]);
  }

  private async telegram(title: string, body: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `${title}\n${body}` }),
    });
    if (!res.ok) console.error('Telegram alert failed:', res.status);
  }

  private async push(title: string, body: string, url: string) {
    const emails = (process.env.ADMIN_ALERT_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0 || !pushNotificationService.isConfigured()) return;
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    await Promise.all(users.map((u) => pushNotificationService.sendToUser(u.id, { title, body, url })));
  }
}

export const adminAlertService = new AdminAlertService();
