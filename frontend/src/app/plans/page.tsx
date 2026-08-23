'use client';

import { useState } from 'react';
import Script from 'next/script';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { LanguageToggle } from '../../components/LanguageToggle';

// Plan purchase page — the student-facing half of the payment loop. Calls
// POST /payments/create-order to get a Razorpay order, then opens Razorpay's
// checkout widget. The Subscription itself is NOT created here — that only
// happens when Razorpay's webhook confirms payment (see payment.service.ts) —
// this page just initiates the payment and shows a "processing" state after.

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLANS = [
  { code: 'PLAN_20', name: 'Plan 20' },
  { code: 'PLAN_50', name: 'Plan 50' },
] as const;

export default function PlansPage() {
  const { t } = useLanguage();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(planCode: string) {
    setError(null);
    setLoadingPlan(planCode);

    try {
      const res = await studentFetch('/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode }),
      });
      if (!res.ok) {
        const body = await res.json();
        if (body.code === 'PROFILE_INCOMPLETE') {
          // Server-side gate (not just a UI nicety) — see payment.service.ts.
          // Redirect to the same Profile page used for the Rank gate, with
          // the same "?complete=1" flag so it shows the completion banner.
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
          // backend (usually within seconds). This just tells the student
          // what's happening rather than claiming the plan is active yet.
          window.location.href = '/home?payment=processing';
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

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.plans.title}</h1>
        <LanguageToggle />
      </div>

      <PlanCard title={t.plans.free} description={t.plans.freeDesc} />

      {PLANS.map((p) => (
        <PlanCard
          key={p.code}
          title={p.name}
          description={p.code === 'PLAN_20' ? t.plans.plan20Desc : t.plans.plan50Desc}
          action={
            <button
              onClick={() => buy(p.code)}
              disabled={loadingPlan === p.code}
              style={{ width: '100%', padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600 }}
            >
              {loadingPlan === p.code ? '…' : t.plans.buy}
            </button>
          }
        />
      ))}

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </main>
  );
}

function PlanCard({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: action ? 12 : 0 }}>{description}</p>
      {action}
    </div>
  );
}
