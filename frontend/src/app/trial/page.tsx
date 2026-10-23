import { redirect } from 'next/navigation';

// Oct 2026 — the ₹10 3-day trial was withdrawn. Old links and e-mails land on Plans.
export default function Page() {
  redirect('/plans');
}
