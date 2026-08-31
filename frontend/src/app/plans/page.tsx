'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { LanguageToggle } from '../../components/LanguageToggle';
import { StudentMenu } from '../../components/StudentMenu';

// Plan purchase page — the student-facing half of the payment loop. Calls
// POST /payments/create-order with a planId to get a Razorpay order, then
// opens Razorpay's checkout widget. The Subscription itself is NOT created
// here — that only happens when Razorpay's webhook confirms payment (see
// payment.service.ts) — this page just initiates the payment.
//
// Plans are dynamic now (Annual Plan redesign) — fetched from the backend,
// not hardcoded. This is a functional placeholder pulling live Plan data;
// the full card-based layout (Competitive/NEET/JEE/... with launch pricing,
// "Choose Your Exams" flow) is Phase 3+.

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
};

export default function PlansPage() {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentFetch('/plans')
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <h1 style={{ fontSize: 20, margin: 0 }}>{t.plans.title}</h1>
        </div>
        <LanguageToggle />
      </div>

      {plans.filter((p) => p.isFree).map((p) => (
        <PlanCard key={p.id} title={p.name} description={t.plans.freeDesc} />
      ))}

      {plans.filter((p) => !p.isFree && p.active).map((p) => {
        const price = p.launchPrice ?? p.regularPrice;
        return (
          <PlanCard
            key={p.id}
            title={p.name}
            description={price ? `₹${price} / year` : ''}
            action={
              <button
                onClick={() => buy(p.id)}
                disabled={loadingPlan === p.id}
                style={{ width: '100%', padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600 }}
              >
                {loadingPlan === p.id ? '…' : t.plans.buy}
              </button>
            }
          />
        );
      })}

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
