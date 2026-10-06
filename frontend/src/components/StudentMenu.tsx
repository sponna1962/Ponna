'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useLanguage } from '../lib/language-context';
import { studentFetch } from '../lib/student-fetch';
import { COLORS, BitterFontLinks } from '../lib/brand-theme';
import { HERO_ART_SVG } from '../app/test-your-ability/hero-art';
import {
  HomeIcon,
  PracticeIcon,
  LiveExamIcon,
  DailyQuizIcon,
  PlansIcon,
  ProgressIcon,
  AboutIcon,
  HelpIcon,
  MenuIcon,
  CloseIcon,
  MistakesIcon,
  AskPonnaIcon,
  CutoffPredictorIcon,
  StudyNotesIcon,
} from './icons';

type NavItem = { href: string; label: string; locked?: boolean; Icon: (p: { size?: number; color?: string }) => React.ReactElement };

export function StudentMenu({ onOpenChange, iconColor }: { onOpenChange?: (open: boolean) => void; iconColor?: string }) {
  const { t } = useLanguage();
  const [open, setOpenState] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // null = not known yet (nothing shown, avoids a flash of the big Pass button)
  const [hasPass, setHasPass] = useState<boolean | null>(null);

  function setOpen(value: boolean) {
    setOpenState(value);
    onOpenChange?.(value);
  }

  function openMenu() {
    const loggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ponna_student_token');
    setIsLoggedIn(loggedIn);
    setOpen(true);
    if (loggedIn) {
      studentFetch('/students/me/subscriptions')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setHasPass(Array.isArray(d) ? d.length > 0 : false))
        .catch(() => setHasPass(false));
    }
  }

  const preparationItems: NavItem[] = [
    { href: '/quiz', label: t.menu.practice, Icon: PracticeIcon },
    { href: '/ask-ponna', label: t.menu.askPonna, Icon: AskPonnaIcon },
    { href: '/mistakes', label: t.menu.reviewMistakes, Icon: MistakesIcon },
    { href: '/study-notes', label: t.menu.studyNotes, Icon: StudyNotesIcon },
    { href: '/daily-quiz', label: t.menu.dailyQuiz, Icon: DailyQuizIcon },
    { href: '/live-exam', label: t.menu.liveExam, Icon: LiveExamIcon },
    { href: '/adaptive-mock', label: t.menu.adaptiveMock, Icon: PracticeIcon },
    { href: '/dashboard', label: t.menu.dashboard, Icon: ProgressIcon },
    { href: '/cutoff-predictor', label: t.menu.cutoffPredictor, Icon: CutoffPredictorIcon },
  ];
  // Oct 2026 — logged-out visitors see every feature too (shown with a lock);
  // tapping one opens the Login / Sign up flow instead of a protected page.
  const sections: { heading: string; items: NavItem[] }[] = [
    {
      heading: t.menu.sectionPreparation,
      items: isLoggedIn ? preparationItems : preparationItems.map((i) => ({ ...i, href: '/?startLogin=1', locked: true })),
    },
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
      <button onClick={openMenu} aria-label="Menu" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex' }}>
        <MenuIcon size={22} color={iconColor ?? COLORS.ink} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,47,51,0.5)', zIndex: 999 }}>
          {/* Oct 2026 redesign: teal header band, gold icon discs, current-page highlight,
              gold Pass button + thin sunrise strip pinned at the bottom. Same links/labels. */}
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(78vw, 320px)', background: COLORS.paper, boxShadow: '8px 0 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(180deg,#0c2f3f,#1c6b6b)', padding: '16px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #E2B04A', flex: 'none' }}>
              <div style={{ background: '#fefefe', borderRadius: 8, padding: '4px 10px', display: 'flex' }}>
                <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} style={{ height: 32, width: 'auto' }} />
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <CloseIcon size={16} color="#fff" />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 10px' }}>
              {[
                { href: '/', label: t.menu.home, Icon: HomeIcon, bold: true },
                { href: '/current-affairs', label: 'Current Affairs', Icon: StudyNotesIcon, bold: true },
              ].map((item) => (
                <MenuRow key={item.href} href={item.href} label={item.label} Icon={item.Icon} bold={item.bold} />
              ))}
              {sections.map((section) => (
                <div key={section.heading}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 700, color: 'var(--color-teal)', letterSpacing: 1.6, margin: '10px 12px 2px' }}>
                    {section.heading}
                    <span style={{ flex: 1, borderTop: '1.5px solid var(--color-line)' }} />
                  </p>
                  {section.items.map((item) => (
                    <MenuRow key={item.label} href={item.href} label={item.label} Icon={item.Icon} locked={item.locked} />
                  ))}
                </div>
              ))}
              <div style={{ margin: '14px 12px 4px', paddingTop: 10, borderTop: '1px solid ' + COLORS.line, fontSize: 11.5, color: COLORS.inkMuted, lineHeight: 1.9 }}>
                {[['Terms', '/terms'], ['Privacy', '/privacy'], ['Refund', '/refund-policy'], ['Delivery', '/shipping-policy'], ['Contact', '/contact']].map(([label, href]) => (
                  <a key={href} href={href} style={{ color: 'inherit', textDecoration: 'underline', marginRight: 10 }}>{label}</a>
                ))}
                <br />ARLENA (OPC) PRIVATE LIMITED
              </div>
            </div>

            <div style={{ flex: 'none', background: COLORS.paper }}>
              {!isLoggedIn && (
                <div style={{ padding: '8px 16px 12px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12.5, color: COLORS.inkMuted, textAlign: 'center' }}>Login செய்தால் எல்லா வசதிகளும் திறக்கும்</p>
                  <a href="/?startLogin=1" style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 14, background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>Login / Sign up</a>
                </div>
              )}
              {isLoggedIn && hasPass === false && (
                <a href="/plans" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 14px 10px', padding: '10px 14px', borderRadius: 14, background: 'linear-gradient(135deg,#F3C65A,#D99A1E)', color: '#2b1c00', textDecoration: 'none', boxShadow: '0 8px 18px -10px rgba(176,122,16,0.8)' }}>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlansIcon size={20} color="#2b1c00" />
                  </span>
                  <b style={{ fontSize: 17 }}>{t.menu.plans}</b>
                  <span style={{ marginLeft: 'auto', fontSize: 24, lineHeight: 1 }}>›</span>
                </a>
              )}
              {isLoggedIn && hasPass === true && (
                <a href="/plans" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 16px 8px', padding: '7px 12px', borderRadius: 999, border: '1.5px solid #E2B04A', background: COLORS.goldLight, color: COLORS.ink, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ color: 'var(--color-ok)', fontWeight: 800 }}>✓</span> {t.menu.plans} · Active
                  <span style={{ marginLeft: 'auto', fontSize: 18, lineHeight: 1 }}>›</span>
                </a>
              )}
              <div aria-hidden="true" style={{ position: 'relative', height: 38, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: HERO_ART_SVG }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function MenuRow({ href, label, Icon, bold, locked }: { href: string; label: string; Icon: NavItem['Icon']; bold?: boolean; locked?: boolean }) {
  const active = !locked && typeof window !== 'undefined' && window.location.pathname === href;
  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '4px 12px', borderRadius: 12, textDecoration: 'none',
        color: 'var(--color-ink)', fontSize: 16, fontWeight: active || bold ? 700 : 500,
        background: active ? 'var(--color-card)' : 'transparent',
        boxShadow: active ? 'inset 4px 0 0 #E2B04A, 0 1px 0 var(--color-line)' : 'none',
      }}
    >
      <span style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--color-btn)' : 'var(--color-goldDisc)' }}>
        <Icon size={18} color={active ? 'var(--color-btnText)' : 'var(--color-gold)'} />
      </span>
      {label}
      {locked && <span aria-label="Login required" style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.55 }}>🔒</span>}
    </a>
  );
}
