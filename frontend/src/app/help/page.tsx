'use client';

// Help & Support — full Help Center redesign (Sept 2026 finalized
// requirement). Student journey: Search -> Find Answer -> Solve the
// Problem, or Choose Category -> Find Guidance -> Solve the Problem, and
// only as a last resort, Contact Support. Question reporting already
// lives on each question itself (finalized requirement) — deliberately
// not duplicated here. Uses the existing PONNA design tokens
// (brand-theme.tsx) throughout, matching Plans/Profile/Quiz — never a new
// visual identity for one page.

import { useMemo, useState, type ReactNode } from 'react';
import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Category = 'practice' | 'pass' | 'account' | 'technical';

type Faq = { id: string; category: Category; question: string; answer: string };

const FAQS: Faq[] = [
  {
    id: 'start-practice',
    category: 'practice',
    question: 'How do I start practising?',
    answer: 'Tap Start Practice. Choose your exam, difficulty and language once — PONNA remembers it next time.',
  },
  {
    id: 'free-plan',
    category: 'pass',
    question: 'What does the Free plan include?',
    answer: '5 free questions a day, no Pass needed. Get a Pass for unlimited daily practice.',
  },
  {
    id: 'buy-pass',
    category: 'pass',
    question: 'How do I purchase a Pass?',
    answer: 'Open My Passes, pick your exam, tap Buy. Activates right after payment.',
  },
  {
    id: 'pass-expiry',
    category: 'pass',
    question: 'When does my Pass expire?',
    answer: 'Check My Passes → Active Plans for your exact date. Annual Passes last 12 months; the Group 4 - VAO Pass lasts until the exam.',
  },
  {
    id: 'review-mistakes',
    category: 'practice',
    question: 'How does Review Mistakes work?',
    answer: 'Wrong answers save here automatically for revision. Doesn\u2019t affect your quota, streak or ranking.',
  },
  {
    id: 'daily-challenge',
    category: 'practice',
    question: 'How does Daily Challenge work?',
    answer: 'A new set every day — attempt it once to keep your streak going.',
  },
  {
    id: 'change-language',
    category: 'account',
    question: 'How can I change Tamil/English?',
    answer: 'Tap the language toggle in the top menu anytime.',
  },
  {
    id: 'performance-calc',
    category: 'practice',
    question: 'How is my performance calculated?',
    answer: 'Accuracy, streak and time practised — updated after every session, automatically.',
  },
  {
    id: 'use-as-app',
    category: 'account',
    question: 'How do I use PONNA as an app?',
    // Special-cased below: tapping this FAQ opens the "Use PONNA as an
    // App" guide instead of expanding this text inline — this answer is
    // a fallback only for anywhere FAQS is listed without that handling.
    answer: 'See the "Use PONNA as an App" guide below.',
  },
];

const CATEGORIES: { id: Category; title: string; description: string; icon: string }[] = [
  { id: 'practice', title: 'Practice', description: 'Start Practice, questions, answers, language & difficulty', icon: '📝' },
  { id: 'pass', title: 'My Pass', description: 'Plans, payment, activation & validity', icon: '🎟️' },
  { id: 'account', title: 'My Account', description: 'Login, profile, password & devices', icon: '👤' },
  { id: 'technical', title: 'Technical Help', description: 'Loading, errors & website issues', icon: '⚙️' },
];

type Guide = { id: string; title: string; description: string; steps: string[] };

const GUIDES: Guide[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn how to begin your preparation',
    steps: ['Sign up and complete your profile.', 'Tap Start Practice, set up your exam once.', 'Answer your first question — see the answer instantly.'],
  },
  {
    id: 'choose-practice',
    title: 'Choose Your Practice',
    description: 'Understand exam, subject and difficulty selection',
    steps: ['Pick your exam, category and Group.', 'Choose Mixed, Medium or Hard.', 'Language fills in automatically.'],
  },
  {
    id: 'make-the-most',
    title: 'Make the Most of PONNA',
    description: 'Learn about Review Mistakes, Performance and Daily Challenge',
    steps: ['Revisit wrong answers in Review Mistakes.', 'Track accuracy and streak on Performance.', 'Keep your streak alive — one Daily Challenge a day.'],
  },
];

function normalize(s: string) {
  return s.toLowerCase().trim();
}

