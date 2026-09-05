// Live Search adapter (Ask Ponna Master Requirement, Spec v5 Refinement
// 1 / v6 Refinement 1, BINDING) — Tier 3 fallback for time-sensitive
// questions when verified PONNA data (Tier 1) is missing or stale. All
// external-API-specific logic isolated in this ONE file, same principle
// as gemini-adapter.ts/whatsapp-adapter.ts.
//
// Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID env vars
// (Google Cloud Console -> Custom Search JSON API + a Programmable
// Search Engine) — NOT YET SET on Render, same category of gap as the
// Gemini/WhatsApp credentials before this. Fails gracefully (returns
// "unavailable", never throws into the chat flow) when not configured.
//
// Official-source-first (Spec v6 Refinement 1): tries a query restricted
// to known official domains FIRST; only falls back to an unrestricted
// query if that returns nothing, and the result is then explicitly
// labeled as non-official in the tool's response shape.

const OFFICIAL_DOMAINS = ['tnpsc.gov.in', 'trb.tn.gov.in', 'tn.gov.in'];

export type LiveSearchResult = {
  available: boolean;
  isOfficialSource: boolean;
  results: { title: string; snippet: string; url: string }[];
};

async function runSearch(query: string, apiKey: string, engineId: string): Promise<{ title: string; snippet: string; url: string }[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&num=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Custom Search error (${res.status})`);
  const data: any = await res.json();
  return (data.items ?? []).map((item: any) => ({ title: item.title, snippet: item.snippet, url: item.link }));
}

export async function searchCurrentInfo(query: string): Promise<LiveSearchResult> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !engineId) {
    return { available: false, isOfficialSource: false, results: [] };
  }

  try {
    // Official-source-first: restrict to known official domains.
    const siteRestriction = OFFICIAL_DOMAINS.map((d) => `site:${d}`).join(' OR ');
    const officialResults = await runSearch(`${query} (${siteRestriction})`, apiKey, engineId);
    if (officialResults.length > 0) {
      return { available: true, isOfficialSource: true, results: officialResults };
    }

    // Fall back to an unrestricted query -- explicitly NOT official.
    const generalResults = await runSearch(query, apiKey, engineId);
    return { available: generalResults.length > 0, isOfficialSource: false, results: generalResults };
  } catch (err) {
    console.error('[search_current_info] Search failed:', err);
    return { available: false, isOfficialSource: false, results: [] };
  }
}
