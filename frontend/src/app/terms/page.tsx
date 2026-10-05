import type { Metadata } from 'next';
import { PolicyPage, H } from '../../components/PolicyPage';

export const metadata: Metadata = {
  title: 'Terms and Conditions | PONNA.in',
  description: 'Terms and conditions for using PONNA.in exam practice platform.',
  alternates: { canonical: '/terms' },
};

export default function Page() {
  return (
    <PolicyPage title="Terms and Conditions" updated="5 October 2026">

      <p>These terms apply to your use of PONNA.in (the "Service"), operated by ARLENA (OPC) PRIVATE LIMITED ("we", "us"). By creating an account or buying a plan you agree to them.</p>
      <H>1. The Service</H>
      <p>PONNA.in is an online practice platform for TNPSC, TNTET and similar competitive examinations. It offers practice questions, mock tests, study notes, current affairs and performance analysis. It is an educational aid and does not guarantee success in any examination.</p>
      <H>2. Accounts</H>
      <p>You are responsible for the accuracy of your account details and for keeping your login secure. A paid plan is for one person and may not be shared or resold.</p>
      <H>3. Plans and payment</H>
      <p>Paid plans give access to the listed features until the validity date shown on the Plans page. Prices are in Indian Rupees and are shown before you pay. Payments are processed by third-party payment gateways; we do not store your card or bank details.</p>
      <H>4. Acceptable use</H>
      <p>You agree not to copy, scrape, redistribute or resell our questions, notes or other content, and not to disrupt or attempt unauthorised access to the Service. We may suspend accounts that break these terms.</p>
      <H>5. Content</H>
      <p>We work to keep questions and answers accurate, but errors can occur. Please use the report option in the app to tell us about any mistake. All content on PONNA.in belongs to us or our licensors.</p>
      <H>6. Refunds</H>
      <p>See our <a href="/refund-policy">Refund and Cancellation Policy</a>.</p>
      <H>7. Liability</H>
      <p>The Service is provided "as is". To the extent permitted by law, our liability is limited to the amount you paid for your current plan.</p>
      <H>8. Changes and governing law</H>
      <p>We may update these terms; the latest version is always on this page. These terms are governed by the laws of India, and courts in Tamil Nadu have jurisdiction.</p>
      <H>9. Contact</H>
      <p>See our <a href="/contact">Contact page</a>.</p>
    </PolicyPage>
  );
}
