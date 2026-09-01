'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

// My Plans — the student-facing half of the Annual Plan payment loop.
// Shows the student's currently-Active Plans (with expiry + Practice Now)
// separately from Other Available Plans they could still buy. Purchasing
// one Plan never affects any other — each is an independent Subscription
// (finalized requirement).
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

type Plan = {
  id: string;
  name: string;
  regularPrice: string | null;
  launchPrice: string | null;
  active: boolean;
  isFree: boolean;
  purpose: { name: string; authorities: { name: string }[] } | null;
  authorityScopes: { authority: { name: string; categories: { name: string }[] } }[];
};

type ActiveSubscription = {
  id: string;
  planId: string;
  cycleEnd: string;
  plan: { id: string; name: string; nameTa: string | null };
};

export default function PlansPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading…</main>}>
      <PlansPageInner />
    </Suspense>
  );
}

function PlansPageInner() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const highlightPlanId = searchParams.get('highlight');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeSubs, setActiveSubs] = useState<ActiveSubscription[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          // Server-side gate (not just a UI nicety) — see payment.service.ts.
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
          // Payment succeeded from the checkout widget's perspective — but the
          // Subscription is only created once Razorpay's webhook lands on the
          // backend (usually within seconds). Sending them back here (rather
          // than /home) means they land right where their new Active Plan
          // will appear once it's confirmed.
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

  function scopeTags(p: Plan): string[] {
    // Whole-Purpose plan (Competitive/Employment) — list the real
    // Authorities under it, straight from data, never hardcoded.
    if (p.purpose) return p.purpose.authorities.map((a) => a.name);

    if (p.authorityScopes.length > 1) {
      // Multi-authority plan (JEE) — the authorities themselves ARE the
      // description (JEE Main + JEE Advanced).
      return p.authorityScopes.map((s) => s.authority.name);
    }
    if (p.authorityScopes.length === 1) {
      const authority = p.authorityScopes[0].authority;
      // Single-authority plan WITH known Categories (NEET → subjects,
      // TNTET → papers) — describe by those; otherwise (no categories
      // seeded yet for this exam) just the exam name itself (CLAT, BITSAT...).
      if (authority.categories.length > 0) return authority.categories.map((c) => c.name);
      return [authority.name];
    }
    return [];
  }

  /** "NEET Annual Plan" -> "Get NEET Plan" / "NEET திட்டம் வாங்கவும்" — built
   * from the Plan's own name (data), never a hardcoded per-plan mapping. */
  function buyButtonLabel(p: Plan): string {
    const shortName = p.name.replace(/ Annual Plan$/i, '').trim();
    return lang === 'ta' ? `${shortName} திட்டம் வாங்கவும்` : `Get ${shortName} Plan`;
  }

  const activePlanIds = new Set(activeSubs.map((s) => s.planId));
  const freePlan = plans.find((p) => p.isFree);
  const otherAvailablePlans = plans.filter((p) => !p.isFree && p.active && !activePlanIds.has(p.id));

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.plans.myPlansTitle}</h1>
      </div>

      {!plansLoaded && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>Loading…</p>}

      {plansLoaded && (
        <>
          {/* Free — always available, never a Buy button, and never listed
              among "Active Plans" (it isn't a purchase). Quiet treatment —
              paper-toned, no badge, since there's nothing to celebrate or sell. */}
          {freePlan && (
            <PlanCard
              title={freePlan.name}
              description={t.plans.freeDesc}
              tone="quiet"
              action={<GhostButton href="/quiz">{t.plans.practiceNow}</GhostButton>}
            />
          )}

          {activeSubs.length > 0 && (
            <>
              <SectionHeading>{t.plans.activePlans}</SectionHeading>
              {activeSubs.map((s) => (
                <PlanCard
                  key={s.id}
                  title={s.plan.name}
                  description={`${t.plans.activeUntil}: ${new Date(s.cycleEnd).toLocaleDateString()}`}
                  tone="active"
                  action={<GhostButton href="/quiz">{t.plans.practiceNow}</GhostButton>}
                />
              ))}
            </>
          )}

          {otherAvailablePlans.length > 0 && (
            <>
              <SectionHeading>{t.plans.otherPlans}</SectionHeading>
              {otherAvailablePlans.map((p) => (
                <PlanCard
                  key={p.id}
                  title={p.name}
                  scopeTags={scopeTags(p)}
                  price={p}
                  tone="available"
                  highlighted={p.id === highlightPlanId}
                  action={
                    <button
                      onClick={() => buy(p.id)}
                      disabled={loadingPlan === p.id}
                      style={{ width: '100%', padding: 13, borderRadius: 8, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >
                      {loadingPlan === p.id ? '…' : buyButtonLabel(p)}
                    </button>
                  }
                />
              ))}
            </>
          )}
        </>
      )}

      {error && <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '28px 0 12px', paddingBottom: 6, borderBottom: `2px solid ${COLORS.goldLight}` }}>
      {children}
    </h2>
  );
}

