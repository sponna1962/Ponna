'use client';

// Shared student navigation — a slide-out menu (☰) rather than a bottom tab
// bar, per the agreed design. Used on Home, Dashboard, and Profile pages.
// "Practice" here and the "Start today's quiz" button on Home both lead to
// the same /quiz page — no duplicate flow.
//
// Redesigned to match the site's brand identity (finalized requirement —
// "professional, not low quality"): custom line icons in the gold/ink
// palette instead of emoji (which render inconsistently across phones and
// read as unpolished for an exam-prep brand), Bitter serif for the
// PONNA.in wordmark, and the shared paper/ink/gold color system.

import { useState } from 'react';
import { useLanguage } from '../lib/language-context';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../lib/brand-theme';
import {
  HomeIcon,
  PracticeIcon,
  PlansIcon,
  ProgressIcon,
  ProfileIcon,
  DevicesIcon,
  AboutIcon,
  HelpIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from './icons';

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
        { href: '/', label: t.menu.home, Icon: HomeIcon },
        { href: '/quiz', label: t.menu.practice, Icon: PracticeIcon },
        { href: '/plans', label: t.menu.plans, Icon: PlansIcon },
        { href: '/dashboard', label: t.menu.dashboard, Icon: ProgressIcon },
        { href: '/profile', label: t.menu.profile, Icon: ProfileIcon },
        { href: '/devices', label: t.menu.devices, Icon: DevicesIcon },
        { href: '/about', label: t.menu.about, Icon: AboutIcon },
        { href: '/help', label: t.menu.help, Icon: HelpIcon },
      ]
    : [
        { href: '/', label: t.menu.home, Icon: HomeIcon },
        { href: '/about', label: t.menu.about, Icon: AboutIcon },
        { href: '/help', label: t.menu.help, Icon: HelpIcon },
      ];

  return (
    <>
      <BitterFontLinks />
      <button
        onClick={openMenu}
        aria-label="Menu"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex' }}
      >
        <MenuIcon size={22} color={COLORS.ink} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,34,56,0.45)', zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 250,
              background: COLORS.paper,
              boxShadow: '2px 0 16px rgba(0,0,0,0.15)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <strong style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 700, color: COLORS.ink }}>PONNA.in</strong>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <CloseIcon size={18} color={COLORS.inkMuted} />
              </button>
            </div>

            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 6px',
                  color: COLORS.ink,
                  textDecoration: 'none',
                  fontSize: 15,
                  borderRadius: 8,
                }}
              >
                <item.Icon size={19} color={COLORS.gold} /> {item.label}
              </a>
            ))}

            {isLoggedIn && (
              <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 12, paddingTop: 12 }}>
                <button
                  onClick={logout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 6px',
                    background: 'none',
                    border: 'none',
                    color: '#B4544A',
                    fontSize: 15,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 8,
                  }}
                >
                  <LogoutIcon size={19} color="#B4544A" /> {t.menu.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
