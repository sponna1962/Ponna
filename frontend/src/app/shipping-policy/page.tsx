import type { Metadata } from 'next';
import { PolicyPage, H } from '../../components/PolicyPage';

export const metadata: Metadata = {
  title: 'Shipping and Delivery Policy | PONNA.in',
  description: 'Delivery policy for PONNA.in digital plans.',
  alternates: { canonical: '/shipping-policy' },
};

export default function Page() {
  return (
    <PolicyPage title="Shipping and Delivery Policy" updated="5 October 2026">

      <p>PONNA.in sells only digital services. No physical goods are shipped.</p>
      <H>Delivery</H>
      <p>After a successful payment, your plan is activated on your PONNA.in account automatically, usually within a few minutes. You can use it from any phone, tablet or computer by logging in.</p>
      <H>Delay</H>
      <p>If your plan is not active within 30 minutes of payment, email <a href="mailto:ponna@arlena.in">ponna@arlena.in</a> with your registered email address and payment reference, and we will resolve it promptly. See also our <a href="/refund-policy">Refund Policy</a>.</p>
    </PolicyPage>
  );
}
