'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';

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

  function describeScope(p: Plan): string {
    // Whole-Purpose plan (Competitive/Employment) — list the real
    // Authorities under it, straight from data, never hardcoded.
    if (p.purpose) return p.purpose.authorities.map((a) => a.name).join(', ');

    if (p.authorityScopes.length > 1) {
      // Multi-authority plan (JEE) — the authorities themselves ARE the
      // description (JEE Main + JEE Advanced).
      return p.authorityScopes.map((s) => s.authority.name).join(' + ');
    }
    if (p.authorityScopes.length === 1) {
      const authority = p.authorityScopes[0].authority;
      // Single-authority plan WITH known Categories (NEET → subjects,
      // TNTET → papers) — describe by those; otherwise (no categories
      // seeded yet for this exam) just the exam name itself (CLAT, BITSAT...).
      if (authority.categories.length > 0) return authority.categories.map((c) => c.name).join(' + ');
      return authority.name;
    }
    return '';
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
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.plans.myPlansTitle}</h1>
      </div>

      {!plansLoaded && <p style={{ color: '#64748b', fontSize: 13 }}>Loading…</p>}

      {plansLoaded && (
        <>
          {/* Free — always available, never a Buy button, and never listed
              among "Active Plans" (it isn't a purchase). */}
          {freePlan && (
            <PlanCard title={freePlan.name} description={t.plans.freeDesc} action={<GhostButton href="/quiz">{t.plans.practiceNow}</GhostButton>} />
          )}

          {activeSubs.length > 0 && (
            <>
              <SectionHeading>{t.plans.activePlans}</SectionHeading>
              {activeSubs.map((s) => (
                <PlanCard
                  key={s.id}
                  title={s.plan.name}
                  description={`${t.plans.activeUntil}: ${new Date(s.cycleEnd).toLocaleDateString()}`}
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
                  description={describeScope(p)}
                  price={p}
                  highlighted={p.id === highlightPlanId}
                  action={
                    <button
                      onClick={() => buy(p.id)}
                      disabled={loadingPlan === p.id}
                      style={{ width: '100%', padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600 }}
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

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 14, color: '#475569', margin: '20px 0 8px' }}>{children}</h2>;
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
        background: '#f1f5f9',
        color: '#0f172a',
        border: '1px solid #cbd5e1',
        fontWeight: 600,
        textAlign: 'center',
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}

function PlanCard({
  title,
  description,
  price,
  action,
  highlighted,
}: {
  title: string;
  description: string;
  price?: { regularPrice: string | null; launchPrice: string | null };
  action?: React.ReactNode;
  highlighted?: boolean;
}) {
  const { t } = useLanguage();
  const hasLaunchPrice = price?.launchPrice != null;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);

  return (
    <div
      ref={ref}
      style={{
        border: highlighted ? '2px solid #0f172a' : '1px solid #e2e8f0',
        boxShadow: highlighted ? '0 0 0 3px #e0e7ff' : 'none',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>{title}</h3>

      {price && (
        <div style={{ marginBottom: 8 }}>
          {hasLaunchPrice ? (
            <>
              <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through', marginRight: 8 }}>
                ₹{price.regularPrice} {t.plans.perYear}
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
                ₹{price.launchPrice} {t.plans.perYear}
              </span>
              <span style={{ fontSize: 11, color: '#16a34a', marginLeft: 6, background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
                {t.plans.launchPrice}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              ₹{price.regularPrice ?? '—'} {t.plans.perYear}
            </span>
          )}
        </div>
      )}

      <p style={{ fontSize: 13, color: '#64748b', marginBottom: action ? 12 : 0 }}>{description}</p>
      {action}
    </div>
  );
}
