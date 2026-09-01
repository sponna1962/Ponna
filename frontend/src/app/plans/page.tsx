'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

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
  }
}

type Scope = {
  purpose: { name: string; authorities: { name: string }[] } | null;
  authorityScopes: { authority: { name: string; categories: { name: string }[] } }[];
};

type Plan = Scope & {
  id: string;
  name: string;
  regularPrice: string | null;
  launchPrice: string | null;
  active: boolean;
  isFree: boolean;
};

type ActiveSubscription = {
  id: string;
  planId: string;
  cycleEnd: string;
  plan: Scope & { id: string; name: string; nameTa: string | null };
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
  return [];
}

/** "NEET Annual Plan" -> "NEET" — used for compact chip/box titles. */
function shortName(name: string): string {
  return name.replace(/ Annual Plan$/i, '').trim();
}

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
  // open that plan's sheet directly rather than just scrolling to a card,
  // since the card itself is now a small grid box with no visible price
  // detail until tapped.
  useEffect(() => {
    if (!plansLoaded || !highlightPlanId) return;
    const p = plans.find((pl) => pl.id === highlightPlanId);
    if (p) setSheet({ title: p.name, scopeTags: scopeTags(p), price: p, action: 'buy', planId: p.id });
  }, [plansLoaded, highlightPlanId, plans]);

  async function buy(planId: string) {
    setError(null);
    setLoadingPlan(planId);

    try {
      const res = await studentFetch('/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const body = await res.json();
        if (body.code === 'PROFILE_INCOMPLETE') {
          window.location.href = '/profile?complete=1';
          return;
        }
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
    const short = shortName(name);
    return lang === 'ta' ? `${short} திட்டம் வாங்கவும்` : `Get ${short} Plan`;
  }

  const activePlanIds = new Set(activeSubs.map((s) => s.planId));
  const freePlan = plans.find((p) => p.isFree);
  const otherAvailablePlans = plans.filter((p) => !p.isFree && p.active && !activePlanIds.has(p.id));

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: activeSubs.length > 0 ? 16 : 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.plans.myPlansTitle}</h1>
        </div>

        {/* Free chip lives right next to the title when there's nothing
            else competing for that row (no Active plans yet) — saves a
            whole row of vertical space. Once Active plans exist, it moves
            down into the chip strip below instead, since the title row
            would otherwise get cramped or wrap. Direct navigation to
            /quiz — no sheet, there's nothing more to say about Free
            beyond "5 questions/day", already on the chip itself. */}
        {freePlan && activeSubs.length === 0 && (
          <a
            href="/quiz"
            style={{
              flex: '0 0 auto',
              background: COLORS.paperAlt,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 20,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.inkMuted,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}
          >
            {t.plans.freeChipLabel}
          </a>
        )}
      </div>

      {!plansLoaded && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>Loading…</p>}

      {plansLoaded && (
        <>
          {/* Active Plans + Free — shown together in their own row only
              once there's an Active plan to share it with (see the
              title-row placement above for the Free-only case). */}
          {activeSubs.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 2 }}>
              {activeSubs.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    setSheet({
                      title: s.plan.name,
                      scopeTags: scopeTags(s.plan),
                      activeUntil: s.cycleEnd,
                      action: 'practice',
                    })
                  }
                  style={{
                    flex: '0 0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: COLORS.goldLight,
                    border: `1px solid ${COLORS.gold}`,
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#5C4009',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  ✓ {shortName(s.plan.name)} · {new Date(s.cycleEnd).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </button>
              ))}

              {freePlan && (
                <a
                  href="/quiz"
                  style={{
                    flex: '0 0 auto',
                    background: COLORS.paperAlt,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.inkMuted,
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                  }}
                >
                  {t.plans.freeChipLabel}
                </a>
              )}
            </div>
          )}

          {otherAvailablePlans.length > 0 && (
            <>
              <h2
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 15,
                  fontWeight: 700,
                  color: COLORS.ink,
                  margin: '0 0 12px',
                  paddingBottom: 6,
                  borderBottom: `2px solid ${COLORS.goldLight}`,
                }}
              >
                {t.plans.otherPlans}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {otherAvailablePlans.map((p) => {
                  const hasLaunch = p.launchPrice != null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSheet({ title: p.name, scopeTags: scopeTags(p), price: p, action: 'buy', planId: p.id })}
                      style={{
                        textAlign: 'left',
                        background: COLORS.paper,
                        border: `1px solid ${p.id === highlightPlanId ? COLORS.gold : COLORS.line}`,
                        borderRadius: 12,
                        padding: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 6, lineHeight: 1.25 }}>
                        {shortName(p.name)}
                      </div>
                      {hasLaunch ? (
                        <div>
                          <span style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 800, color: COLORS.gold }}>₹{p.launchPrice}</span>
                          <span style={{ fontSize: 11, color: COLORS.inkMuted, marginLeft: 4 }}>{t.plans.perYear}</span>
                          <div style={{ fontSize: 11, color: COLORS.inkMuted, textDecoration: 'line-through' }}>₹{p.regularPrice}</div>
                        </div>
                      ) : (
                        <span style={{ fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 800 }}>
                          ₹{p.regularPrice ?? '—'} <span style={{ fontSize: 11, fontWeight: 400 }}>{t.plans.perYear}</span>
                        </span>
                      )}
                      <div style={{ fontSize: 10, color: COLORS.gold, marginTop: 6, fontWeight: 600 }}>{t.plans.tapForDetails}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {error && <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {sheet && (
        <PlanSheet
          content={sheet}
          onClose={() => setSheet(null)}
          onBuy={buy}
          buying={sheet.planId === loadingPlan}
          buyLabel={sheet.planId ? buyButtonLabel(sheet.title) : ''}
        />
      )}
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