function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        padding: 12,
        borderRadius: 8,
        background: COLORS.paperAlt,
        color: COLORS.ink,
        border: `1px solid ${COLORS.line}`,
        fontWeight: 600,
        fontSize: 14,
        textAlign: 'center',
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}

function ScopeTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.inkMuted,
            background: COLORS.paperAlt,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 20,
            padding: '3px 10px',
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function PlanCard({
  title,
  description,
  scopeTags: tags,
  price,
  action,
  highlighted,
  tone,
}: {
  title: string;
  description?: string;
  scopeTags?: string[];
  price?: { regularPrice: string | null; launchPrice: string | null };
  action?: React.ReactNode;
  highlighted?: boolean;
  tone: 'quiet' | 'active' | 'available';
}) {
  const { t } = useLanguage();
  const hasLaunchPrice = price?.launchPrice != null;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);

  // Active Plans get the gold treatment — this is the one place the
  // brand's signature color says "this belongs to you". Available (buy)
  // cards stay quiet by default and only pick up gold when deep-linked
  // here (Get Annual Plan from the Free-fallback prompt).
  const isGold = tone === 'active' || highlighted;

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        border: isGold ? `1.5px solid ${COLORS.gold}` : `1px solid ${COLORS.line}`,
        boxShadow: highlighted ? `0 0 0 3px ${COLORS.goldLight}` : 'none',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: tone === 'active' ? COLORS.goldLight : tone === 'quiet' ? 'transparent' : COLORS.paper,
      }}
    >
      {tone === 'active' && (
        <span
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: COLORS.paper,
            background: COLORS.gold,
            borderRadius: 20,
            padding: '3px 9px',
          }}
        >
          ACTIVE
        </span>
      )}

      <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 700, marginBottom: tags?.length ? 8 : 4, color: COLORS.ink, paddingRight: tone === 'active' ? 60 : 0 }}>
        {title}
      </h3>

      {tags && <ScopeTags tags={tags} />}

      {price && (
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          {hasLaunchPrice ? (
            <>
              <span style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, color: COLORS.gold }}>
                ₹{price.launchPrice}
              </span>
              <span style={{ fontSize: 13, color: COLORS.inkMuted }}>{t.plans.perYear}</span>
              <span style={{ fontSize: 13, color: COLORS.inkMuted, textDecoration: 'line-through' }}>₹{price.regularPrice}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7A5A14', background: COLORS.goldLight, padding: '2px 8px', borderRadius: 4 }}>
                {t.plans.launchPrice}
              </span>
            </>
          ) : (
            <span style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 800 }}>
              ₹{price.regularPrice ?? '—'} <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 400 }}>{t.plans.perYear}</span>
            </span>
          )}
        </div>
      )}

      {description && <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: action ? 12 : 0 }}>{description}</p>}
      {action}
    </div>
  );
}
