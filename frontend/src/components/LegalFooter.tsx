// Legal/company-identity footer (Sept 2026 — explicit request for Meta
// Business Verification). Meta's verification crawler needs the legal
// entity name visible on the website; the PONNA brand/domain/logo stay
// exactly as they are — this is additive, not a rebrand. Kept minimal and
// unobtrusive (small text, bottom of page) so it doesn't disrupt the
// mobile-app-style layout of any existing screen.
export function LegalFooter() {
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
