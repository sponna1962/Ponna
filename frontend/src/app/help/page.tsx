'use client';

// Help & Support — full Help Center redesign (Sept 2026 finalized
// requirement). Student journey: Search -> Find Answer -> Solve the
// Problem, or Choose Category -> Find Guidance -> Solve the Problem, and
// only as a last resort, Contact Support. Question reporting already
// lives on each question itself (finalized requirement) — deliberately
// not duplicated here. Uses the existing PONNA design tokens
// (brand-theme.tsx) throughout, matching Plans/Profile/Quiz — never a new
// visual identity for one page.

import { useMemo, useState } from 'react';
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
    answer:
      'Tap Start Practice from the menu. The first time, choose your exam, difficulty and language — PONNA saves this setup, so every session after that starts in one tap. Tap "Change" anytime to update it.',
  },
  {
    id: 'free-plan',
    category: 'pass',
    question: 'What does the Free plan include?',
    answer:
      'Every student gets 5 free practice questions a day, no Pass required. For unlimited daily practice on your exam, get an Annual Pass or an exam-specific Pass from My Passes.',
  },
  {
    id: 'buy-pass',
    category: 'pass',
    question: 'How do I purchase a Pass?',
    answer:
      'Open My Passes from the menu, pick the Pass that matches your exam, and tap Buy. Payment is handled securely through Razorpay, and your Pass activates immediately once payment is confirmed.',
  },
  {
    id: 'pass-expiry',
    category: 'pass',
    question: 'When does my Pass expire?',
    answer:
      'An Annual Pass is valid for 12 months from the day you buy it — check your exact renewal date anytime under My Passes → Active Plans. The TNPSC குரூப் 4 - வி.ஏ.ஓ. Pass stays valid until the exam date, which PONNA will update once TNPSC announces it.',
  },
  {
    id: 'review-mistakes',
    category: 'practice',
    question: 'How does Review Mistakes work?',
    answer:
      'Every question you get wrong is automatically saved to Review Mistakes, so you can revisit and re-attempt it on its own. It never counts against your daily quota, streak or ranking — it is purely for revision.',
  },
  {
    id: 'daily-challenge',
    category: 'practice',
    question: 'How does Daily Challenge work?',
    answer:
      'A new Daily Challenge is ready every day. Attempt it once to keep your streak going — Brain Challenge is a second daily set with the same idea, for extra practice.',
  },
  {
    id: 'change-language',
    category: 'account',
    question: 'How can I change Tamil/English?',
    answer:
      'Tap the language toggle in the top menu anytime to switch between Tamil and English. Your saved practice history, streak and performance stay exactly the same either way.',
  },
  {
    id: 'performance-calc',
    category: 'practice',
    question: 'How is my performance calculated?',
    answer:
      'Your Performance page tracks your accuracy by difficulty level, your daily streak, and time spent practising — it updates automatically after every session, no extra steps needed.',
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
    steps: [
      'Sign up with your phone number and complete your profile.',
      'Tap Start Practice and set up your exam once — PONNA remembers it for every future session.',
      'Answer your first question — PONNA shows the correct answer right away, so you learn as you go.',
    ],
  },
  {
    id: 'choose-practice',
    title: 'Choose Your Practice',
    description: 'Understand exam, subject and difficulty selection',
    steps: [
      "Pick your exam type, authority and category — for TNPSC, choose the specific Group or exam you're preparing for.",
      'Choose Mixed, Medium or Hard difficulty — Mixed gives you a bit of everything.',
      "PONNA fills in the right language automatically, based on what's published for your exam.",
    ],
  },
  {
    id: 'make-the-most',
    title: 'Make the Most of PONNA',
    description: 'Learn about Review Mistakes, Performance and Daily Challenge',
    steps: [
      "Revisit every wrong answer anytime in Review Mistakes — it's a separate space just for revision.",
      'Check your accuracy by difficulty and your streak on the Performance page.',
      'Keep your streak alive with one Daily Challenge attempt a day.',
    ],
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
            <FaqAccordion faqs={visibleFaqs} openId={openFaqId} onToggle={(id) => setOpenFaqId((cur) => (cur === id ? null : id))} />
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
              <FaqAccordion faqs={visibleFaqs} openId={openFaqId} onToggle={(id) => setOpenFaqId((cur) => (cur === id ? null : id))} />
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
          </section>
        </>
      )}

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
