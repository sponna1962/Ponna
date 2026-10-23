import { redirect } from 'next/navigation';

// The coupon box now lives on the Plans page. Old /coupon?code=... links still work.
export default function Page({ searchParams }: { searchParams: { code?: string } }) {
  const code = (searchParams?.code ?? '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 30);
  redirect(code ? `/plans?coupon=${encodeURIComponent(code)}` : '/plans');
}
