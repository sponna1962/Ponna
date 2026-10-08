import type { Metadata } from 'next';
import { PolicyPage, H } from '../../components/PolicyPage';

export const metadata: Metadata = {
  title: 'Refund and Cancellation Policy | PONNA.in',
  description: 'Refund and cancellation policy for PONNA.in plans.',
  alternates: { canonical: '/refund-policy' },
};

export default function Page() {
  return (
    <PolicyPage title="Refund and Cancellation Policy" updated="8 October 2026">

      <p>PONNA.in plans are digital subscriptions; access starts as soon as payment succeeds.</p>
      <H>Cancellation</H>
      <p>You can stop using PONNA.in at any time. Plans do not auto-renew, so there is nothing to cancel and no further charge after your plan ends.</p>
      <H>Refund after you join a government job</H>
      <p>If you prepare with PONNA.in and join a government post, the full fee you paid for your PONNA.in plan(s) will be refunded to you.</p>
      <p>Condition: you must register your hall ticket number in your PONNA.in profile and have it verified by PONNA.in.</p>
      <H>Other refunds</H>
      <p>Because access is delivered instantly, payments for activated plans are otherwise generally non-refundable. We will also refund you in these cases:</p>
      <ul>
        <li>You were charged more than once for the same plan.</li>
        <li>Payment was deducted but the plan was not activated, and we cannot activate it.</li>
        <li>A technical fault on our side prevented you from using the plan, and we could not fix it.</li>
      </ul>
      <H>How to request a refund</H>
      <p>Email us at <a href="mailto:ponna@arlena.in">ponna@arlena.in</a> within 7 days of payment with your registered email address and the payment reference. We reply within 2 hours.</p>
      <H>Timeline</H>
      <p>Approved refunds are returned to the original payment method within 5–7 working days. Your bank may take additional time to show it.</p>
    </PolicyPage>
  );
}