export default function HelpPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [openGuideId, setOpenGuideId] = useState<string | null>(null);
  const [showAppGuide, setShowAppGuide] = useState(false);

  // "How do I use PONNA as an app?" opens the visual App Guide instead of
  // expanding inline text — one guide serves both the FAQ entry and the
  // Quick Guide card, per the spec (no duplicate content/pages).
  function handleFaqToggle(id: string) {
    if (id === 'use-as-app') {
      setShowAppGuide(true);
      return;
    }
    setOpenFaqId((cur) => (cur === id ? null : id));
  }

  const q = normalize(query);
  const searching = q.length > 0;

  const visibleFaqs = useMemo(() => {
    let list = FAQS;
    if (activeCategory) list = list.filter((f) => f.category === activeCategory);
    if (searching) list = list.filter((f) => normalize(f.question).includes(q) || normalize(f.answer).includes(q));
    return list;
  }, [activeCategory, q, searching]);

  const mailBody = encodeURIComponent('Registered email address:\n\nWhat happened:\n\n');
  const mailHref = `mailto:ponna@arlena.in?subject=${encodeURIComponent('PONNA Support')}&body=${mailBody}`;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <StudentMenu />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.menu.help}</h1>
      </div>

      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, color: COLORS.ink, margin: '0 0 6px' }}>How can we help?</h2>
      <p style={{ fontSize: 14, color: COLORS.inkMuted, lineHeight: 1.5, margin: '0 0 16px' }}>
        Find answers, learn about PONNA features, or get help from our support team.
      </p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: searching ? 20 : 24 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: COLORS.inkMuted }}>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a question, feature or problem"
          style={{
            width: '100%',
            padding: '14px 14px 14px 40px',
            borderRadius: 12,
            border: `1.5px solid ${searching ? COLORS.gold : COLORS.line}`,
            background: COLORS.paperAlt,
            color: COLORS.ink,
            fontSize: 14,
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Search results (replaces the rest of the browse UI while active) */}
      {searching ? (
        <section style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
            {visibleFaqs.length} result{visibleFaqs.length === 1 ? '' : 's'}
          </p>
          {visibleFaqs.length === 0 ? (
            <div style={{ padding: 16, borderRadius: 12, background: COLORS.paperAlt, border: `1px solid ${COLORS.line}`, fontSize: 14, color: COLORS.inkMuted, lineHeight: 1.5 }}>
              No matching answers yet — try different keywords, or contact support below.
            </div>
          ) : (
            <FaqAccordion faqs={visibleFaqs} openId={openFaqId} onToggle={handleFaqToggle} />
          )}
        </section>
      ) : (
        <>
          {/* I need help with... */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 10px' }}>I need help with...</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCategory(c.id);
                    document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  style={{
                    textAlign: 'left',
                    background: activeCategory === c.id ? COLORS.goldLight : COLORS.paper,
                    border: `1.5px solid ${activeCategory === c.id ? COLORS.gold : COLORS.line}`,
                    borderRadius: 14,
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 3 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: COLORS.inkMuted, lineHeight: 1.4 }}>{c.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Popular Questions */}
          <section id="faq-section" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                {activeCategory ? CATEGORIES.find((c) => c.id === activeCategory)?.title + ' Questions' : 'Popular Questions'}
              </h3>
              {activeCategory && (
                <button
                  onClick={() => setActiveCategory(null)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: COLORS.gold, cursor: 'pointer' }}
                >
                  Show all
                </button>
              )}
            </div>

            {activeCategory === 'technical' || visibleFaqs.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 12, background: COLORS.paperAlt, border: `1px solid ${COLORS.line}`, fontSize: 14, color: COLORS.inkMuted, lineHeight: 1.5 }}>
                Loading or error issues are usually fixed by refreshing the page or checking your internet connection. Still stuck? Contact support below.
              </div>
            ) : (
              <FaqAccordion faqs={visibleFaqs} openId={openFaqId} onToggle={handleFaqToggle} />
            )}
          </section>

          {/* Quick Guides */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 10px' }}>Quick Guides</h3>
            {GUIDES.map((g) => {
              const open = openGuideId === g.id;
              return (
                <div key={g.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpenGuideId(open ? null : g.id)}
                    style={{ width: '100%', textAlign: 'left', background: COLORS.paper, border: 'none', padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                  >
                    <span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 2 }}>{g.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: COLORS.inkMuted }}>{g.description}</span>
                    </span>
                    <span style={{ fontSize: 13, color: COLORS.gold, flexShrink: 0 }}>{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <ol style={{ margin: 0, padding: '0 16px 16px 32px', fontSize: 13, color: COLORS.ink, lineHeight: 1.6 }}>
                      {g.steps.map((s, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}

            {/* "Use PONNA as an App" is a visual, multi-screen guide
                (Start Screen -> Android/iPhone steps with mockups), not
                an inline accordion like the guides above — opens the
                same modal the FAQ entry above uses. */}
            <button
              onClick={() => setShowAppGuide(true)}
              style={{ width: '100%', textAlign: 'left', background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 2 }}>Use PONNA as an App</span>
                <span style={{ display: 'block', fontSize: 12, color: COLORS.inkMuted }}>Add PONNA to your phone's Home Screen for quick access</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.gold, flexShrink: 0 }}>→</span>
            </button>
          </section>
        </>
      )}

      {showAppGuide && <AppGuideModal onClose={() => setShowAppGuide(false)} />}

      {/* Contact Support */}
      <section style={{ background: COLORS.paperAlt, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
        <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px' }}>Still need help?</h3>
        <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: '0 0 4px' }}>We&apos;re here to help.</p>
        <p style={{ fontSize: 13, color: COLORS.ink, fontWeight: 600, margin: '0 0 12px' }}>ponna@arlena.in</p>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, lineHeight: 1.5, margin: '0 0 16px' }}>
          Please include your registered email address and briefly describe your issue.
        </p>
        <a
          href={mailHref}
          style={{
            display: 'block',
            padding: 13,
            borderRadius: 10,
            background: COLORS.ink,
            color: COLORS.paper,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Contact Support →
        </a>
      </section>
    </main>
  );
}

function FaqAccordion({ faqs, openId, onToggle }: { faqs: Faq[]; openId: string | null; onToggle: (id: string) => void }) {
  return (
    <div>
      {faqs.map((f) => {
        const open = openId === f.id;
        return (
          <div key={f.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
            <button
              onClick={() => onToggle(f.id)}
              style={{ width: '100%', textAlign: 'left', background: COLORS.paper, border: 'none', padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, lineHeight: 1.4 }}>{f.question}</span>
              <span style={{ fontSize: 15, color: COLORS.gold, flexShrink: 0 }}>{open ? '−' : '+'}</span>
            </button>
            {open && <p style={{ margin: 0, padding: '0 16px 16px', fontSize: 13, color: COLORS.inkMuted, lineHeight: 1.6 }}>{f.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** "Use PONNA as an App" — a visual, multi-screen guide (not a text FAQ):
 * a Start Screen, then step-by-step Android/Chrome and iPhone/Safari
 * sections, each with a small phone mockup showing exactly where to tap.
 * Opened from both the Quick Guide card and the matching FAQ entry — one
 * guide, no duplicate content. */
function AppGuideModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'start' | 'platforms'>('start');

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,34,56,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: COLORS.paper,
          borderRadius: '16px 16px 0 0',
          padding: 20,
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: COLORS.inkMuted, cursor: 'pointer', lineHeight: 1, padding: 4 }}>
            ×
          </button>
        </div>

        {step === 'start' ? (
          <div style={{ textAlign: 'center', padding: '8px 8px 4px' }}>
            <div style={{ marginBottom: 18 }}>
              <PhoneHomeIcon />
            </div>
            <h3 style={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 800, color: COLORS.ink, margin: '0 0 10px' }}>Use PONNA Like an App</h3>
            <p style={{ fontSize: 14, color: COLORS.inkMuted, lineHeight: 1.6, margin: '0 0 4px' }}>First, open ponna.in on your phone.</p>
            <p style={{ fontSize: 14, color: COLORS.inkMuted, lineHeight: 1.6, margin: '0 0 22px' }}>
              Follow a few simple steps to add PONNA to your Home Screen for quick access.
            </p>
            <button
              onClick={() => setStep('platforms')}
              style={{ width: '100%', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
            >
              Get Started →
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setStep('start')}
              style={{ background: 'none', border: 'none', padding: 0, marginBottom: 14, fontSize: 12, fontWeight: 700, color: COLORS.gold, cursor: 'pointer' }}
            >
              ← Back
            </button>

            <PlatformGuideSection
              title="Android / Chrome — Install PONNA"
              mockup={<ChromeMockup />}
              steps={[
                'Open Chrome.',
                'Go to ponna.in.',
                'Tap the ⋮ (three-dot menu) at the top-right.',
                'Select "Install and shortcut".',
                'Complete the installation.',
                'PONNA will appear on the Home Screen.',
              ]}
            />

            <PlatformGuideSection
              title="iPhone / Safari — Add PONNA to Home Screen"
              mockup={<SafariMockup />}
              steps={[
                'Open Safari.',
                'Go to ponna.in.',
                'Tap the Share (↑) button.',
                'Select "Add to Home Screen".',
                'Tap Add.',
                'PONNA will appear on the Home Screen.',
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformGuideSection({ title, mockup, steps }: { title: string; mockup: ReactNode; steps: string[] }) {
  return (
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <h4 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{title}</h4>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>{mockup}</div>
      <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13, color: COLORS.ink, lineHeight: 1.7 }}>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

/** Simple abstract phone-with-Home-Screen glyph for the Start Screen —
 * not tied to a platform, just sets the visual tone before the two
 * platform-specific mockups below. */
function PhoneHomeIcon() {
  return (
    <svg width="72" height="96" viewBox="0 0 72 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="64" height="88" rx="10" stroke={COLORS.gold} strokeWidth="3" fill={COLORS.paperAlt} />
      <circle cx="36" cy="80" r="4" stroke={COLORS.gold} strokeWidth="2" fill="none" />
      <rect x="16" y="18" width="16" height="16" rx="4" fill={COLORS.goldLight} stroke={COLORS.gold} strokeWidth="1.5" />
      <rect x="40" y="18" width="16" height="16" rx="4" fill={COLORS.goldLight} stroke={COLORS.gold} strokeWidth="1.5" />
      <rect x="16" y="42" width="16" height="16" rx="4" fill={COLORS.goldLight} stroke={COLORS.gold} strokeWidth="1.5" />
      <rect x="40" y="42" width="16" height="16" rx="4" fill={COLORS.gold} />
    </svg>
  );
}

/** Chrome/Android mockup — highlights the ⋮ three-dot menu at the
 * top-right of the address bar, which is where "Install and shortcut"
 * lives. */
function ChromeMockup() {
  return (
    <svg width="150" height="220" viewBox="0 0 150 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="144" height="214" rx="16" fill={COLORS.paper} stroke={COLORS.line} strokeWidth="2" />
      <rect x="14" y="18" width="122" height="28" rx="8" fill={COLORS.paperAlt} stroke={COLORS.line} strokeWidth="1.5" />
      <text x="24" y="36" fontSize="10" fill={COLORS.inkMuted} fontFamily="sans-serif">ponna.in</text>
      <text x="118" y="37" fontSize="14" fill={COLORS.ink} fontFamily="sans-serif">⋮</text>
      <circle cx="122" cy="32" r="14" fill="none" stroke={COLORS.gold} strokeWidth="2" strokeDasharray="3 3" />
      <path d="M108 60 C 96 56, 90 48, 96 40" stroke={COLORS.gold} strokeWidth="2" fill="none" markerEnd="url(#arrowGold)" />
      <text x="46" y="72" fontSize="11" fontWeight="700" fill={COLORS.gold} fontFamily="sans-serif">Tap here</text>
      <rect x="14" y="90" width="122" height="10" rx="3" fill={COLORS.paperAlt} />
      <rect x="14" y="106" width="90" height="10" rx="3" fill={COLORS.paperAlt} />
      <rect x="14" y="122" width="110" height="10" rx="3" fill={COLORS.paperAlt} />
      <defs>
        <marker id="arrowGold" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={COLORS.gold} />
        </marker>
      </defs>
    </svg>
  );
}

/** Safari/iPhone mockup — highlights the Share (box with an up arrow)
 * icon in the bottom toolbar, which is where "Add to Home Screen" lives. */
function SafariMockup() {
  return (
    <svg width="150" height="220" viewBox="0 0 150 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="144" height="214" rx="16" fill={COLORS.paper} stroke={COLORS.line} strokeWidth="2" />
      <rect x="14" y="18" width="122" height="20" rx="6" fill={COLORS.paperAlt} stroke={COLORS.line} strokeWidth="1.5" />
      <text x="52" y="32" fontSize="10" fill={COLORS.inkMuted} fontFamily="sans-serif">ponna.in</text>
      <rect x="14" y="60" width="122" height="10" rx="3" fill={COLORS.paperAlt} />
      <rect x="14" y="76" width="90" height="10" rx="3" fill={COLORS.paperAlt} />
      <rect x="14" y="92" width="110" height="10" rx="3" fill={COLORS.paperAlt} />
      <rect x="14" y="182" width="122" height="26" rx="8" fill={COLORS.paperAlt} stroke={COLORS.line} strokeWidth="1.5" />
      <path d="M74 189 v10 M69 194 l5 -5 l5 5" stroke={COLORS.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="68" y="187" width="12" height="10" rx="2" fill="none" stroke={COLORS.ink} strokeWidth="1.3" />
      <circle cx="74" cy="195" r="16" fill="none" stroke={COLORS.gold} strokeWidth="2" strokeDasharray="3 3" />
      <path d="M96 172 C 106 168, 112 176, 108 184" stroke={COLORS.gold} strokeWidth="2" fill="none" markerEnd="url(#arrowGold2)" />
      <text x="98" y="160" fontSize="11" fontWeight="700" fill={COLORS.gold} fontFamily="sans-serif">Tap here</text>
      <defs>
        <marker id="arrowGold2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={COLORS.gold} />
        </marker>
      </defs>
    </svg>
  );
}
