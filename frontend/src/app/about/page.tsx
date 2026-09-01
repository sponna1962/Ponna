'use client';

// About PONNA — informational page, public (no auth required). Content and
// structure per the finalized brief: hero, main about copy, quality
// commitment, approach, audience, social purpose, feature grid, name story,
// final CTA. No pricing/Plans, no Free-questions info, no payment/technical
// details — this page is purely about what PONNA is and why it exists.
//
// Design grounds itself in the brand's own name: "Ponna" (பொன்ன) means gold
// in Tamil, so gold is the accent throughout rather than a generic
// palette. A slab serif (Bitter) carries headlines — evokes an official
// certificate/exam-paper feel appropriate to an exam-prep brand — while
// body copy stays in the site-wide Noto Sans for consistency with the rest
// of the app. The one signature visual moment is a ruled-notebook-paper
// motif behind the hero; elsewhere, quiet hairline rules divide sections.

const FONT_FAMILY = "'Bitter', 'Noto Sans Tamil', 'Noto Sans', serif";

const COLORS = {
  paper: '#FAFAF7',
  paperAlt: '#F4F0E6',
  ink: '#1A2238',
  inkMuted: '#535A72',
  gold: '#A8791F',
  goldLight: '#EFE0BC',
  line: '#E4DFD0',
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 26, fontWeight: 700, color: COLORS.ink, margin: '0 0 16px', lineHeight: 1.25 }}>
      {children}
    </h2>
  );
}

function Rule() {
  return <div style={{ height: 1, background: COLORS.line, margin: '56px 0' }} />;
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', ...style }}>{children}</section>;
}

