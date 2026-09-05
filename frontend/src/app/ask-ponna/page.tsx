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
    if (context === 'mistakes') {
      setInput(t.askPonna.contextPrefillMistakes);
    } else if (prefill) {
      setInput(prefill);
    }
    setAccessState('available'); // access errors surface on first send instead — keeps this simple for Phase 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedEnabled, enabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(overrideText?: string) {
    const toSend = overrideText ?? input;
    if (!toSend.trim() || sending) return;
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
        {messages.length === 0 && accessState !== 'locked' && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 18 }}>{t.askPonna.emptyState}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                // Scoped exception (explicit instruction) — these four
                // labels are hardcoded Tamil regardless of the site-wide
                // English-only UI language, unlike every other string on
                // this page which still goes through t.askPonna.* as usual.
                { key: 'learnExam', label: '🎯 தேர்வைப் பற்றி தெரிந்துகொள்ளுங்கள்', prompt: '🎯 தேர்வைப் பற்றி தெரிந்துகொள்ளுங்கள்' },
                { key: 'suitableExam', label: '👤 உங்களுக்கு ஏற்ற தேர்வைக் கண்டறியுங்கள்', prompt: '👤 உங்களுக்கு ஏற்ற தேர்வைக் கண்டறியுங்கள்' },
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

      {accessState !== 'locked' && (
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
