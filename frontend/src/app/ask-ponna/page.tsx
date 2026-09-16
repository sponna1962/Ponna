'use client';

// Ask Ponna — Personal AI Study & Exam Assistant (Specification v3,
// Phase 1). Simple chat UI, consistent with PONNA's existing design.
// Accepts an optional ?context=mistakes prefill from contextual buttons
// elsewhere (Review Mistakes today; Question page in a later pass) so the
// student never has to re-type what they're asking about.

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { apiUrl } from '../../lib/api-config';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

const GUEST_ID_KEY = 'ponna_guest_diagnostic_id';

type GuestQuestion = {
  sequenceNumber: number;
  questionId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

type Message = { role: 'USER' | 'ASSISTANT'; content: string; toolCallsUsed?: string[] };

/** Parses trailing "[[OPTIONS: a | b | c]]" (tappable choices sent as the
 * next chat message) and "[[NAVIGATE: /path | Button label]]" (a tappable
 * link that navigates the browser instead, used for e.g. handing off to
 * the dedicated /diagnostic quiz-taking page) markers the system prompt
 * instructs the AI to use — returns the message with any marker
 * stripped for display, plus whichever one was present (never both). */
function parseOptions(content: string): { text: string; options: string[]; navigateTo: { path: string; label: string } | null } {
  const navMatch = content.match(/\[\[NAVIGATE:\s*(.+?)\s*\|\s*(.+?)\]\]\s*$/);
  if (navMatch) {
    return { text: content.slice(0, navMatch.index).trim(), options: [], navigateTo: { path: navMatch[1].trim(), label: navMatch[2].trim() } };
  }
  const match = content.match(/\[\[OPTIONS:\s*(.+?)\]\]\s*$/);
  if (!match) return { text: content, options: [], navigateTo: null };
  return {
    text: content.slice(0, match.index).trim(),
    options: match[1].split('|').map((o) => o.trim()).filter(Boolean),
    navigateTo: null,
  };
}

export default function AskPonnaPage() {
  const { t } = useLanguage();
  const [checkedEnabled, setCheckedEnabled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [accessState, setAccessState] = useState<'checking' | 'locked' | 'available'>('checking');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sept 2026 (Item 4 — First-Visit TNPSC Group 4 Diagnostic Flow) —
  // guest mode is a SEPARATE, PARALLEL flow reusing this same page's
  // chat-bubble UI (so it looks and feels identical to real Ask Ponna),
  // but driven entirely by local state and the public guest-diagnostic
  // endpoints -- never calls the authenticated /ask-ponna/chat route or
  // touches its paid-access restriction at all, per the explicit
  // instruction to leave that rule untouched for normal use. Entered via
  // ?guestDiagnostic=1 from the Welcome Screen (/test-your-ability), and
  // only actually activates for a NOT-logged-in visitor -- an
  // already-logged-in student hitting this link just gets the normal
  // Ask Ponna page.
  const [guestMode, setGuestMode] = useState(false);
  const [guestStage, setGuestStage] = useState<'language' | 'quiz' | 'done'>('language');
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestSubCategoryId, setGuestSubCategoryId] = useState<string | null>(null);
  const [guestQuestions, setGuestQuestions] = useState<GuestQuestion[]>([]);
  const [guestIndex, setGuestIndex] = useState(0);

  useEffect(() => {
    fetch(apiUrl('/ask-ponna/enabled'))
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false))
      .finally(() => setCheckedEnabled(true));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !checkedEnabled || !enabled) return;
    const params = new URLSearchParams(window.location.search);
    const context = params.get('context');
    const prefill = params.get('prefill');
    const isLoggedIn = !!localStorage.getItem('ponna_student_token');

    // Sept 2026 (Item 4) — guest mode only actually activates for a
    // NOT-logged-in visitor; an already-logged-in student hitting this
    // same link (e.g. an old bookmark) just gets normal Ask Ponna,
    // since they don't need the signup-less path at all.
    if (params.get('guestDiagnostic') === '1' && !isLoggedIn) {
      setGuestMode(true);
      setMessages([
        { role: 'ASSISTANT', content: 'உங்கள் பயிற்சிக்கான மொழியைத் தேர்வு செய்யுங்கள்[[OPTIONS: தமிழ் | English]]' },
      ]);
      setAccessState('available');
      return;
    }

    if (context === 'mistakes') {
      setInput(t.askPonna.contextPrefillMistakes);
    } else if (prefill) {
      setInput(prefill);
    }
    setAccessState('available'); // access errors surface on first send instead — keeps this simple for Phase 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedEnabled, enabled]);

  function getOrCreateGuestId(): string {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  }

  /** Sept 2026 (Item 4) — the guest-mode equivalent of send() below,
   * driving the local language-selection -> 15-question state machine.
   * Never calls the authenticated /ask-ponna/chat route. */
  async function sendGuest(tappedOption: string) {
    if (sending) return;
    setMessages((prev) => [...prev, { role: 'USER', content: tappedOption }]);
    setSending(true);
    setError(null);

    try {
      if (guestStage === 'language') {
        const language: 'TA' | 'EN' = tappedOption === 'English' ? 'EN' : 'TA';
        const examRes = await fetch(apiUrl('/public/primary-exam'));
        const exam = await examRes.json().catch(() => null);
        if (!examRes.ok || !exam?.id) throw new Error('No exam is currently available.');
        setGuestSubCategoryId(exam.id);

        const id = getOrCreateGuestId();
        setGuestId(id);
        const startRes = await fetch(apiUrl('/guest-diagnostic/start'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: id, subCategoryId: exam.id, language }),
        });
        if (!startRes.ok) {
          const body = await startRes.json().catch(() => ({}));
          throw new Error(body.error ?? 'Failed to start');
        }
        const qRes = await fetch(apiUrl(`/guest-diagnostic/${id}/questions`));
        const questions: GuestQuestion[] = await qRes.json();
        if (!qRes.ok || questions.length === 0) throw new Error('Failed to load questions');

        setGuestQuestions(questions);
        setGuestIndex(0);
        setGuestStage('quiz');
        appendQuestionMessage(questions[0], 1, questions.length);
        return;
      }

      if (guestStage === 'quiz') {
        const q = guestQuestions[guestIndex];
        const letterMatch = tappedOption.match(/^([A-D])\)/);
        const letter = letterMatch ? letterMatch[1] : tappedOption;

        // Sept 2026 (explicit requirement) — the diagnostic never reveals
        // correct/wrong per question; the answer is still saved and
        // compared server-side (submitAnswer's own isCorrect
        // computation, unchanged), just never shown here. The student
        // sees only Question -> Select Answer -> Next Question.
        await fetch(apiUrl(`/guest-diagnostic/${guestId}/answer`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: q.questionId, selectedOption: letter }),
        });

        const nextIndex = guestIndex + 1;
        if (nextIndex < guestQuestions.length) {
          setGuestIndex(nextIndex);
          appendQuestionMessage(guestQuestions[nextIndex], nextIndex + 1, guestQuestions.length);
        } else {
          if (guestId) await fetch(apiUrl(`/guest-diagnostic/${guestId}/complete`), { method: 'POST' });
          setGuestStage('done');
          // Sept 2026 (explicit requirement) — no score/accuracy/correct-
          // vs-wrong reveal here either; only signup unlocks the full
          // report.
          setMessages((prev) => [
            ...prev,
            {
              role: 'ASSISTANT',
              content:
                '🎉 15 கேள்விகளையும் முடித்துவிட்டீர்கள்!\n\nஉங்கள் முழுமையான Result மற்றும் செயல்திறன் பகுப்பாய்வைப் பார்க்க பதிவு செய்யுங்கள்.[[NAVIGATE: / | Sign up செய்து Result பாருங்கள்]]',
            },
          ]);
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'ஏதோ தப்பு நடந்தது.');
    } finally {
      setSending(false);
    }
  }

  function appendQuestionMessage(q: GuestQuestion, num: number, total: number) {
    const optionsLine = `[[OPTIONS: A) ${q.optionA} | B) ${q.optionB} | C) ${q.optionC} | D) ${q.optionD}]]`;
    setMessages((prev) => [...prev, { role: 'ASSISTANT', content: `கேள்வி ${num} / ${total}\n\n${q.questionText}${optionsLine}` }]);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(overrideText?: string) {
    const toSend = overrideText ?? input;
    if (!toSend.trim() || sending) return;
    // Sept 2026 (Item 4) — guest mode branches off entirely here, before
    // any input-clearing/message-pushing happens in this function (that
    // work is done inside sendGuest() itself) — never touches
    // /ask-ponna/chat or its access restriction.
    if (guestMode) {
      await sendGuest(toSend.trim());
      return;
    }
    const userMessage = toSend.trim();
    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'USER', content: userMessage }]);
    setSending(true);

    const res = await studentFetch('/ask-ponna/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, message: userMessage }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setAccessState('locked');
        return;
      }
      setError(body.error ?? t.askPonna.sendError);
      return;
    }

    const body = await res.json();
    setConversationId(body.conversationId);
    setMessages((prev) => [...prev, { role: 'ASSISTANT', content: body.reply, toolCallsUsed: body.toolCallsUsed }]);
  }

  if (!checkedEnabled) return null;

  if (!enabled) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
        <BitterFontLinks />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <StudentMenu />
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.askPonna.title}</h1>
        </div>
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.comingSoon}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', display: 'flex', flexDirection: 'column', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.askPonna.title}</h1>
      </div>

      {accessState === 'locked' && (
        <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 14, padding: 24, background: COLORS.goldLight, textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.askPonna.lockedTitle}</p>
          <p style={{ fontSize: 13, color: '#5C4009', marginBottom: 16 }}>{t.askPonna.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
        {messages.length === 0 && accessState !== 'locked' && !guestMode && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 18 }}>{t.askPonna.emptyState}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                // Scoped exception (explicit instruction) — these four
                // labels are hardcoded Tamil regardless of the site-wide
                // English-only UI language, unlike every other string on
                // this page which still goes through t.askPonna.* as usual.
                { key: 'learnExam', label: '🎯 தேர்வைப் பற்றி தெரிந்துகொள்ளுங்கள்', prompt: '🎯 தேர்வைப் பற்றி தெரிந்துகொள்ளுங்கள்' },
                { key: 'howToPrepare', label: '📚 எப்படி தயாராக வேண்டும்?', prompt: '📚 எப்படி தயாராக வேண்டும்?' },
                { key: 'askAnything', label: '💬 உங்கள் கேள்வியைக் கேளுங்கள்', prompt: '💬 உங்கள் கேள்வியைக் கேளுங்கள்' },
              ].map((flow) => (
                <button
                  key={flow.key}
                  onClick={() => send(flow.prompt)}
                  disabled={sending}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 12,
                    border: `1px solid ${COLORS.line}`,
                    background: COLORS.paperAlt,
                    color: COLORS.ink,
                    fontSize: 14.5,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  {flow.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 16 }}>{t.askPonna.orAskDirectly}</p>
            <p style={{ fontSize: 10.5, color: COLORS.inkMuted, marginTop: 20, opacity: 0.75, lineHeight: 1.5 }}>{t.askPonna.aiDisclaimer}</p>
          </div>
        )}
        {messages.map((m, i) => {
          const isLastAssistant = m.role === 'ASSISTANT' && i === messages.length - 1;
          const { text, options, navigateTo } = m.role === 'ASSISTANT' ? parseOptions(m.content) : { text: m.content, options: [], navigateTo: null };
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'USER' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    background: m.role === 'USER' ? COLORS.ink : COLORS.paperAlt,
                    color: m.role === 'USER' ? COLORS.paper : COLORS.ink,
                  }}
                >
                  {text}
                </div>
              </div>
              {/* Trust badge (finalized requirement — world-class polish):
                  shows when this reply was actually grounded in PONNA's
                  verified exam data, not just the AI's own knowledge —
                  a visible signal, not just a design principle in code
                  comments. Derived from real tool-call usage, never
                  something the AI has to remember to say itself. */}
              {m.role === 'ASSISTANT' &&
                m.toolCallsUsed?.some((t) =>
                  ['get_exam_info', 'get_exam_syllabus', 'get_exam_full_info', 'get_current_affairs', 'get_previous_cutoffs', 'get_ponna_faq'].includes(t),
                ) && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ✓ {t.askPonna.verifiedBadge}
                  </span>
                </div>
              )}
              {/* Tier 3 (live search) indicator -- small, distinct from the
                  Tier 1 verified badge above, per Spec v6 Refinement 3:
                  clearly distinguished but never a large warning block. */}
              {m.role === 'ASSISTANT' && m.toolCallsUsed?.includes('search_current_info') && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: '#B4744A', fontWeight: 600 }}>🔍 {t.askPonna.liveSearchBadge}</span>
                </div>
              )}
              {/* Tappable quick-reply options — only offered while this is
                  still the latest assistant message, so tapping an older
                  message's options never re-derails an already-moved-on
                  conversation. */}
              {isLastAssistant && options.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => send(opt)}
                      disabled={sending}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 20,
                        border: `1px solid ${COLORS.gold}`,
                        background: COLORS.paper,
                        color: '#5C4009',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {isLastAssistant && navigateTo && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={navigateTo.path}
                    style={{
                      display: 'inline-block',
                      padding: '10px 18px',
                      borderRadius: 20,
                      background: COLORS.ink,
                      color: COLORS.paper,
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    {navigateTo.label}
                  </a>
                </div>
              )}
            </div>
          );
        })}
        {sending && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>{t.askPonna.thinking}</p>}
        {error && <p style={{ fontSize: 13, color: '#B4544A' }}>{error}</p>}
        <div ref={bottomRef} />
      </div>

      {accessState !== 'locked' && !guestMode && (
        <div style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={t.askPonna.inputPlaceholder}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.line}`, fontSize: 14 }}
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: COLORS.ink, color: COLORS.paper, fontWeight: 600 }}
          >
            {t.askPonna.send}
          </button>
        </div>
      )}
    </main>
  );
}
