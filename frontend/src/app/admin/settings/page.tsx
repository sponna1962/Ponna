'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Platform Settings — implements §7.7 (Repetition & Allocation Settings) plus
// the AI threshold and ranking eligibility settings. This page is the direct
// answer to "nothing should be hardcoded" from the requirements doc — every
// number here was a fixed constant in an earlier design and is now a live,
// admin-editable value. Super Admin only (backend enforces this too).

type Settings = {
  repetitionStrategy: string;
  repeatAfterDays: number | null;
  caMaxFor5Q: number;
  caMaxFor20Q: number;
  caMaxFor50Q: number;
  caRecencyWindowDays: number;
  aiConfidenceThreshold: number;
  rankingEligibilityMinQuestions: number;
  sessionInactivityHours: number;
  subjectTopicPreferenceWeightPercent: number;
  askPonnaEnabled: boolean;
  askPonnaProvider: string;
  askPonnaModel: string;
  askPonnaDailyLimitFree: number;
  askPonnaDailyLimitPaid: number;
  whatsappReminderEnabled: boolean;
  whatsappTemplateName: string;
  whatsappReminderInactivityDays: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('ponna_staff_role') === 'SUPER_ADMIN';

  useEffect(() => {
    adminFetch('/admin/settings').then((r) => r.json()).then(setSettings);
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const res = await adminFetch('/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (!res.ok) {
      setError('Failed to save. Only Super Admins can change settings.');
      return;
    }
    setSavedAt(Date.now());
  }

  if (!settings) return <p style={{ color: '#94a3b8' }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Settings</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        These values control platform-wide behavior directly — changes take effect immediately, no deployment needed.
        {!isSuperAdmin && ' (Viewing only — Super Admin role required to change these.)'}
      </p>

      <Section title="Question Repetition (§6.4)">
        <Field label="Strategy">
          <select
            value={settings.repetitionStrategy}
            onChange={(e) => update('repetitionStrategy', e.target.value)}
            disabled={!isSuperAdmin}
            style={selectStyle}
          >
            <option value="UNSEEN_FIRST_THEN_OLDEST">Unseen first, then least-recently-answered</option>
            <option value="REPEAT_AFTER_DAYS">Unseen first, then repeat after N days</option>
          </select>
        </Field>
        {settings.repetitionStrategy === 'REPEAT_AFTER_DAYS' && (
          <Field label="Repeat after (days)">
            <NumberInput value={settings.repeatAfterDays ?? 0} onChange={(v) => update('repeatAfterDays', v)} disabled={!isSuperAdmin} />
          </Field>
        )}
      </Section>

      <Section title="Current Affairs Allocation (§6.4)">
        <Field label="Max in a 5-question session">
          <NumberInput value={settings.caMaxFor5Q} onChange={(v) => update('caMaxFor5Q', v)} disabled={!isSuperAdmin} />
        </Field>
        <Field label="Max in a 20-question session">
          <NumberInput value={settings.caMaxFor20Q} onChange={(v) => update('caMaxFor20Q', v)} disabled={!isSuperAdmin} />
        </Field>
        <Field label="Max in a 50-question session">
          <NumberInput value={settings.caMaxFor50Q} onChange={(v) => update('caMaxFor50Q', v)} disabled={!isSuperAdmin} />
        </Field>
        <Field label="Recency window (days)">
          <NumberInput value={settings.caRecencyWindowDays} onChange={(v) => update('caRecencyWindowDays', v)} disabled={!isSuperAdmin} />
        </Field>
      </Section>

      <Section title="AI Classification (§9)">
        <Field label="Auto-publish confidence threshold (%)">
          <NumberInput value={settings.aiConfidenceThreshold} onChange={(v) => update('aiConfidenceThreshold', v)} disabled={!isSuperAdmin} />
        </Field>
      </Section>

      <Section title="Ranking (§8.1)">
        <Field label="Minimum questions answered to be ranked">
          <NumberInput value={settings.rankingEligibilityMinQuestions} onChange={(v) => update('rankingEligibilityMinQuestions', v)} disabled={!isSuperAdmin} />
        </Field>
      </Section>

      <Section title="Quiz Sessions (§4.3)">
        <Field label="Inactivity hours before a session is marked abandoned">
          <NumberInput value={settings.sessionInactivityHours} onChange={(v) => update('sessionInactivityHours', v)} disabled={!isSuperAdmin} />
        </Field>
      </Section>

      <Section title="Subject & Topic Preference — Stage 2 Allocation">
        <Field label="Preferred Subject/Topic weight (%)">
          <NumberInput value={settings.subjectTopicPreferenceWeightPercent} onChange={(v) => update('subjectTopicPreferenceWeightPercent', v)} disabled={!isSuperAdmin} />
        </Field>
      </Section>

      <Section title="Ask Ponna (Specification v3 — Gemini as initial provider)">
        <Field label="Enabled (Coming Soon toggle)">
          <input
            type="checkbox"
            checked={settings.askPonnaEnabled}
            disabled={!isSuperAdmin}
            onChange={(e) => update('askPonnaEnabled', e.target.checked)}
          />
        </Field>
        <Field label="Provider">
          <select value={settings.askPonnaProvider} onChange={(e) => update('askPonnaProvider', e.target.value)} disabled={!isSuperAdmin} style={selectStyle}>
            <option value="gemini">Gemini</option>
          </select>
        </Field>
        <Field label="Model">
          <input
            type="text"
            value={settings.askPonnaModel}
            disabled={!isSuperAdmin}
            onChange={(e) => update('askPonnaModel', e.target.value)}
            style={{ width: 220, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
        </Field>
        <Field label="Daily message limit — Free tier">
          <NumberInput value={settings.askPonnaDailyLimitFree} onChange={(v) => update('askPonnaDailyLimitFree', v)} disabled={!isSuperAdmin} />
        </Field>
        <Field label="Daily message limit — Paid tier">
          <NumberInput value={settings.askPonnaDailyLimitPaid} onChange={(v) => update('askPonnaDailyLimitPaid', v)} disabled={!isSuperAdmin} />
        </Field>
      </Section>

      <Section title="WhatsApp Daily Reminder (Meta WhatsApp Business Cloud API)">
        <Field label="Enabled">
          <input
            type="checkbox"
            checked={settings.whatsappReminderEnabled}
            disabled={!isSuperAdmin}
            onChange={(e) => update('whatsappReminderEnabled', e.target.checked)}
          />
        </Field>
        <Field label="Meta-approved template name">
          <input
            type="text"
            value={settings.whatsappTemplateName}
            disabled={!isSuperAdmin}
            onChange={(e) => update('whatsappTemplateName', e.target.value)}
            style={{ width: 220, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
        </Field>
        <Field label="Remind after this many inactive days">
          <NumberInput value={settings.whatsappReminderInactivityDays} onChange={(v) => update('whatsappReminderInactivityDays', v)} disabled={!isSuperAdmin} />
        </Field>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
          Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars on Render, and a template approved in Meta Business Manager matching the name above.
        </p>
      </Section>

      {isSuperAdmin && (
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: '10px 24px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', marginTop: 8 }}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      )}
      {savedAt && <span style={{ marginLeft: 12, fontSize: 13, color: '#16a34a' }}>Saved</span>}
      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
      <label style={{ color: '#334155' }}>{label}</label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <input
      type="number"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: 90, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }}
    />
  );
}

const selectStyle: React.CSSProperties = { padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 };
