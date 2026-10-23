import type { Metadata } from 'next';

// Private page: reached only with a code/link we hand out. Keep it out of search.
export const metadata: Metadata = { title: 'Coupon | PONNA.in', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
