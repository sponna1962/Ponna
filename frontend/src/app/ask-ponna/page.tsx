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
import { generateId } from '../../lib/generate-id';
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

/** Parses both markers independently so an assistant response can contain
 * a document-download button and clickable next-step options together. */
function parseOptions(content: string): { text: string; options: string[]; navigateTo: { path: string; label: string } | null } {
  let text = content;
  let options: string[] = [];
  let navigateTo: { path: string; label: string } | null = null;

  const navMatch = text.match(/\[\[NAVIGATE:\s*(.+?)\s*\|\s*(.+?)\]\]/);
  if (navMatch) {
    navigateTo = { path: navMatch[1].trim(), label: navMatch[2].trim() };
    text = text.replace(navMatch[0], '');
  }

  const optionsMatch = text.match(/\[\[OPTIONS:\s*(.+?)\]\]/);
  if (optionsMatch) {
    options = optionsMatch[1].split('|').map((o) => o.trim()).filter(Boolean);
    text = text.replace(optionsMatch[0], '');
  }

  return {
    text: text.replace(/\n{3,}/g, '\n\n').trim(),
    options,
    navigateTo,
  };
}

/** Cloudinary's fl_attachment delivery flag tells the CDN to return the PDF
 * as a download attachment instead of opening it in the browser/PDF viewer. */
