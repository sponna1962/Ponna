import type { Metadata } from 'next';
import { PolicyPage, H } from '../../components/PolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | PONNA.in',
  description: 'How PONNA.in collects and uses your information.',
  alternates: { canonical: '/privacy' },
};

export default function Page() {
  return (
    <PolicyPage title="Privacy Policy" updated="5 October 2026">

      <p>ARLENA (OPC) PRIVATE LIMITED operates PONNA.in. This policy explains what we collect and why.</p>
      <H>What we collect</H>
      <p>Your name, email address and login details; your practice activity (answers, scores, progress); basic device and usage information; and payment status from our payment gateway. We do not see or store your card or bank details.</p>
      <H>How we use it</H>
      <p>To run your account, show your progress and analysis, activate your plan, provide support, keep the Service secure, and improve it. We may measure advertising performance using tools such as the Meta Pixel.</p>
      <H>Sharing</H>
      <p>We do not sell your personal data. We share it only with service providers needed to run PONNA.in (hosting, payment processing, analytics) or when required by law.</p>
      <H>Your choices</H>
      <p>You can ask us to correct or delete your account data by emailing <a href="mailto:ponna@arlena.in">ponna@arlena.in</a>.</p>
      <H>Security</H>
      <p>We use reasonable safeguards, but no online service is completely secure.</p>
    </PolicyPage>
  );
}
