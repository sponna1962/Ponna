'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '../lib/language-context';
import { COLORS, BitterFontLinks } from '../lib/brand-theme';
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

type NavItem = { href: string; label: string; Icon: (p: { size?: number; color?: string }) => React.ReactElement };

export function StudentMenu() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  function openMenu() {
    setIsLoggedIn(typeof window !== 'undefined' && !!localStorage.getItem('ponna_student_token'));
    setOpen(true);
  }

  const sections: { heading: string; items: NavItem[] }[] = isLoggedIn
    ? [
        {
          heading: t.menu.sectionPreparation,
          items: [
            { href: '/ask-ponna', label: t.menu.askPonna, Icon: AskPonnaIcon },
            { href: '/quiz', label: t.menu.practice, Icon: PracticeIcon },
            { href: '/mistakes', label: t.menu.reviewMistakes, Icon: MistakesIcon },
            { href: '/study-notes', label: t.menu.studyNotes, Icon: StudyNotesIcon },
            { href: '/daily-quiz', label: t.menu.dailyQuiz, Icon: DailyQuizIcon },
            { href: '/live-exam', label: t.menu.liveExam, Icon: LiveExamIcon },
            { href: '/adaptive-mock', label: t.menu.adaptiveMock, Icon: PracticeIcon },
            { href: '/dashboard', label: t.menu.dashboard, Icon: ProgressIcon },
            { href: '/cutoff-predictor', label: t.menu.cutoffPredictor, Icon: CutoffPredictorIcon },
            { href: '/plans', label: t.menu.plans, Icon: PlansIcon },
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
      <button onClick={openMenu} aria-label="Menu" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex' }}>
        <MenuIcon size={22} color={COLORS.ink} />
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,34,56,0.45)', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 258, background: COLORS.paper, boxShadow: '2px 0 16px rgba(0,0,0,0.15)', padding: '20px 18px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Image src="/logo-compact.png" alt="PONNA.in" width={170} height={45} style={{ height: 42, width: 'auto' }} />
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <CloseIcon size={18} color={COLORS.inkMuted} />
              </button>
            </div>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', color: COLORS.ink, textDecoration: 'none', fontSize: 15, borderRadius: 8, fontWeight: 600 }}>
              <HomeIcon size={19} color={COLORS.gold} /> {t.menu.home}
            </a>
            <a href="/current-affairs" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', color: COLORS.ink, textDecoration: 'none', fontSize: 15, borderRadius: 8, fontWeight: 600 }}>
              <StudyNotesIcon size={19} color={COLORS.gold} /> Current Affairs
            </a>
            {sections.map((section) => (
              <div key={section.heading} style={{ marginTop: 14 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.inkMuted, letterSpacing: 0.8, margin: '0 6px 4px' }}>{section.heading}</p>
                {section.items.map((item) => (
                  <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', color: COLORS.ink, textDecoration: 'none', fontSize: 14.5, borderRadius: 8 }}>
                    <item.Icon size={18} color={COLORS.gold} /> {item.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
