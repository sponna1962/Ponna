// WhatsApp Business Cloud API — sending adapter (finalized requirement).
// All Meta-specific request/response logic isolated in this ONE file,
// same "external provider behind a clean boundary" principle as
// gemini-adapter.ts. Requires WHATSAPP_ACCESS_TOKEN and
// WHATSAPP_PHONE_NUMBER_ID env vars (Render, not yet set) and a
// Meta-approved message template (business-initiated messages cannot use
// free-form text -- template name is read from
// PlatformSettings.whatsappTemplateName, never hard-coded).

const GRAPH_API_VERSION = 'v21.0';

export class WhatsAppSendError extends Error {}

/**
 * Sends one templated WhatsApp message. `templateParams` fills the
 * template's numbered placeholders ({{1}}, {{2}}, ...) in order -- the
 * template's own wording/structure is whatever was approved in Meta
 * Business Manager, this function has no knowledge of it beyond the name
 * and how many params it expects.
 */
export async function sendWhatsAppTemplate(toPhoneE164: string, templateName: string, templateParams: string[]): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new WhatsAppSendError('WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not configured.');
  }

  // WhatsApp Cloud API expects the number without the leading "+".
  const to = toPhoneE164.replace(/^\+/, '');

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'ta' }, // matches the approved Tamil template; a future English variant would need its own approved template name
      components:
        templateParams.length > 0
          ? [{ type: 'body', parameters: templateParams.map((text) => ({ type: 'text', text })) }]
          : undefined,
    },
  };

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new WhatsAppSendError(`WhatsApp API error (${res.status}): ${errText.slice(0, 300)}`);
  }
}
