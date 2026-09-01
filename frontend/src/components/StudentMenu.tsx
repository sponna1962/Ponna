'use client';

// Shared student navigation — a slide-out menu (☰) rather than a bottom tab
// bar, per the agreed design. Used on Home, Dashboard, and Profile pages.
// "Practice" here and the "Start today's quiz" button on Home both lead to
// the same /quiz page — no duplicate flow.

import { useState } from 'react';
import { useLanguage } from '../lib/language-context';

export function StudentMenu() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  // Re-checked fresh every time the menu opens (not once on mount) — this
  // component stays mounted across a login that happens without a full
  // page reload (the unified "/" page just flips its own React state), so
  // a mount-only check would keep showing "logged out" forever afterward.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  function openMenu() {
    setIsLoggedIn(typeof window !== 'undefined' && !!localStorage.getItem('ponna_student_token'));
    setOpen(true);
  }

  function logout() {
    localStorage.removeItem('ponna_student_token');
    window.location.href = '/';
  }

  // Logged-out visitors only see PUBLIC items — My Plans/My Progress/Profile
  // all require a session (they'd otherwise just bounce back here on a 401),
  // and there is nothing to Logout of. Logging in itself happens from the
  // page's own header "Login" button, not from this menu.
  const items = isLoggedIn
    ? [
        { href: '/', label: t.menu.home, icon: '🏠' },
        { href: '/quiz', label: t.menu.practice, icon: '📝' },
        { href: '/plans', label: t.menu.plans, icon: '💳' },
        { href: '/dashboard', label: t.menu.dashboard, icon: '📊' },
        { href: '/profile', label: t.menu.profile, icon: '👤' },
        { href: '/help', label: t.menu.help, icon: '❓' },
      ]
    : [
        { href: '/', label: t.menu.home, icon: '🏠' },
        { href: '/help', label: t.menu.help, icon: '❓' },
      ];

  return (
    <>
      <button
        onClick={openMenu}
        aria-label="Menu"
        style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: 4, lineHeight: 1 }}
      >
        ☰
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 240,
              background: '#fff',
              boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <strong style={{ fontSize: 16 }}>PONNA.in</strong>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 4px',
                  color: '#1e293b',
                  textDecoration: 'none',
                  fontSize: 15,
                }}
              >
                <span>{item.icon}</span> {item.label}
              </a>
            ))}

            {isLoggedIn && (
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 12, paddingTop: 12 }}>
                <button
                  onClick={logout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 4px',
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: 15,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  🚪 {t.menu.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
