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

type Message = { role: 'USER' | 'ASSISTANT'; content: string };

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
    if (context === 'mistakes') {
      setInput(t.askPonna.contextPrefillMistakes);
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
    setMessages((prev) => [...prev, { role: 'ASSISTANT', content: body.reply }]);
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
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, color: COLORS.inkMuted, textAlign: 'center', marginBottom: 16 }}>{t.askPonna.emptyState}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {t.askPonna.suggestedActions.map((action) => (
                <button
                  key={action}
                  onClick={() => send(action)}
                  disabled={sending}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${COLORS.line}`,
                    background: COLORS.paperAlt,
                    color: COLORS.ink,
                    fontSize: 13.5,
                    lineHeight: 1.4,
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'USER' ? 'flex-end' : 'flex-start',
              marginBottom: 10,
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
              {m.content}
            </div>
          </div>
        ))}
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
