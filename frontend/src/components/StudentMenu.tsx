'use client';

// Shared student navigation — a slide-out menu (☰) rather than a bottom tab
// bar, per the agreed design. Used on Home, Dashboard, and Profile pages.
//
// Final structure (finalized requirement): Home stands alone as its own
// top-level item (never under a "HOME" heading) — then three grouped
// sections (PREPARATION / ACCOUNT / SUPPORT) with their own small heading
// labels, then Logout standalone at the bottom. Labels drop the repeated
// "My" (My Progress -> Performance, My Plans -> Plan, My Devices ->
// Devices) and PREPARATION is a section heading, not itself a menu item
// (avoids "Practice" appearing as both a heading and a row under it).
//
// Live Exam and Daily Quiz are nav-only placeholders for now (finalized
// requirement — their detailed rules/functionality are a separate future
// task); each links to a small "coming soon" page rather than 404ing.
//
// Custom line icons in the gold/ink palette instead of emoji (which
// render inconsistently across phones and read as unpolished for an
// exam-prep brand), Bitter serif for the PONNA.in wordmark, and the
// shared paper/ink/gold color system.

import { useState } from 'react';
import { useLanguage } from '../lib/language-context';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../lib/brand-theme';
import {
  HomeIcon,
  PracticeIcon,
  LiveExamIcon,
  DailyQuizIcon,
  PlansIcon,
  ProgressIcon,
  ProfileIcon,
  DevicesIcon,
  AboutIcon,
  HelpIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  MistakesIcon,
  AskPonnaIcon,
} from './icons';

type NavItem = { href: string; label: string; Icon: (p: { size?: number; color?: string }) => React.ReactElement };

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

  // Logged-out visitors only see PUBLIC items (Home + Support) — the
  // PREPARATION/ACCOUNT sections all require a session (they'd otherwise
  // just bounce back here on a 401), and there is nothing to Logout of.
  // Logging in itself happens from the page's own header "Login" button.
  const sections: { heading: string; items: NavItem[] }[] = isLoggedIn
    ? [
        {
          heading: t.menu.sectionPreparation,
          items: [
            { href: '/ask-ponna', label: t.menu.askPonna, Icon: AskPonnaIcon },
            { href: '/quiz', label: t.menu.practice, Icon: PracticeIcon },
            { href: '/mistakes', label: t.menu.reviewMistakes, Icon: MistakesIcon },
            { href: '/live-exam', label: t.menu.liveExam, Icon: LiveExamIcon },
            { href: '/daily-quiz', label: t.menu.dailyQuiz, Icon: DailyQuizIcon },
            { href: '/dashboard', label: t.menu.dashboard, Icon: ProgressIcon },
          ],
        },
        {
          heading: t.menu.sectionAccount,
          items: [
            { href: '/profile', label: t.menu.profile, Icon: ProfileIcon },
            { href: '/plans', label: t.menu.plans, Icon: PlansIcon },
            { href: '/devices', label: t.menu.devices, Icon: DevicesIcon },
          ],
        },
        {
          heading: t.menu.sectionSupport,
          items: [
            { href: '/about', label: t.menu.about, Icon: AboutIcon },
            { href: '/help', label: t.menu.help, Icon: HelpIcon },
          ],
        },
      ]
    : [
        {
          heading: t.menu.sectionSupport,
          items: [
            { href: '/about', label: t.menu.about, Icon: AboutIcon },
            { href: '/help', label: t.menu.help, Icon: HelpIcon },
          ],
        },
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
              width: 258,
              background: COLORS.paper,
              boxShadow: '2px 0 16px rgba(0,0,0,0.15)',
              padding: '20px 18px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <strong style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 700, color: COLORS.ink }}>PONNA.in</strong>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <CloseIcon size={18} color={COLORS.inkMuted} />
              </button>
            </div>

            {/* Home — always its own standalone top-level item, never under a heading. */}
            <a
              href="/"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', color: COLORS.ink, textDecoration: 'none', fontSize: 15, borderRadius: 8, fontWeight: 600 }}
            >
              <HomeIcon size={19} color={COLORS.gold} /> {t.menu.home}
            </a>

            {sections.map((section) => (
              <div key={section.heading} style={{ marginTop: 14 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.inkMuted, letterSpacing: 0.8, margin: '0 6px 4px' }}>{section.heading}</p>
                {section.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', color: COLORS.ink, textDecoration: 'none', fontSize: 14.5, borderRadius: 8 }}
                  >
                    <item.Icon size={18} color={COLORS.gold} /> {item.label}
                  </a>
                ))}
              </div>
            ))}

            {isLoggedIn && (
              <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 16, paddingTop: 12 }}>
                <button
                  onClick={logout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 6px',
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
