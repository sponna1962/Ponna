// Customer-facing payment messages (Oct 2026) for the manual UPI flow.
// Channels: e-mail through Brevo's HTTP API (BREVO_API_KEY + MAIL_FROM) and
// web push to the customer's own account. Each silently does nothing unless
// configured, and NOTHING here may ever throw or slow down a request.
// WhatsApp can be added here once the business number is approved.

import { prisma } from '../../lib/prisma';
import { pushNotificationService } from '../notifications/push-notification.service';

type Kind = 'RECEIVED' | 'APPROVED' | 'REJECTED';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function content(kind: Kind, planName: string, amount: string, utr: string, note?: string | null) {
  if (kind === 'RECEIVED') {
    return {
      subject: 'PONNA.in: உங்கள் பணம் பெறப்பட்டது / Payment received',
      lines: [
        `உங்கள் ₹${amount} (${planName}) பணம் பற்றிய விவரம் கிடைத்தது. UTR: ${utr}.`,
        'நாங்கள் சரிபார்த்து விரைவில் உங்கள் பாஸை செயல்படுத்துவோம். செயல்பட்டதும் மீண்டும் தெரிவிப்போம்.',
        `We have received your payment details (₹${amount}, ${planName}, UTR ${utr}). We will verify it and activate your pass shortly; you will get another message when it is active.`,
      ],
      push: { title: 'PONNA.in: பணம் பெறப்பட்டது', body: 'சரிபார்த்து விரைவில் பாஸ் செயல்படும்.' },
    };
  }
  if (kind === 'APPROVED') {
    return {
      subject: 'PONNA.in: உங்கள் பாஸ் செயல்பட்டது! / Your pass is active',
      lines: [
        `வாழ்த்துகள்! உங்கள் ${planName} பாஸ் இப்போது செயல்படுகிறது. இன்றே பயிற்சியைத் தொடங்குங்கள்: https://www.ponna.in`,
        `Congratulations! Your ${planName} pass is now active. Start practising: https://www.ponna.in`,
      ],
      push: { title: 'PONNA.in: பாஸ் செயல்பட்டது 🎉', body: 'இப்போது பயிற்சியைத் தொடங்கலாம்.' },
    };
  }
  return {
    subject: 'PONNA.in: உங்கள் பணத்தைச் சரிபார்க்க முடியவில்லை / Payment could not be verified',
    lines: [
      `UTR ${utr} உள்ள பணத்தை எங்களால் சரிபார்க்க முடியவில்லை.${note ? ` காரணம்: ${note}` : ''}`,
      'பணம் பிடிக்கப்பட்டிருந்தால் ponna@arlena.in என்ற முகவரிக்கு உங்கள் UPI திரைப்படத்துடன் எழுதுங்கள். உடனே உதவுவோம்.',
      `We could not verify the payment with UTR ${utr}.${note ? ` Reason: ${note}` : ''} If money was debited, please email ponna@arlena.in with a screenshot and we will help right away.`,
    ],
    push: { title: 'PONNA.in: பணத்தைச் சரிபார்க்க முடியவில்லை', body: 'ponna@arlena.in-ஐத் தொடர்புகொள்ளவும்.' },
  };
}

export class CustomerNotifyService {
  /** Fire-and-forget. Always resolves. */
  paymentEvent(userId: string, planId: string, kind: Kind, utr: string, amount: string | number, note?: string | null): void {
    this.send(userId, planId, kind, utr, String(amount), note).catch((err) => console.error('Customer notify failed:', err?.message ?? err));
  }

  private async send(userId: string, planId: string, kind: Kind, utr: string, amount: string, note?: string | null) {
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
      prisma.plan.findUnique({ where: { id: planId }, select: { name: true } }),
    ]);
    if (!user) return;
    const c = content(kind, plan?.name ?? 'PONNA', amount, utr, note);
    await Promise.allSettled([
      this.email(user.email, user.name, c.subject, c.lines),
      pushNotificationService.isConfigured() ? pushNotificationService.sendToUser(userId, { ...c.push, url: '/plans' }) : Promise.resolve(),
    ]);
  }

  private async email(to: string | null, name: string | null, subject: string, lines: string[]) {
    const key = process.env.BREVO_API_KEY;
    const from = process.env.MAIL_FROM?.trim();
    if (!key || !from || !to) return;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">
      <p>வணக்கம் ${esc(name ?? '')},</p>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
      <p style="color:#64748b;font-size:12px">PONNA.in · ARLENA (OPC) PRIVATE LIMITED</p></div>`;
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'PONNA.in', email: from }, to: [{ email: to, name: name ?? undefined }], subject, htmlContent: html }),
    });
    if (!res.ok) console.error('Brevo email failed:', res.status, await res.text().catch(() => ''));
  }
}

export const customerNotifyService = new CustomerNotifyService();
