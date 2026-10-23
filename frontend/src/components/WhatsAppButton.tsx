'use client';

// Floating "ask us on WhatsApp" button (Oct 2026). Opens a chat with the
// PONNA WhatsApp Business number with a ready-typed first message. The
// visitor sends that message themselves, which (a) lets our fixed-text
// auto-reply menu answer at once and (b) counts as their opt-in.
// Hidden on admin and while a student is taking a test, so it never
// distracts from practice.

import { usePathname } from 'next/navigation';

const WA_NUMBER = '919965399896'; // same number as the Contact page
const FIRST_MESSAGE = 'வணக்கம், PONNA.in பற்றி ஒரு சந்தேகம்';

const HIDDEN_PREFIXES = [
  '/admin', '/quiz', '/live-exam', '/free-practice', '/test-your-ability',
  '/mind-gym', '/diagnostic', '/offline-practice', '/trial', '/daily-quiz', '/login',
];

export function WhatsAppButton() {
  const pathname = usePathname() || '/';
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;

  const href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(FIRST_MESSAGE)}`;

  function track() {
    try {
      (window as any).fbq?.('track', 'Contact');
    } catch {
      /* tracking must never block the chat */
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={track}
      aria-label="WhatsApp-ல் கேளுங்கள்"
      style={{
        position: 'fixed',
        right: 14,
        bottom: 16,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        background: '#25D366',
        color: '#fff',
        textDecoration: 'none',
        borderRadius: '50%',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
        <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.12.55 4.18 1.6 6L4 29l8.14-1.56a12 12 0 0 0 3.9.65C22.68 28.1 28 22.7 28 16.06 28 9.4 22.68 3 16.04 3zm0 22.1c-1.2 0-2.38-.3-3.42-.9l-.5-.28-4.83.93.95-4.7-.3-.5a9.9 9.9 0 0 1-1.5-5.2c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10.65-9.4 10.65zm5.5-7.5c-.3-.15-1.8-.9-2.08-1-.28-.1-.48-.15-.68.15-.2.3-.78 1-.95 1.2-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.43-1.5-.9-.8-1.5-1.8-1.68-2.1-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.52-.07-.15-.68-1.64-.93-2.25-.25-.6-.5-.5-.68-.5h-.58c-.2 0-.52.08-.8.38-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.1 3.2 5.1 4.5.7.3 1.27.5 1.7.62.72.23 1.37.2 1.88.12.58-.08 1.8-.74 2.05-1.45.25-.7.25-1.3.18-1.45-.08-.13-.28-.2-.58-.35z" />
      </svg>
    </a>
  );
}
