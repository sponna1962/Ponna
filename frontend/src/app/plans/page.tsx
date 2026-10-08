'use client';

import { useEffect, useState, Suspense } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';
import { daysRemaining, shouldShowRemainingDays, formatValidUntil } from '../../lib/pass-validity';

// My Plans — the student-facing half of the Annual Plan payment loop.
// Redesigned for compactness (finalized requirement — the previous
// full-width-card layout scrolled too long): Active Plans show as a
// compact horizontal chip strip right under the title, and purchasable
// plans show as a 2-column grid of small boxes — both tap open the same
// bottom-sheet with full scope details and the relevant action (Practice
// Now for an active plan, Buy for a purchasable one). The page's overall
// height stays constant whether or not the sheet is open.
//
// Calls POST /payments/create-order with a planId to get a Razorpay order,
// then opens Razorpay's checkout widget. The Subscription itself is NOT
// created here — that only happens when Razorpay's webhook confirms
// payment (see payment.service.ts).
//
// Deliberately never hardcodes a plan's name to decide anything — order
// comes from Plan.sortOrder (admin/seed-set), and each card's description
// is built from the Plan's real scope (Purpose or linked Authorities),
// fetched from the backend, not guessed from the name string.

declare global {
  interface Window {
    Razorpay: any;
    fbq: (...args: any[]) => void;
  }
}

type Scope = {
  purpose: { name: string; authorities: { name: string }[] } | null;
  authorityScopes: { authority: { name: string; categories: { name: string }[] } }[];
  subCategoryScopes?: { subCategory: { name: string } }[];
};

type Plan = Scope & {
  id: string;
  name: string;
  regularPrice: string | null;
  launchPrice: string | null;
  active: boolean;
  isFree: boolean;
  restrictToScope?: boolean;
};

type ActiveSubscription = {
  id: string;
  planId: string;
  cycleEnd: string;
  validUntil: string;
  plan: Scope & { id: string; name: string; nameTa: string | null; regularPrice: string | null; launchPrice: string | null };
};

/** Whole-Purpose plan (Competitive/Employment) lists the real Authorities
 * under it; a multi-authority plan (JEE) lists those authorities directly;
 * a single-authority plan lists its Categories if known (NEET → subjects,
 * TNTET → papers), else just the exam name (CLAT, BITSAT...). Always
 * built from real data, never hardcoded by plan name. */
function scopeTags(p: Scope): string[] {
  if (p.purpose) return p.purpose.authorities.map((a) => a.name);
  if (p.authorityScopes.length > 1) return p.authorityScopes.map((s) => s.authority.name);
  if (p.authorityScopes.length === 1) {
    const authority = p.authorityScopes[0].authority;
    if (authority.categories.length > 0) return authority.categories.map((c) => c.name);
    return [authority.name];
  }
  // Restricted/exclusive plans (e.g. TNPSC Group IV & VAO Pass) scope via
  // Sub-Categories directly rather than a whole Authority.
  if (p.subCategoryScopes && p.subCategoryScopes.length > 0) return p.subCategoryScopes.map((s) => s.subCategory.name);
  return [];
}

/** "NEET Annual Pass" -> "NEET" — used for compact chip/box titles. */
function shortName(name: string): string {
  return name.replace(/ (?:Annual )?(?:Plan|Pass)$/i, '').trim();
}

/** Display-only override for TNPSC's card title (finalized requirement —
 * "இப்போதைக்கு TNPSC Annual Plan என்று மட்டும் வைத்துக்கொள்ளலாமா") — the
 * underlying Plan.name stays "Competitive / Employment Annual Plan" in the
 * database (unchanged everywhere else: receipts, admin lists, Students
 * page), this only swaps what the student-facing card headline shows.
 * Deliberately temporary/easy-to-revert rather than a DB rename, per "for
 * now." Every other plan just shows its real name untouched. */
function displayName(name: string): string {
  if (/competitive|employment/i.test(name) && !/tnpsc/i.test(name)) return 'TNPSC Annual Pass';
  return name.replace(/ Annual Plan$/i, ' Annual Pass');
}

/** Finalized marketing copy per Annual Plan (Sept 15 launch — only TNPSC
 * and TNTET are live). Matched by name substring, same precedent as
 * shortName()/buyButtonLabel() below — deriving DISPLAY TEXT from the
 * plan's name is fine; deriving access/scope logic from it is not (that
 * always comes from real Purpose/Authority data elsewhere on this page).
 * Returns null for any plan not TNPSC/TNTET (e.g. a future re-enabled
 * exam) rather than guessing copy for it. */
