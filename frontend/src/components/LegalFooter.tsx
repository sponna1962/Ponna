'use client';

import { usePathname } from 'next/navigation';

// Legal/company-identity footer (Sept 2026 — explicit request for Meta
// Business Verification). Meta's verification crawler needs the legal
// entity name visible on the website; the PONNA brand/domain/logo stay
// exactly as they are — this is additive, not a rebrand. Kept minimal and
// unobtrusive (small text, bottom of page) so it doesn't disrupt the
// mobile-app-style layout of any existing screen.
//
// Oct 2026 — hidden on the first-visit welcome screen only, by explicit
// request (nothing below its "Home-க்கு செல்ல" link). Every other page,
// including Home and the policy pages, still shows it.
const HIDDEN_ON = ['/test-your-ability'];

// Oct 2026 — full company block only where it matters (Home/login, Plans,
// About, Help and the policy pages themselves — enough for Meta/Razorpay
// verification); every other page gets one slim line of links. The same
// links also sit at the bottom of the side menu.
const FULL_ON = ['/', '/plans', '/about', '/help', '/terms', '/privacy', '/refund-policy', '/shipping-policy', '/contact'];

export function LegalFooter() {
  const pathname = usePathname();
  if (pathname && HIDDEN_ON.includes(pathname)) return null;
  const full = !!pathname && FULL_ON.includes(pathname.replace(/\/$/, '') || '/');
  if (!full) {
    return (
      <footer style={{ padding: '14px 20px 18px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
        <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/refund-policy">Refund</a> · <a href="/contact">Contact</a>
      </footer>
    );
  }
  return (
    // Sept 2026 — darkened from #94a3b8 (2.56:1 on a white/paper background)
    // to #64748b (4.76:1) to fix Lighthouse's contrast accessibility
    // failure on every page, since this footer renders site-wide.
    <footer style={{ padding: '18px 20px 24px', textAlign: 'center', fontSize: 11.5, color: '#64748b', lineHeight: 1.6 }}>
      <p style={{ margin: 0 }}>PONNA.in is a brand of ARLENA (OPC) PRIVATE LIMITED.</p>
      <p style={{ margin: '2px 0 0' }}>CIN: U63122TN2026OPC197880 · Director: HARSHA S S</p>
      <p style={{ margin: '6px 0 0' }}>
        <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/refund-policy">Refund Policy</a> · <a href="/shipping-policy">Delivery</a> · <a href="/contact">Contact</a>
      </p>
      <p style={{ margin: '2px 0 0' }}>© 2026 ARLENA (OPC) PRIVATE LIMITED. All rights reserved.</p>
    </footer>
  );
}