function getDownloadHref(path: string): string {
  try {
    const url = new URL(path);
    if (url.hostname.includes('res.cloudinary.com')) {
      url.pathname = url.pathname.replace('/upload/', '/upload/fl_attachment/');
    }
    return url.toString();
  } catch {
    return path;
  }
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
  const [guestLanguage, setGuestLanguage] = useState<'TA' | 'EN'>('TA');
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
    setAccessState('available');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedEnabled, enabled]);

  function getOrCreateGuestId(): string {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  }

  async function sendGuest(tappedOption: string) {
    if (sending) return;
    setMessages((prev) => [...prev, { role: 'USER', content: tappedOption }]);
    setSending(true);
    setError(null);

    try {
      if (guestStage === 'language') {
        const language: 'TA' | 'EN' = tappedOption === 'English' ? 'EN' : 'TA';
        setGuestLanguage(language);
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
          setMessages((prev) => [
            ...prev,
            {
              role: 'ASSISTANT',
              content:
                guestLanguage === 'EN'
                  ? "🎉 You've completed all 20 questions!\n\nSign up to see your full Result and performance analysis.[[NAVIGATE: /?startLogin=1 | Sign up to see Result]]"
                  : '🎉 20 கேள்விகளையும் முடித்துவிட்டீர்கள்!\n\nஉங்கள் முழுமையான Result மற்றும் செயல்திறன் பகுப்பாய்வைப் பார்க்க பதிவு செய்யுங்கள்.[[NAVIGATE: /?startLogin=1 | Sign up செய்து Result பாருங்கள்]]',
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
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 0, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
        <BitterFontLinks />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'linear-gradient(180deg,var(--color-head1),var(--color-head2))', borderBottom: '3px solid #E2B04A', color: '#fff', flex: 'none' }}>
          <StudentMenu iconColor="#fff" />
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: '#E2B04A', color: '#2b1c00', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, boxShadow: '0 0 0 2px rgba(255,233,168,0.4)' }}>P</span>
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.askPonna.title}</h1>
      </div>
        <div style={{ padding: 16 }}>
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 28, textAlign: 'center', background: 'var(--color-card)' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.comingSoon}</p>
        </div>
        </div>
      </main>
    );
  }

  // Guest diagnostic (first-visit, not logged in): language choice and the
  // 20 questions are shown as a clean quiz card (same look as the Quiz page),
  // not as chat bubbles. The completion message falls through to the chat view.
  if (guestMode && (guestStage === 'language' || guestStage === 'quiz')) {
    const q = guestStage === 'quiz' ? guestQuestions[guestIndex] : null;
    const total = guestQuestions.length || 20;
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink, paddingBottom: 32 }}>
        <BitterFontLinks />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'linear-gradient(180deg,var(--color-head1),var(--color-head2))', borderBottom: '3px solid #E2B04A', color: '#fff' }}>
          <StudentMenu iconColor="#fff" />
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: '#E2B04A', color: '#2b1c00', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, boxShadow: '0 0 0 2px rgba(255,233,168,0.4)' }}>P</span>
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.askPonna.title}</h1>
        </div>
        <div style={{ padding: 16 }}>
          {error && <p style={{ color: COLORS.bad, fontSize: 13, marginBottom: 12 }}>{error}</p>}

          {guestStage === 'language' && (
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>உங்கள் பயிற்சிக்கான மொழியைத் தேர்வு செய்யுங்கள்</p>
              <div style={{ display: 'grid', gap: 12 }}>
                {['தமிழ்', 'English'].map((label) => (
                  <button key={label} disabled={sending} onClick={() => sendGuest(label)} style={{ padding: 17, borderRadius: 14, border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700, fontSize: 17, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
                    {sending ? '…' : label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 10 }}>
                {guestLanguage === 'EN' ? `Question ${guestIndex + 1} / ${total}` : `கேள்வி ${guestIndex + 1} / ${total}`}
              </div>
              <div style={{ height: 8, background: COLORS.line, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ height: '100%', width: `${((guestIndex + 1) / total) * 100}%`, background: 'linear-gradient(90deg,#E2B04A,#D99A1E)' }} />
              </div>
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 16, padding: 18, fontSize: q.questionText.length > 140 ? 16 : 17.5, fontWeight: 600, lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{q.questionText}</div>
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
                return (
                  <button key={letter} disabled={sending} onClick={() => sendGuest(letter)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${COLORS.line}`, background: COLORS.card, color: COLORS.ink, marginBottom: 10, fontSize: 15, lineHeight: 1.55, cursor: 'pointer', boxSizing: 'border-box', opacity: sending ? 0.6 : 1 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12.5, background: COLORS.field, border: `1.5px solid ${COLORS.line}`, color: COLORS.inkMuted }}>{letter}</span>
                    <span style={{ flex: 1 }}>{text}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 0, background: COLORS.paper, minHeight: '100dvh', display: 'flex', flexDirection: 'column', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'linear-gradient(180deg,var(--color-head1),var(--color-head2))', borderBottom: '3px solid #E2B04A', color: '#fff', flex: 'none' }}>
        <StudentMenu iconColor="#fff" />
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: '#E2B04A', color: '#2b1c00', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, boxShadow: '0 0 0 2px rgba(255,233,168,0.4)' }}>P</span>
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.askPonna.title}</h1>
      </div>

      {accessState === 'locked' && (
        <div style={{ border: `1px solid #E2B04A`, borderRadius: 16, padding: 24, background: COLORS.goldLight, textAlign: 'center', margin: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.askPonna.lockedTitle}</p>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginBottom: 16 }}>{t.askPonna.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 14, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', fontWeight: 700, fontSize: 14.5 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && accessState !== 'locked' && !guestMode && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: COLORS.inkMuted, marginBottom: 20 }}>{t.askPonna.emptyState}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'learnExam', icon: '🎯', label: 'தேர்வைப் பற்றி தெரிந்துகொள்ளுங்கள்', prompt: '🎯 தேர்வைப் பற்றி தெரிந்துகொள்ளுங்கள்' },
                { key: 'howToPrepare', icon: '📚', label: 'எப்படி தயாராக வேண்டும்?', prompt: '📚 எப்படி தயாராக வேண்டும்?' },
                { key: 'askAnything', icon: '💬', label: 'உங்கள் கேள்வியைக் கேளுங்கள்', prompt: '💬 உங்கள் கேள்வியைக் கேளுங்கள்' },
              ].map((flow) => (
                <button
                  key={flow.key}
                  onClick={() => send(flow.prompt)}
                  disabled={sending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '15px 16px',
                    borderRadius: 16,
                    border: `1px solid ${COLORS.line}`,
                    borderLeft: '5px solid #E2B04A',
                    background: 'var(--color-card)',
                    color: COLORS.ink,
                    fontSize: 15.5,
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-goldDisc)', display: 'grid', placeItems: 'center', fontSize: 19, flex: 'none' }}>{flow.icon}</span>
                  <span style={{ flex: 1 }}>{flow.label}</span>
                  <span aria-hidden="true" style={{ fontSize: 24, color: 'var(--color-gold)' }}>›</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 16 }}>{t.askPonna.orAskDirectly}</p>
            <p style={{ fontSize: 11.5, color: COLORS.inkMuted, marginTop: 20, lineHeight: 1.6, padding: '0 10px' }}>{t.askPonna.aiDisclaimer}</p>
          </div>
        )}
        {messages.map((m, i) => {
          const isLastAssistant = m.role === 'ASSISTANT' && i === messages.length - 1;
          const { text, options, navigateTo } = m.role === 'ASSISTANT' ? parseOptions(m.content) : { text: m.content, options: [], navigateTo: null };
          return (
            <div key={i} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: m.role === 'USER' ? 'flex-end' : 'flex-start',
                }}
              >
                {m.role !== 'USER' && (
                  <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: '#E2B04A', color: '#2b1c00', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, flex: 'none' }}>P</span>
                )}
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '12px 15px',
                    borderRadius: 18,
                    borderBottomRightRadius: m.role === 'USER' ? 5 : 18,
                    borderBottomLeftRadius: m.role === 'USER' ? 18 : 5,
                    fontSize: 15,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    background: m.role === 'USER' ? 'var(--color-btn)' : 'var(--color-card)',
                    border: m.role === 'USER' ? 'none' : `1px solid ${COLORS.line}`,
                    color: m.role === 'USER' ? 'var(--color-btnText)' : COLORS.ink,
                  }}
                >
                  {text}
                </div>
              </div>
              {m.role === 'ASSISTANT' &&
                m.toolCallsUsed?.some((t) =>
                  ['get_exam_info', 'get_exam_syllabus', 'get_exam_full_info', 'get_current_affairs', 'get_previous_cutoffs', 'get_ponna_faq'].includes(t),
                ) && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4, marginLeft: 38 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--color-ok)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ✓ {t.askPonna.verifiedBadge}
                  </span>
                </div>
              )}
              {m.role === 'ASSISTANT' && m.toolCallsUsed?.includes('search_current_info') && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4, marginLeft: 38 }}>
                  <span style={{ fontSize: 11.5, color: '#B4744A', fontWeight: 600 }}>🔍 {t.askPonna.liveSearchBadge}</span>
                </div>
              )}
              {isLastAssistant && options.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 38 }}>
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => send(opt)}
                      disabled={sending}
                      style={{
                        padding: '9px 15px',
                        borderRadius: 999,
                        border: '1.5px solid #E2B04A',
                        background: 'var(--color-card)',
                        color: COLORS.ink,
                        fontSize: 13.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {isLastAssistant && navigateTo && (
                <div style={{ marginTop: 8, marginLeft: 38 }}>
                  <a
                    href={getDownloadHref(navigateTo.path)}
                    download
                    style={{
                      display: 'inline-block',
                      padding: '11px 20px',
                      borderRadius: 999,
                      background: 'var(--color-btn)',
                      color: 'var(--color-btnText)',
                      fontSize: 13.5,
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
        {sending && <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginLeft: 38 }}>{t.askPonna.thinking}</p>}
        {error && <p style={{ fontSize: 13, color: 'var(--color-bad)' }}>{error}</p>}
        <div ref={bottomRef} />
      </div>

      {accessState !== 'locked' && !guestMode && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 14px 16px', background: COLORS.paper, borderTop: `1px solid ${COLORS.line}`, flex: 'none', position: 'sticky', bottom: 0 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={t.askPonna.inputPlaceholder}
            style={{ flex: 1, minWidth: 0, padding: '13px 16px', borderRadius: 999, border: `1.5px solid ${COLORS.line}`, background: 'var(--color-field)', color: COLORS.ink, fontSize: 15 }}
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            aria-label={t.askPonna.send}
            style={{ width: 48, height: 48, flex: 'none', borderRadius: '50%', border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontSize: 20, fontWeight: 700, opacity: sending || !input.trim() ? 0.5 : 1, cursor: 'pointer' }}
          >
            ➤
          </button>
        </div>
      )}
    </main>
  );
}