/** Sept 2026 finalized Plans page redesign — each purchasable plan card
 * shows only its OWN 3 defining benefits (compact, scannable); every
 * other feature common to all Passes lives in the single "View all
 * features" sheet instead (see COMMON_FEATURES below). Returns null for
 * any plan not one of these three (e.g. a future re-enabled exam) rather
 * than guessing copy for it. */
function planFeatures(name: string, restrictToScope?: boolean): { description: string; mainBullets: string[]; buttonLabel: string } | null {
  // Detected by restrictToScope (real Plan data), never by matching the
  // Tamil name — matching this generic function's own "never guess
  // access/scope from the name string" principle used everywhere else on
  // this page. Checked BEFORE the generic /tnpsc/i match below, since this
  // plan's name also contains "TNPSC" and would otherwise match that
  // broader case first.
  if (restrictToScope) {
    return {
      description: 'குரூப்-4 தேர்வுக்கான சிறப்பு பயிற்சி',
      mainBullets: ['குரூப்-4 கேள்வி வங்கி', 'அதிகாரப்பூர்வ பாடத்திட்டத்தின் அடிப்படையிலான பயிற்சி'],
      buttonLabel: 'Get TNPSC குரூப்-4 Pass',
    };
  }
  // "Competitive / Employment Annual Plan" is TNPSC's real Plan name (a
  // whole-Purpose plan) — matched here alongside a literal "TNPSC" in the
  // name in case it's ever renamed to say that directly.
  if (/tnpsc/i.test(name) || /competitive|employment/i.test(name)) {
    return {
      description: 'முழுமையான TNPSC தேர்வு பயிற்சி',
      mainBullets: ['1,00,000+ TNPSC கேள்விகள்', 'அனைத்து முக்கிய TNPSC தேர்வுகளுக்கான பயிற்சி'],
      buttonLabel: 'Get TNPSC Pass',
    };
  }
  if (/tntet/i.test(name)) {
    return {
      description: 'முழுமையான TNTET தேர்வு பயிற்சி',
      mainBullets: ['முழுமையான TNTET கேள்வி வங்கி', 'தாள் I & தாள் II பயிற்சி'],
      buttonLabel: 'Get TNTET Pass',
    };
  }
  return null;
}

/** Sept 2026 finalized — features common to every paid Pass. Shown as a
 * compact "View More Features →" link on each card, opening a per-card
 * bottom sheet with this same list — keeps the card itself short while
 * the complete feature set stays available for every Pass. */
const MORE_FEATURES = [
  'Previous Year Exam Papers',
  'Expert-Crafted Practice',
  'Instant Answers',
  'Daily Challenge',
  'Brain Challenge',
  'Review Mistakes',
  'Performance Analysis',
  'Tamil & English',
];



export default function PlansPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading…</main>}>
      <PlansPageInner />
    </Suspense>
  );
}

type SheetContent = {
  title: string;
  scopeTags: string[];
  price?: { regularPrice: string | null; launchPrice: string | null };
  activeUntil?: string;
  action: 'buy' | 'practice';
  planId?: string;
  freeNote?: string;
};

type UpiSheetData = { planId: string; planName: string; amount: number; upiId: string; payeeName: string };
type UpiSubmission = { id: string; planId: string; amount: string | number; status: 'PENDING' | 'APPROVED' | 'REJECTED'; adminNote?: string | null; createdAt?: string };

