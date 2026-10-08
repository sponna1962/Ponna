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

  const sections: { heading: string; items: NavItem[] }[] = [
    {
      heading: t.menu.sectionPreparation,
      items: isLoggedIn ? preparationItems : preparationItems.map((i) => {
        if (i.href === '/study-notes') return i;
        if (i.href === '/ask-ponna') return i;
        if (i.href === '/quiz') return { ...i, href: '/?startLogin=1' };
        return { ...i, href: '/?startLogin=1', locked: true };
      }),
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
      <button onClick={openMenu} aria-label="Menu" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, margin: '-4px 0', lineHeight: 1, display: 'flex' }}>
        <MenuIcon size={30} color={iconColor ?? COLORS.ink} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(32,56,77,0.34)', zIndex: 999 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: 'min(86vw, 360px)',
              background: '#FFFEFB',
              borderRight: '1px solid #DDE5E9',
              boxShadow: '12px 0 32px rgba(32,56,77,.16)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              color: '#20384D',
              fontFamily: "'Noto Sans Tamil','Nirmala UI',Latha,Arial,sans-serif",
            }}
          >
            <header style={{
              flex: '0 0 68px', height: 68, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '0 16px',
              borderBottom: '2px solid #E2B04A', background: '#fff', boxSizing: 'border-box',
            }}>
              <a href="/" aria-label="PONNA.in" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', minWidth: 0 }}>
                {/* Same clean wordmark (no tagline strip) as the home page header. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-wordmark.png" alt="PONNA.in" style={{ display: 'block', width: 168, height: 'auto' }} />
              </a>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{
                width: 36, height: 36, border: '1px solid #DDE5E9', borderRadius: 8,
                background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0,
                flex: '0 0 36px',
              }}>
                <CloseIcon size={18} color="#20384D" />
              </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 12px', boxSizing: 'border-box' }}>
              <nav aria-label="PONNA menu">
                <div style={{ paddingBottom: 6, borderBottom: '1px solid #E1E7EA' }}>
                  <MenuRow href="/" label={t.menu.home} Icon={HomeIcon} bold />
                  <MenuRow href="/current-affairs" label="Current Affairs" Icon={StudyNotesIcon} bold />
                  <MenuRow href="/tnpsc-group-4/notification-2026" label="Group 4 அறிவிப்பு 2026" Icon={StudyNotesIcon} bold isNew />
                </div>

                {sections.map((section) => (
                  <div key={section.heading}>
                    <p style={{
                      display: 'flex', alignItems: 'center', gap: 10, margin: '15px 10px 5px',
                      color: '#52706D', fontSize: 11, fontWeight: 900, letterSpacing: 1.8,
                    }}>
                      <span>{section.heading}</span>
                      <span style={{ flex: 1, height: 1, background: '#D7DFE2' }} />
                    </p>
                    {section.items.map((item) => (
                      <MenuRow key={item.label} href={item.href} label={item.label} Icon={item.Icon} locked={item.locked} />
                    ))}
                  </div>
                ))}

                <div style={{
                  margin: '12px 10px 2px', paddingTop: 10, borderTop: '1px solid #E1E7EA',
                  color: '#71808B', fontSize: 11, lineHeight: 1.8,
                }}>
                  <div>
                    {[
                      ['Terms', '/terms'], ['Privacy', '/privacy'], ['Refund', '/refund-policy'],
                      ['Delivery', '/shipping-policy'], ['Contact', '/contact']
                    ].map(([label, href]) => (
                      <a key={href} href={href} style={{ color: 'inherit', textDecoration: 'underline', marginRight: 10 }}>{label}</a>
                    ))}
                  </div>
                  <small style={{ fontSize: 10 }}>ARLENA (OPC) PRIVATE LIMITED</small>
                </div>
              </nav>
            </div>

            <div style={{ flex: '0 0 auto', padding: '10px 14px 14px', background: '#fff', borderTop: '1px solid #DDE5E9' }}>
              {!isLoggedIn && (
                <div style={{ padding: '0 2px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#667786', textAlign: 'center' }}>
                    Login செய்தால் எல்லா வசதிகளும் திறக்கும்
                  </p>
                  <a href="/?startLogin=1" style={{
                    display: 'block', textAlign: 'center', padding: 13, borderRadius: 9,
                    background: '#0B3864', color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none',
                  }}>Login / Sign up</a>
                </div>
              )}

              {isLoggedIn && hasPass === false && (
                <a href="/plans" style={{
                  display: 'flex', alignItems: 'center', gap: 11, minHeight: 62, padding: '8px 13px',
                  background: '#F5C548', color: '#20384D', textDecoration: 'none',
                  border: '1px solid #DDAE35', borderRadius: 10,
                  boxShadow: '0 5px 12px rgba(176,122,16,.12)', boxSizing: 'border-box',
                }}>
                  <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 7, background: 'rgba(255,255,255,.55)', flex: '0 0 36px' }}>
                    <PlansIcon size={19} color="#0B3864" />
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 18, lineHeight: 1.2 }}>{t.menu.plans}</strong>
                    <small style={{ display: 'block', fontSize: 11, marginTop: 2 }}>பயிற்சியைத் தொடருங்கள்</small>
                  </span>
                  <b style={{ marginLeft: 'auto', fontSize: 27, fontWeight: 400 }}>›</b>
                </a>
              )}

              {isLoggedIn && hasPass === true && (
                <a href="/plans" style={{
                  display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '7px 12px',
                  border: '1px solid #DDAE35', borderRadius: 9, background: '#FFF7DC',
                  color: '#20384D', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                }}>
                  <span style={{ color: '#17835E', fontWeight: 800 }}>✓</span>
                  {t.menu.plans} · Active
                  <span style={{ marginLeft: 'auto', fontSize: 18, lineHeight: 1 }}>›</span>
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function MenuRow({
  href, label, Icon, bold, locked, isNew,
}: {
  href: string;
  label: string;
  Icon: NavItem['Icon'];
  bold?: boolean;
  locked?: boolean;
  isNew?: boolean;
}) {
  const active = !locked && typeof window !== 'undefined' && window.location.pathname === href;

  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '5px 10px',
        borderLeft: active ? '3px solid #E2B04A' : '3px solid transparent',
        background: active ? '#F5F8F9' : 'transparent',
        color: '#20384D', textDecoration: 'none', fontSize: 17,
        fontWeight: active || bold ? 800 : 500, boxSizing: 'border-box',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {isNew && (
        <span style={{
          fontSize: 10, fontWeight: 900, letterSpacing: '.6px', color: '#0B3864',
          background: '#FFF1B8', border: '1px solid #E8C95D',
          padding: '3px 7px', borderRadius: 5,
        }}>NEW</span>
      )}
      {active && (
        <span style={{ fontSize: 10, color: '#17835E', fontWeight: 800, letterSpacing: '.5px' }}>CURRENT</span>
      )}
      {locked && (
        <span aria-label="Login required" style={{
          marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: '.5px',
          color: '#71808B', border: '1px solid #DDE5E9', borderRadius: 4, padding: '2px 5px',
        }}>LOGIN</span>
      )}
    </a>
  );
}