export default function AboutPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Bitter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <main style={{ background: COLORS.paper, color: COLORS.ink, paddingBottom: 80 }}>
        {/* Simple top bar — no menu chrome needed, just a way back */}
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 24px 0' }}>
          <a href="/" style={{ fontSize: 14, color: COLORS.inkMuted, textDecoration: 'none' }}>
          ← PONNA.in
        </a>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '48px 0 40px' }}>
        {/* Ruled-notebook motif — the one signature device, used once */}
        <svg
          aria-hidden
          viewBox="0 0 640 200"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 640, height: 200, opacity: 0.5, pointerEvents: 'none' }}
        >
          <line x1="0" y1="40" x2="560" y2="40" stroke={COLORS.goldLight} strokeWidth="2" />
          <line x1="0" y1="80" x2="620" y2="80" stroke={COLORS.goldLight} strokeWidth="2" />
          <line x1="0" y1="120" x2="480" y2="120" stroke={COLORS.goldLight} strokeWidth="2" />
          <line x1="0" y1="160" x2="600" y2="160" stroke={COLORS.goldLight} strokeWidth="2" />
        </svg>

        <Section style={{ position: 'relative' }}>
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: 800, color: COLORS.ink, margin: '0 0 10px', lineHeight: 1.15 }}>
            About PONNA
          </h1>
          <p style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 600, color: COLORS.gold, margin: '0 0 20px' }}>
            Practice Today. Prepare Better.
          </p>
          <p style={{ fontSize: 16, color: COLORS.inkMuted, lineHeight: 1.7, maxWidth: 520 }}>
            PONNA is an online exam practice platform created to make quality examination preparation more accessible and affordable for everyone.
          </p>
        </Section>
      </div>

      {/* ── Main about content ───────────────────────────────────────── */}
      <Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 16, lineHeight: 1.75, color: COLORS.inkMuted }}>
          <p>
            PONNA brings together previous examination question papers and answer keys, along with carefully designed questions
            prepared by experienced teachers and subject experts, covering competitive, employment, entrance, and teacher
            eligibility examinations.
          </p>
          <p>
            Students can practise anytime, anywhere, and at their own pace, choosing the examination, subject, and practice level
            that suits their preparation. After answering each question, the correct answer is shown immediately, helping
            students identify mistakes, understand the right answer, and learn as they practise.
          </p>
          <p>
            For students who are just beginning their preparation, questions are organized from Easy to Moderate to Hard,
            allowing them to gradually strengthen their knowledge and confidence. PONNA also encourages students to begin
            preparing for competitive and entrance examinations while they are still in school or college, rather than waiting
            until an examination is approaching.
          </p>
        </div>

        {/* Pull-quote — the sentence that carries the brand's real point of view */}
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 21,
            fontWeight: 700,
            color: COLORS.ink,
            lineHeight: 1.5,
            margin: '32px 0',
            padding: '4px 0 4px 20px',
            borderLeft: `3px solid ${COLORS.gold}`,
          }}
        >
          We believe that financial circumstances should not prevent a student from accessing quality practice resources.
        </p>

        <p style={{ fontSize: 16, lineHeight: 1.75, color: COLORS.inkMuted }}>
          Our vision is not simply to provide a large number of questions. We aim to provide reliable, useful, and
          high-quality practice at an affordable cost, particularly for students who may not be able to afford expensive
          coaching programs. Through accessible technology, structured practice, previous examination questions, and
          continuously developing question content, PONNA aims to make effective exam preparation available to more
          students and give them a better opportunity to learn, practise, improve, and pursue their educational and
          career goals.
        </p>
      </Section>

      <Rule />

      {/* ── Our Commitment to Quality ────────────────────────────────── */}
      <Section>
        <H2>Our Commitment to Quality</H2>
        <p style={{ fontSize: 16, lineHeight: 1.75, color: COLORS.inkMuted, marginBottom: 16 }}>
          We are committed to continuously improving our question bank and maintaining the accuracy, relevance, and
          usefulness of our practice content. Previous examination questions and answer keys are carefully organized,
          while new practice questions are developed and reviewed with the requirements of each examination in mind.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.75, color: COLORS.inkMuted }}>
          As examination patterns, syllabi, and requirements evolve, we aim to continuously update and improve our
          content so that students can practise with material that remains relevant to their preparation.
        </p>
      </Section>

      <Rule />

      {/* ── Our Approach — a genuine sequence, so a step treatment fits ── */}
      <Section>
        <H2>Our Approach</H2>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {['Learn', 'Practise', 'Check', 'Improve'].map((step, i, arr) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: COLORS.ink }}>
                {step}
              </span>
              {i < arr.length - 1 && <span style={{ color: COLORS.gold, fontSize: 18 }}>→</span>}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.75, color: COLORS.inkMuted }}>
          Practice should be a regular part of exam preparation, not something students do only before an examination.
        </p>
      </Section>

      <Rule />

      {/* ── Who Can Use PONNA — kept small, tag-style, not oversized cards ── */}
      <Section>
        <H2>Who Can Use PONNA?</H2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {['Competitive & Employment Examinations', 'Higher Education & Entrance Examinations', 'Eligibility Examinations'].map((label) => (
            <span
              key={label}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.ink,
                background: COLORS.paperAlt,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 20,
                padding: '8px 16px',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Our Social Purpose — full-bleed band, the emotional core ─── */}
      <div style={{ background: COLORS.ink, color: COLORS.paper, padding: '56px 0', margin: '56px 0' }}>
        <Section>
          <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 26, fontWeight: 700, color: COLORS.goldLight, margin: '0 0 20px', lineHeight: 1.3 }}>
            Quality Practice Should Not Be Limited by Cost
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 16, lineHeight: 1.75, color: '#D7D9E4' }}>
            <p>Many students prepare for competitive and entrance examinations without access to expensive coaching programs.</p>
            <p>
              PONNA aims to provide an affordable option for regular exam practice, so that students can access quality
              questions, previous examination papers, immediate answers, and structured practice without having to
              depend entirely on costly coaching.
            </p>
            <p>
              We do not promise success simply by using PONNA. Success still depends on a student's learning,
              consistency, effort, and preparation. Our role is to provide a useful and affordable platform that helps
              make that preparation better.
            </p>
          </div>
        </Section>
      </div>

      {/* ── Why PONNA — simple icon+label grid, no card chrome ─────────── */}
      <Section>
        <H2>Why PONNA?</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginTop: 24 }}>
          {[
            { icon: <IconPaper />, label: 'Previous Examination Questions' },
            { icon: <IconCap />, label: 'Teacher & Subject Expert–Designed Questions' },
            { icon: <IconCheck />, label: 'Instant Answers' },
            { icon: <IconSteps />, label: 'Easy to Hard Practice' },
            { icon: <IconClock />, label: 'Practice Anytime' },
            { icon: <IconCoin />, label: 'Affordable Preparation' },
            { icon: <IconRefresh />, label: 'Continuous Improvement' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {item.icon}
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, lineHeight: 1.4 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Rule />

      {/* ── Why the Name PONNA — quiet, small, near the bottom ─────────── */}
      <Section>
        <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.gold, margin: '0 0 8px' }}>Why the name PONNA?</p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: COLORS.inkMuted, fontStyle: 'italic', maxWidth: 520 }}>
          PONNA is a name with a personal family connection. The name was inspired by Ponnarasi, making PONNA more than
          just a brand name for us. It represents a personal connection behind our larger purpose — creating an
          affordable and useful platform that can support students in their educational and career journey.
        </p>
      </Section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <Section style={{ marginTop: 56, textAlign: 'center' }}>
        <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 700, color: COLORS.ink, margin: '0 0 8px' }}>
          Start Your Practice Today
        </h2>
        <p style={{ fontSize: 15, color: COLORS.inkMuted, marginBottom: 24 }}>Choose your examination, start practising, and keep improving.</p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '14px 32px',
            borderRadius: 8,
            background: COLORS.ink,
            color: COLORS.paper,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Start Practising
        </a>
      </Section>
      </main>
    </>
  );
}

