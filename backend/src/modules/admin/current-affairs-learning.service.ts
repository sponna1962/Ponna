import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const WINDOW_HOURS = 48;
const IST_OFFSET_MINUTES = 330;
const MIN_ITEMS = 8;
const MAX_ITEMS = 20;

type Candidate = {
  category: string;
  headline: string;
  eventDateTime: string;
  location: string;
  facts: string[];
};

type Verified = Candidate & {
  sourcePublishedAt: string;
  sourceUrl: string;
  verificationNote: string;
};

function cleanJson(raw: string) {
  return raw.replace(/^```json\s*|\s*```$/g, '').trim();
}

function normalize(value: string) {
  return (value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function fingerprint(date: string, headline: string) {
  return `${date.slice(0, 10)}|${normalize(headline)}`;
}

function istToUtc(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function window() {
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_HOURS * 60 * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export class CurrentAffairsLearningService {
  private async gemini(prompt: string, search: boolean, maxOutputTokens = 9000) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens },
    };
    if (search) body.tools = [{ google_search: {} }];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
    const data = await response.json() as any;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    try { return JSON.parse(cleanJson(raw)); } catch { throw new Error('AI returned invalid JSON for Current Affairs'); }
  }

  async list(limit = 1200) {
    return prisma.currentAffairsItem.findMany({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: Math.min(Math.max(limit, 1), 2000) });
  }

  async create(data: { date: string; category: string; headline: string; summary: string; sourceUrl?: string; examRelevanceNote?: string; verifiedAt?: string }) {
    const category = data.category.trim() || 'பொது';
    const headline = data.headline.trim();
    const existing = await prisma.currentAffairsItem.findMany({
      where: { date: istToUtc(data.date) },
      select: { headline: true },
    });
    const fp = fingerprint(data.date, headline);
    if (existing.some((row) => fingerprint(data.date, row.headline.replace(/^\[[^\]]+\]\s*/, '')) === fp)) {
      throw new Error('இந்த நிகழ்வு ஏற்கனவே சேர்க்கப்பட்டுள்ளது.');
    }
    return prisma.currentAffairsItem.create({
      data: {
        date: istToUtc(data.date),
        headline: `[${category}] ${headline}`,
        summary: data.summary.trim(),
        sourceUrl: data.sourceUrl?.trim() || null,
        examRelevanceNote: data.examRelevanceNote?.trim() || null,
        verifiedAt: new Date(data.verifiedAt || new Date().toISOString()),
      },
    });
  }

  async delete(id: string) {
    await prisma.currentAffairsItem.delete({ where: { id } });
  }

  private async discoverAndVerify() {
    const { start, end } = window();
    const discovery = await this.gemini(`CURRENT AFFAIRS DISCOVERY FOR PONNA.\n\nFind 15-25 significant, exam-relevant events for Indian competitive-exam students from Tamil Nadu, India and important international developments relevant to India. The event itself MUST have happened or first occurred between ${start} and ${end} UTC.\n\nCategories: தமிழ்நாடு, இந்தியா, உலகம், அறிவியல் மற்றும் தொழில்நுட்பம், பொருளாதாரம், சுற்றுச்சூழல், விளையாட்டு, கல்வி, விருதுகள் மற்றும் நியமனங்கள், முக்கிய நாட்கள்.\n\nDo not include routine political statements, celebrity news, ordinary crime, stock-market daily moves, every sports match, recycled coverage of an old event, anniversary stories, old reports, old schemes, or background facts. If the event date cannot be established, exclude it.\n\nReturn ONLY JSON: {\"events\":[{\"category\":\"...\",\"headline\":\"...\",\"eventDateTime\":\"ISO-8601 UTC\",\"location\":\"...\",\"facts\":[\"...\",\"...\"]}]}\nUse Google Search and prefer primary/official sources plus reputable reporting.`, true, 9000) as { events?: Candidate[] };

    const candidates = (discovery.events ?? []).slice(0, 25);
    const verification = await this.gemini(`INDEPENDENT VERIFICATION PASS FOR PONNA CURRENT AFFAIRS.\n\nIndependently search each candidate. Do not trust its date or facts. Accept ONLY events whose own occurrence/first occurrence is inside ${start} through ${end} UTC, whose key fact is supported by a reliable source, and which are useful for TNPSC/TNTET/general Indian competitive exams. A fresh article about an old event is NOT eligible.\n\nCANDIDATES:\n${candidates.map((c, i) => `${i + 1}. ${c.category} | ${c.headline} | ${c.eventDateTime} | ${c.facts.join(' | ')}`).join('\n')}\n\nReturn ONLY JSON: {\"verifiedEvents\":[{\"category\":\"...\",\"headline\":\"...\",\"eventDateTime\":\"ISO-8601 UTC\",\"location\":\"...\",\"facts\":[\"...\"],\"sourcePublishedAt\":\"ISO-8601 UTC\",\"sourceUrl\":\"https://...\",\"verificationNote\":\"...\"}]}. Reject uncertain or conflicting dates.`, true, 10000) as { verifiedEvents?: Verified[] };

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    return (verification.verifiedEvents ?? []).filter((item) => {
      const eventMs = new Date(item.eventDateTime).getTime();
      const sourceMs = new Date(item.sourcePublishedAt).getTime();
      return Number.isFinite(eventMs) && eventMs >= startMs && eventMs <= endMs && Number.isFinite(sourceMs) && sourceMs <= endMs && !!item.sourceUrl && item.facts?.length;
    });
  }

  async generateDaily() {
    const existing = await this.list(2000);
    const existingFingerprints = new Set(existing.map((row) => fingerprint(row.date.toISOString(), row.headline.replace(/^\[[^\]]+\]\s*/, ''))));
    const verified = await this.discoverAndVerify();
    const fresh = verified.filter((item) => !existingFingerprints.has(fingerprint(item.eventDateTime, item.headline)));

    if (fresh.length < MIN_ITEMS) {
      return { created: 0, skipped: true, verified: fresh.length, reason: `Only ${fresh.length} genuinely new verified events were available; nothing was created.` };
    }

    const selected = fresh.slice(0, MAX_ITEMS);
    let created = 0;
    for (const item of selected) {
      const facts = item.facts.slice(0, 3).join(' ');
      const relevance = `தேர்வுக்கு முக்கியம்: ${facts}\nநினைவில் வைக்க: ${item.category} — ${item.location || 'இந்தியா'} — ${item.eventDateTime.slice(0, 10)}`;
      try {
        await this.create({
          date: item.eventDateTime.slice(0, 10),
          category: item.category,
          headline: item.headline,
          summary: facts,
          sourceUrl: item.sourceUrl,
          examRelevanceNote: relevance,
          verifiedAt: new Date().toISOString(),
        });
        created += 1;
      } catch (err: any) {
        if (!String(err?.message).includes('ஏற்கனவே')) throw err;
      }
    }
    return { created, skipped: false, verified: fresh.length, date: new Date(Date.now() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10) };
  }
}

export const currentAffairsLearningService = new CurrentAffairsLearningService();
