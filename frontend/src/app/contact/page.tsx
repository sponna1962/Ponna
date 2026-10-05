import type { Metadata } from 'next';
import { PolicyPage, H } from '../../components/PolicyPage';

export const metadata: Metadata = {
  title: 'Contact Us | PONNA.in',
  description: 'Contact details for PONNA.in support.',
  alternates: { canonical: '/contact' },
};

export default function Page() {
  return (
    <PolicyPage title="Contact Us" updated="5 October 2026">

      <p>We are happy to help with your account, payments and questions about PONNA.in.</p>
      <H>Email</H>
      <p><a href="mailto:ponna@arlena.in">ponna@arlena.in</a></p>
      <H>Phone / WhatsApp</H>
      <p>+91 99653 99896</p>
      <H>Business</H>
      <p>PONNA.in, a brand of ARLENA (OPC) PRIVATE LIMITED<br />CIN: U63122TN2026OPC197880</p>
      <p>We reply within 2 working days. For payment issues please include your registered email address and payment reference.</p>
    </PolicyPage>
  );
}