// Minimal line icons, matching the ink/gold palette — no icon-library
// default glyphs.
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {children}
    </svg>
  );
}
function IconPaper() {
  return (
    <IconBase>
      <rect x="5" y="3" width="18" height="22" rx="1.5" stroke="#A8791F" strokeWidth="1.6" />
      <line x1="9" y1="9" x2="19" y2="9" stroke="#A8791F" strokeWidth="1.6" />
      <line x1="9" y1="14" x2="19" y2="14" stroke="#A8791F" strokeWidth="1.6" />
      <line x1="9" y1="19" x2="15" y2="19" stroke="#A8791F" strokeWidth="1.6" />
    </IconBase>
  );
}
function IconCap() {
  return (
    <IconBase>
      <path d="M14 5L25 10L14 15L3 10L14 5Z" stroke="#A8791F" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 12.5V18C8 18 10.5 20.5 14 20.5C17.5 20.5 20 18 20 18V12.5" stroke="#A8791F" strokeWidth="1.6" />
    </IconBase>
  );
}
function IconCheck() {
  return (
    <IconBase>
      <circle cx="14" cy="14" r="10.5" stroke="#A8791F" strokeWidth="1.6" />
      <path d="M9.5 14.2L12.5 17.2L18.5 10.8" stroke="#A8791F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}
function IconSteps() {
  return (
    <IconBase>
      <rect x="4" y="18" width="6" height="6" stroke="#A8791F" strokeWidth="1.6" />
      <rect x="11" y="12" width="6" height="12" stroke="#A8791F" strokeWidth="1.6" />
      <rect x="18" y="5" width="6" height="19" stroke="#A8791F" strokeWidth="1.6" />
    </IconBase>
  );
}
function IconClock() {
  return (
    <IconBase>
      <circle cx="14" cy="14" r="10.5" stroke="#A8791F" strokeWidth="1.6" />
      <path d="M14 8V14L18 17" stroke="#A8791F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}
function IconCoin() {
  return (
    <IconBase>
      <circle cx="14" cy="14" r="10.5" stroke="#A8791F" strokeWidth="1.6" />
      <path d="M14 9V19M11 17.2C11 18.5 12.3 19.3 14 19.3C15.9 19.3 17 18.4 17 17.1C17 14.5 11 15.5 11 12.9C11 11.6 12.1 10.7 14 10.7C15.5 10.7 16.6 11.3 16.9 12.4" stroke="#A8791F" strokeWidth="1.4" strokeLinecap="round" />
    </IconBase>
  );
}
function IconRefresh() {
  return (
    <IconBase>
      <path d="M22 14C22 18.4 18.4 22 14 22C10.7 22 7.9 20 6.7 17.1" stroke="#A8791F" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 14C6 9.6 9.6 6 14 6C17.3 6 20.1 8 21.3 10.9" stroke="#A8791F" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.7 12.5L6.7 17.1L11.3 17.1" stroke="#A8791F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.3 15.5L21.3 10.9L16.7 10.9" stroke="#A8791F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}