function PlansPageInner() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const highlightPlanId = searchParams.get('highlight');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeSubs, setActiveSubs] = useState<ActiveSubscription[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetContent | null>(null);
  const [moreFeaturesFor, setMoreFeaturesFor] = useState<{ title: string } | null>(null);
  // Oct 2026 — interim manual UPI payment (see backend manual-payment.service).
  const [upiSheet, setUpiSheet] = useState<UpiSheetData | null>(null);
  const [upiSubmissions, setUpiSubmissions] = useState<UpiSubmission[]>([]);
  const [upiLoaded, setUpiLoaded] = useState(false);
  const [profileDone, setProfileDone] = useState(true);

  useEffect(() => {
    studentFetch('/students/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (p && p.profileComplete === false) setProfileDone(false); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    studentFetch('/payments/upi-submissions')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setUpiSubmissions(Array.isArray(d) ? d : []))
      .catch(() => setUpiSubmissions([]))
      .finally(() => setUpiLoaded(true));
  }, []);

  // While a submission is waiting for approval, check every 15s; the moment
  // the owner approves, reload so the student sees their active pass without
  // having to do anything.
  const hasPendingUpi = upiSubmissions.some((u) => u.status === 'PENDING');
  useEffect(() => {
    if (!hasPendingUpi) return;
    const timer = setInterval(() => {
      studentFetch('/payments/upi-submissions')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!Array.isArray(d)) return;
          if (d.some((u: UpiSubmission) => u.status === 'APPROVED') && !upiSubmissions.some((u) => u.status === 'APPROVED')) {
            window.location.reload();
          } else {
            setUpiSubmissions(d);
          }
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [hasPendingUpi, upiSubmissions]);

  // The student tapped "Pay with UPI app", left to their UPI app, and came
  // back (the browser may have reloaded this page meanwhile) — reopen the
  // payment screen so they can enter the transaction ID right away.
  useEffect(() => {
    if (!plansLoaded || !upiLoaded || upiSheet) return;
    let draft: string | null = null;
    try {
      draft = localStorage.getItem('ponna_upi_draft');
    } catch {}
    if (!draft) return;
    if (upiSubmissions.some((u) => u.planId === draft && u.status !== 'REJECTED')) {
      try { localStorage.removeItem('ponna_upi_draft'); } catch {}
      return;
    }
    if (plans.some((p) => p.id === draft && p.active && !p.isFree)) buy(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansLoaded, upiLoaded]);

  useEffect(() => {
    Promise.all([
      studentFetch('/plans').then((r) => {
        if (!r.ok) throw new Error(`Failed to load plans (HTTP ${r.status})`);
        return r.json();
      }),
      studentFetch('/students/me/subscriptions').then((r) => {
        if (!r.ok) throw new Error(`Failed to load your active plans (HTTP ${r.status})`);
        return r.json();
      }),
    ])
      .then(([plansData, subsData]) => {
        setPlans(Array.isArray(plansData) ? plansData : []);
        setActiveSubs(Array.isArray(subsData) ? subsData : []);
      })
      .catch((err) => setError(err.message ?? 'Failed to load plans'))
      .finally(() => setPlansLoaded(true));
  }, []);

  // Deep-linked here from the Free-fallback "Get Annual Plan" prompt —
  // the highlighted plan's card already shows everything directly now
  // (full-width hero cards, no more tap-to-open-sheet for purchasing), so
  // this just scrolls it into view; the gold border (set via
  // highlightPlanId below) is what actually draws the eye to it.
  useEffect(() => {
    if (!plansLoaded || !highlightPlanId) return;
    document.getElementById(`plan-${highlightPlanId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [plansLoaded, highlightPlanId]);

  async function buy(planId: string) {
    setError(null);
    setLoadingPlan(planId);

    try {
      // Oct 2026 — when UPI_ID is configured on the server, pay by UPI and
      // submit the transaction ID for approval instead of opening Razorpay.
      const upiInfo = await studentFetch('/payments/upi-info')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (upiInfo?.enabled) {
        // Profile is no longer required before paying — payment comes first.
        const plan = plans.find((x) => x.id === planId);
        const amount = Number(plan?.launchPrice ?? plan?.regularPrice ?? 0);
        setUpiSheet({ planId, planName: displayName(plan?.name ?? ''), amount, upiId: upiInfo.upiId, payeeName: upiInfo.payeeName });
        return;
      }

      const res = await studentFetch('/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? t.plans.paymentError);
      }
      const order = await res.json();

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'PONNA',
        handler: function () {
          // Oct 2026 — Meta Pixel Purchase event, fired the moment Razorpay's
          // checkout confirms the charge client-side (before our webhook has
          // necessarily processed it — see create-order comment above). Good
          // enough signal for ad-campaign optimization; value/currency come
          // straight from the order Razorpay already confirmed against.
          if (typeof window.fbq === 'function') {
            window.fbq('track', 'Purchase', { value: order.amount / 100, currency: order.currency });
          }
          window.location.href = '/plans?payment=processing';
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      });
      razorpay.open();
    } catch (err: any) {
      setError(err.message ?? t.plans.paymentError);
    } finally {
      setLoadingPlan(null);
    }
  }

  /** "NEET Annual Plan" -> "Get NEET Plan" / "NEET திட்டம் வாங்கவும்" — built
   * from the Plan's own name (data), never a hardcoded per-plan mapping. */
  function buyButtonLabel(name: string): string {
    const short = shortName(displayName(name));
    return lang === 'ta' ? `${short} பாஸ் வாங்கவும்` : `Get ${short} Pass`;
  }

  const activePlanIds = new Set(activeSubs.map((s) => s.planId));
  const freePlan = plans.find((p) => p.isFree);
  const otherAvailablePlans = plans.filter((p) => !p.isFree && p.active && !activePlanIds.has(p.id));

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Oct 2026 redesign — teal header band; presentation only, all logic unchanged. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 22px', background: 'linear-gradient(180deg, var(--color-head1, #0c2f3f), var(--color-head2, #1c6b6b))', borderBottom: '3px solid #E2B04A' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 800, margin: 0, color: '#fff', flex: 1 }}>{lang === 'ta' ? 'எனது பாஸ்கள்' : 'My Passes'}</h1>
        {/* Free chip sits in the header when there is no Active pass yet; once
            Active passes exist it moves below them (unchanged behaviour). */}
        {freePlan && activeSubs.length === 0 && (
          <a href="/quiz" style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 20, padding: '6px 13px', fontSize: 12.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', textDecoration: 'none' }}>
            {t.plans.freeChipLabel}
          </a>
        )}
      </div>

      <div style={{ padding: 16 }}>
      {upiSubmissions.some((u) => u.status === 'PENDING') && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: '4px solid #FFD22A', borderRadius: 10, padding: 18, marginBottom: 14 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink, margin: '0 0 6px' }}>{lang === 'ta' ? '✓ பணம் பதிவானது' : '✓ Payment recorded'}</p>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, lineHeight: 1.65, margin: '0 0 10px' }}>
            {lang === 'ta'
              ? 'உங்கள் UPI பணம் சரிபார்ப்பில் உள்ளது. உறுதி செய்யப்பட்டதும் உங்கள் பாஸ் செயல்படும்.'
              : 'Your UPI payment is being verified. Your pass will activate as soon as it is confirmed.'}
          </p>
          {!profileDone && (
            <>
              <p style={{ fontSize: 13.5, color: COLORS.ink, fontWeight: 600, lineHeight: 1.6, margin: '0 0 12px' }}>
                {lang === 'ta' ? 'அதுவரை உங்கள் Profile-ஐ நிரப்புங்கள் — பயிற்சி தொடங்க அது தேவை.' : 'Meanwhile, please complete your Profile — it is needed to start practice.'}
              </p>
              <a href="/profile?complete=1" style={{ display: 'block', padding: 15, borderRadius: 8, background: COLORS.btn, color: COLORS.btnText, textAlign: 'center', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                {lang === 'ta' ? 'Profile-ஐ நிரப்புங்கள் →' : 'Complete your Profile →'}
              </a>
            </>
          )}
        </div>
      )}
      {upiSubmissions.some((u) => u.status === 'REJECTED') && !upiSubmissions.some((u) => u.status === 'PENDING' || u.status === 'APPROVED') && (
        <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', color: '#991B1B', borderRadius: 8, padding: '13px 14px', fontSize: 13.5, marginBottom: 14, lineHeight: 1.6 }}>
          {lang === 'ta'
            ? 'உங்கள் முந்தைய UPI பதிவை உறுதிப்படுத்த முடியவில்லை. சரியான பரிவர்த்தனை எண்ணுடன் மீண்டும் முயலவும் அல்லது ponna@arlena.in-க்கு எழுதவும்.'
            : 'Your last UPI submission could not be verified. Please try again with the correct transaction ID, or email ponna@arlena.in.'}
          {upiSubmissions.find((u) => u.status === 'REJECTED')?.adminNote && (
            <div style={{ marginTop: 6, fontWeight: 600 }}>{upiSubmissions.find((u) => u.status === 'REJECTED')?.adminNote}</div>
          )}
        </div>
      )}

      {!plansLoaded && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>Loading…</p>}

      {plansLoaded && (
        <>
          {/* Sept 2026 finalized requirement — ACCOUNT -> Plan is the
              canonical place for full Pass validity info: Name, Active
              badge, and "Valid until [date]" directly visible (not
              behind a tap), "X days remaining" only in the final 30
              days. Tapping a card still opens the existing bottom sheet
              for the Practice Now action. */}
          {activeSubs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {activeSubs.map((s) => {
                const showDays = shouldShowRemainingDays(s.validUntil);
                const days = daysRemaining(s.validUntil);
                const price = s.plan.launchPrice ?? s.plan.regularPrice;
                return (
                  <button
                    key={s.id}
                    onClick={() =>
                      setSheet({
                        title: displayName(s.plan.name),
                        scopeTags: scopeTags(s.plan),
                        activeUntil: s.validUntil,
                        action: 'practice',
                      })
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: `linear-gradient(135deg, ${COLORS.goldLight}, var(--color-card, ${COLORS.paper}))`,
                      border: `1px solid ${COLORS.gold}`,
                      borderLeft: '6px solid #1e8a3b',
                      borderRadius: 10,
                      padding: '15px 16px',
                      marginBottom: 14,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{displayName(s.plan.name)}</span>
                      {price != null && <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.inkMuted, flexShrink: 0, whiteSpace: 'nowrap' }}>₹{price}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#166534', background: '#DCFCE7', borderRadius: 20, padding: '3px 10px' }}>
                        ✓ Active
                      </span>
                      <span style={{ fontSize: 12, color: COLORS.inkMuted }}>Valid until {formatValidUntil(s.validUntil)}</span>
                    </div>
                    {showDays && (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: days <= 7 ? '#B91C1C' : '#92400E' }}>
                        {days} {days === 1 ? 'day' : 'days'} remaining
                      </div>
                    )}
                  </button>
                );
              })}

              {freePlan && (
                <a
                  href="/quiz"
                  style={{
                    display: 'inline-block',
                    background: COLORS.paperAlt,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.inkMuted,
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                    marginTop: 2,
                  }}
                >
                  {t.plans.freeChipLabel}
                </a>
              )}
            </div>
          )}

          {otherAvailablePlans.length > 0 && (
            <>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: '6px 0 14px' }}>
                <span style={{ width: 5, height: 20, borderRadius: 3, background: '#E2B04A' }} />
                {lang === 'ta' ? 'உங்கள் பாஸைத் தேர்வு செய்யவும்' : 'Choose Your Pass'}
              </h2>

              {otherAvailablePlans.map((p) => {
                const hasLaunch = p.launchPrice != null;
                const features = planFeatures(p.name, p.restrictToScope);
                return (
                  <div
                    key={p.id}
                    id={`plan-${p.id}`}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      background: 'var(--color-card, ' + COLORS.paper + ')',
                      border: `1.5px solid ${p.id === highlightPlanId ? '#E2B04A' : COLORS.line}`,
                      boxShadow: p.id === highlightPlanId ? '0 0 0 3px rgba(226,176,74,0.25), 0 12px 30px -20px rgba(15,47,51,0.55)' : '0 12px 30px -20px rgba(15,47,51,0.55)',
                      borderRadius: 20,
                      padding: '22px 18px 18px',
                      marginBottom: 18,
                    }}
                  >
                    {hasLaunch && (
                      <div style={{ position: 'absolute', top: 0, right: 0, background: 'linear-gradient(135deg,#F3C65A,#D99A1E)', color: '#2b1c00', fontSize: 11.5, fontWeight: 800, padding: '6px 14px 6px 18px', borderBottomLeftRadius: 14 }}>
                        {t.plans.launchPrice}
                      </div>
                    )}
                    <div style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 800, color: COLORS.ink, marginBottom: 4, marginRight: hasLaunch ? 76 : 0 }}>{displayName(p.name)}</div>

                    {features && (
                      <div style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 14 }}>{features.description}</div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: COLORS.goldLight }}>
                      {hasLaunch ? (
                        <>
                          <span style={{ fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: 800, color: COLORS.gold }}>₹{p.launchPrice}</span>
                          <span style={{ fontSize: 13, color: COLORS.inkMuted }}>{t.plans.perYear}</span>
                          <span style={{ fontSize: 13, color: COLORS.inkMuted, textDecoration: 'line-through' }}>₹{p.regularPrice}</span>
                        </>
                      ) : (
                        <span style={{ fontFamily: FONT_FAMILY, fontSize: 26, fontWeight: 800 }}>
                          ₹{p.regularPrice ?? '—'} <span style={{ fontSize: 13, fontWeight: 400 }}>{p.restrictToScope ? t.plans.untilExam : t.plans.perYear}</span>
                        </span>
                      )}
                    </div>

                    {features && (
                      <div style={{ marginBottom: 10 }}>
                        {features.mainBullets.map((b) => (
                          <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 14.5, color: COLORS.ink, lineHeight: 1.45 }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: COLORS.goldLight, color: COLORS.gold, fontWeight: 800, fontSize: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sept 2026 finalized redesign — the full common
                        feature set stays PART of this Pass (per-card,
                        not a separate shared entry point) but lives
                        behind a compact link so the card itself stays
                        short. */}
                    <button
                      onClick={() => setMoreFeaturesFor({ title: displayName(p.name) })}
                      style={{ display: 'block', background: 'none', border: 'none', padding: 0, marginBottom: 16, fontSize: 13, fontWeight: 700, color: COLORS.gold, cursor: 'pointer' }}
                    >
                      View More Features →
                    </button>

                    <button
                      onClick={() => buy(p.id)}
                      disabled={loadingPlan === p.id}
                      style={{ width: '100%', padding: 16, borderRadius: 8, background: 'var(--color-btn, ' + COLORS.ink + ')', color: 'var(--color-btnText, ' + COLORS.paper + ')', border: 'none', fontWeight: 700, fontSize: 16.5, cursor: 'pointer', boxShadow: '0 10px 22px -12px rgba(15,47,51,0.7)' }}
                    >
                      {loadingPlan === p.id ? '…' : features?.buttonLabel ?? buyButtonLabel(p.name)}
                    </button>
                    <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.inkMuted, textAlign: 'center' }}>
                      {lang === 'ta' ? 'UPI-ல் செலுத்தி, பரிவர்த்தனை எண்ணை அனுப்புங்கள்.' : 'Pay by UPI, then send us the transaction ID.'}
                    </div>
                  </div>
                );
              })}

              {/* Sept 2026 finalized redesign (per-card "View More
                  Features") — the shared feature list is now surfaced
                  from each card individually (see moreFeaturesFor
                  above), so no separate global trigger lives here
                  anymore. */}
            </>
          )}
        </>
      )}

      {error && <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>

      {sheet && (
        <PlanSheet
          content={sheet}
          onClose={() => setSheet(null)}
          onBuy={buy}
          buying={sheet.planId === loadingPlan}
          buyLabel={sheet.planId ? buyButtonLabel(sheet.title) : ''}
        />
      )}

      {upiSheet && (
        <UpiPaySheet
          data={upiSheet}
          lang={lang}
          onClose={() => setUpiSheet(null)}
          onSubmitted={(sub) => {
            setUpiSubmissions((prev) => [sub, ...prev]);
            setUpiSheet(null);
          }}
        />
      )}

      {moreFeaturesFor && <MoreFeaturesSheet title={moreFeaturesFor.title} onClose={() => setMoreFeaturesFor(null)} lang={lang} />}
    </main>
  );
}

function PlanSheet({
  content,
  onClose,
  onBuy,
  buying,
  buyLabel,
}: {
  content: SheetContent;
  onClose: () => void;
  onBuy: (planId: string) => void;
  buying: boolean;
  buyLabel: string;
}) {
  const { t } = useLanguage();
  const hasLaunch = content.price?.launchPrice != null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,34,56,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: COLORS.paper,
          borderRadius: '16px 16px 0 0',
          padding: 20,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        }}
      >
        <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>{content.title}</h3>

        {content.activeUntil && (
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 12 }}>
            {t.plans.activeUntil}: {new Date(content.activeUntil).toLocaleDateString()}
          </p>
        )}

        {content.freeNote && <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 12 }}>{content.freeNote}</p>}

        {content.price && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            {hasLaunch ? (
              <>
                <span style={{ fontFamily: FONT_FAMILY, fontSize: 26, fontWeight: 800, color: COLORS.gold }}>₹{content.price!.launchPrice}</span>
                <span style={{ fontSize: 13, color: COLORS.inkMuted }}>{t.plans.perYear}</span>
                <span style={{ fontSize: 13, color: COLORS.inkMuted, textDecoration: 'line-through' }}>₹{content.price!.regularPrice}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7A5A14', background: COLORS.goldLight, padding: '2px 8px', borderRadius: 4 }}>
                  {t.plans.launchPrice}
                </span>
              </>
            ) : (
              <span style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 800 }}>
                ₹{content.price!.regularPrice ?? '—'} <span style={{ fontSize: 13, fontWeight: 400 }}>{t.plans.perYear}</span>
              </span>
            )}
          </div>
        )}

        {content.scopeTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {content.scopeTags.map((tag) => (
              <span
                key={tag}
                style={{ fontSize: 12, fontWeight: 600, color: COLORS.inkMuted, background: COLORS.paperAlt, border: `1px solid ${COLORS.line}`, borderRadius: 20, padding: '3px 10px' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {content.action === 'practice' ? (
          <a
            href="/quiz"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: 13,
              borderRadius: 8,
              background: COLORS.ink,
              color: COLORS.paper,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              marginBottom: 8,
            }}
          >
            {t.plans.practiceNow}
          </a>
        ) : (
          <button
            onClick={() => content.planId && onBuy(content.planId)}
            disabled={buying}
            style={{ width: '100%', padding: 13, borderRadius: 8, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}
          >
            {buying ? '…' : buyLabel}
          </button>
        )}

        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: COLORS.inkMuted, fontSize: 13, padding: 4, cursor: 'pointer' }}>
          {t.plans.close}
        </button>
      </div>
    </div>
  );
}

/** Sept 2026 finalized redesign — each plan card's "View More Features"
 * link opens this, titled with that card's own Pass name. Content
 * (MORE_FEATURES) is the same underlying feature set for every Pass —
 * not fetched, since it's static and identical for all of them — but the
 * sheet itself is per-card, so the feature set still reads as fully part
 * of THAT Pass rather than a separate, detached "common features" page. */
function MoreFeaturesSheet({ title, onClose, lang }: { title: string; onClose: () => void; lang: string }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,34,56,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: COLORS.paper,
          borderRadius: '16px 16px 0 0',
          padding: 20,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        }}
      >
        <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, color: COLORS.ink, marginBottom: 2 }}>{title}</h3>
        <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 16 }}>
          {lang === 'ta' ? 'இந்த பாஸ்-ல் அடங்கியிருப்பவை' : 'Included with this Pass'}
        </p>

        {MORE_FEATURES.map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 14.5, color: COLORS.ink, lineHeight: 1.45 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: COLORS.goldLight, color: COLORS.gold, fontWeight: 800, fontSize: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
            <span>{item}</span>
          </div>
        ))}

        <button
          onClick={onClose}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: COLORS.paperAlt, color: COLORS.ink, border: `1px solid ${COLORS.line}`, fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 12 }}
        >
          {lang === 'ta' ? 'மூடு' : 'Close'}
        </button>
      </div>
    </div>
  );
}

// Oct 2026 — interim manual UPI payment sheet. The student pays the business
// UPI ID in their UPI app, then enters the 12-digit UPI transaction ID (UTR);
// an admin verifies the money arrived and approves. The pass is NOT active
// until that approval — the backend only creates the Subscription then.
function UpiPaySheet({
  data,
  lang,
  onClose,
  onSubmitted,
}: {
  data: UpiSheetData;
  lang: string;
  onClose: () => void;
  onSubmitted: (s: UpiSubmission) => void;
}) {
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ta = lang === 'ta';

  const payLink = `upi://pay?pa=${encodeURIComponent(data.upiId)}&pn=${encodeURIComponent(data.payeeName)}&am=${data.amount}&cu=INR&tn=${encodeURIComponent('PONNA ' + data.planName)}`;

  function clearDraft() {
    try { localStorage.removeItem('ponna_upi_draft'); } catch {}
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await studentFetch('/payments/upi-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: data.planId, utr }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? (ta ? 'சமர்ப்பிக்க முடியவில்லை' : 'Could not submit'));
      }
      // Meta Pixel — a submitted payment is the strongest conversion signal
      // we have until a gateway is live; value matches the plan price.
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', { value: data.amount, currency: 'INR' });
      }
      clearDraft();
      onSubmitted({ id: body.id, planId: data.planId, amount: data.amount, status: 'PENDING' });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={() => { clearDraft(); onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.paper, color: COLORS.ink, width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', padding: 20, maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 20, margin: '0 0 4px' }}>{data.planName}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 800 }}>₹{data.amount}</p>

        <ol style={{ paddingLeft: 18, margin: '0 0 16px', fontSize: 14, lineHeight: 1.7 }}>
          <li>{ta ? `கீழே உள்ள UPI ID-க்கு ₹${data.amount} செலுத்துங்கள்.` : `Pay ₹${data.amount} to the UPI ID below.`}</li>
          <li>{ta ? 'UPI செயலியில் வரும் 12 இலக்க பரிவர்த்தனை எண்ணை கீழே உள்ளிட்டு எங்களுக்கு அனுப்புங்கள்.' : 'Enter the 12-digit transaction ID from your UPI app below and send it to us.'}</li>
          <li>{ta ? 'நாங்கள் சரிபார்த்து உங்கள் PONNA Pass-ஐ இயக்குவோம்.' : 'We verify it and activate your PONNA Pass.'}</li>
        </ol>

        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: COLORS.inkMuted }}>UPI ID</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ fontSize: 16, wordBreak: 'break-all' }}>{data.upiId}</strong>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(data.upiId).then(() => setCopied(true)).catch(() => {});
              }}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLORS.line}`, background: 'transparent', color: COLORS.ink, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
            >
              {copied ? (ta ? 'நகலெடுத்தது' : 'Copied') : ta ? 'நகலெடு' : 'Copy'}
            </button>
          </div>
        </div>

        {/* QR for the amount-prefilled UPI link — scan with any UPI app
            (GPay, PhonePe, Paytm…). Always on a white tile so it scans in
            any theme. Phone users can just tap the button below instead. */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ display: 'inline-block', background: '#fff', padding: 10, borderRadius: 10, border: `1px solid ${COLORS.line}` }}>
            <QRCodeSVG value={payLink} size={168} level="M" />
          </div>
          <div style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 6 }}>
            {ta ? 'எந்த UPI செயலியிலும் ஸ்கேன் செய்து செலுத்தலாம்' : 'Scan with any UPI app to pay'} · ₹{data.amount}
          </div>
        </div>

        <a
          href={payLink}
          onClick={() => {
            try { localStorage.setItem('ponna_upi_draft', data.planId); } catch {}
          }}
          style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, fontWeight: 600, fontSize: 15, textDecoration: 'none', marginBottom: 16 }}
        >
          {ta ? 'UPI செயலியில் செலுத்து' : 'Pay with UPI app'}
        </a>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {ta ? 'UPI பரிவர்த்தனை எண் (12 இலக்கம்)' : 'UPI transaction ID (12 digits)'}
        </label>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: '0 0 6px', lineHeight: 1.5 }}>
          {ta
            ? 'Google Pay: "UPI transaction ID" · PhonePe: "UTR" · Paytm: "UPI Ref No". எண்கள் மட்டும், 12 இலக்கம்.'
            : 'Google Pay: "UPI transaction ID" · PhonePe: "UTR" · Paytm: "UPI Ref No". Digits only, 12 digits.'}
        </p>
        <input
          value={utr}
          onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
          inputMode="numeric"
          placeholder="123456789012"
          style={{ width: '100%', boxSizing: 'border-box', padding: 12, fontSize: 16, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: 'transparent', color: COLORS.ink, marginBottom: 10 }}
        />


        {err && <p style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 10px' }}>{err}</p>}

        <button
          onClick={submit}
          disabled={busy || utr.length !== 12}
          style={{ width: '100%', padding: 14, borderRadius: 10, background: COLORS.gold, color: '#1a1a1a', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy || utr.length !== 12 ? 0.5 : 1 }}
        >
          {busy ? '…' : ta ? 'சமர்ப்பி' : 'Submit'}
        </button>
        <div style={{ height: 10 }} />
        <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>
          {ta
            ? 'ஏற்கெனவே பணம் செலுத்திவிட்டீர்களா, ஆனால் எண்ணை உள்ளிட முடியவில்லையா? மீண்டும் செலுத்த வேண்டாம். இதே திரையை மீண்டும் திறந்து, உங்கள் UPI செயலியின் வரலாற்றில் உள்ள 12 இலக்க பரிவர்த்தனை எண்ணை மட்டும் கீழே உள்ளிடுங்கள்.'
            : 'Already paid but could not enter the ID? Do not pay again. Reopen this screen and enter only the 12-digit transaction ID from your UPI app history below.'}
        </div>
        <ProblemReport ta={ta} />
        <button onClick={() => { clearDraft(); onClose(); }} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: COLORS.inkMuted, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>
          {ta ? 'மூடு' : 'Close'}
        </button>
        <p style={{ fontSize: 11, color: COLORS.inkMuted, margin: '8px 0 0', textAlign: 'center' }}>
          {ta ? 'சிக்கல் இருந்தால்: ponna@arlena.in' : 'Need help? ponna@arlena.in'}
        </p>
      </div>
    </div>
  );
}

// "I paid but something went wrong" — tells the owner immediately (Telegram /
// push alert on the backend) and shows a mail fallback in case even that fails.
function ProblemReport({ ta }: { ta: boolean }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function send() {
    setState('sending');
    try {
      const res = await studentFetch('/payments/upi-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ width: '100%', padding: 10, background: 'none', border: 'none', color: COLORS.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 6 }}
      >
        {ta ? 'பணம் செலுத்தியும் சிக்கலா? எங்களுக்குத் தெரிவியுங்கள்' : 'Paid but facing a problem? Tell us'}
      </button>
    );
  }
  if (state === 'sent') {
    return (
      <p style={{ fontSize: 13, color: '#166534', background: '#DCFCE7', borderRadius: 8, padding: 10, margin: '8px 0' }}>
        {ta ? 'தகவல் எங்களுக்குக் கிடைத்தது. விரைவில் உங்களைத் தொடர்பு கொள்கிறோம்.' : 'We have your message and will get back to you soon.'}
      </p>
    );
  }
  return (
    <div style={{ margin: '8px 0' }}>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={3}
        placeholder={ta ? 'என்ன நடந்தது? (எ.கா. பணம் கழிந்தது, எண்ணை உள்ளிட முடியவில்லை)' : 'What happened? (e.g. money was debited but I could not submit)'}
        style={{ width: '100%', boxSizing: 'border-box', padding: 10, fontSize: 14, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: 'transparent', color: COLORS.ink }}
      />
      <button
        onClick={send}
        disabled={state === 'sending' || msg.trim().length < 3}
        style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: 'transparent', color: COLORS.ink, fontWeight: 600, cursor: 'pointer', marginTop: 6, opacity: msg.trim().length < 3 ? 0.5 : 1 }}
      >
        {state === 'sending' ? '…' : ta ? 'அனுப்பு' : 'Send'}
      </button>
      {state === 'error' && (
        <p style={{ fontSize: 12, color: '#b91c1c', margin: '6px 0 0' }}>
          {ta ? 'அனுப்ப முடியவில்லை. தயவுசெய்து ponna@arlena.in-க்கு எழுதுங்கள்.' : 'Could not send. Please email ponna@arlena.in.'}
        </p>
      )}
    </div>
  );
}
