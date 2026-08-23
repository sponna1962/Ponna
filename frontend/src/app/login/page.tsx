'use client';

import { useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { apiUrl } from '../../lib/api-config';

// Login page implementing §4.1 (Account — mobile OTP-based login) with §4.5
// language toggle wired in. NOTE: posts to /api/auth/* endpoints which are
// NOT yet implemented in the backend — see README for the OTP provider
// dependency. This page is wired for that flow already.

export default function LoginPage() {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setError(null);
    const res = await fetch(apiUrl('/auth/request-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      setError(t.login.sendError);
      return;
    }
    setOtpSent(true);
  }

  async function verifyOtp() {
    setError(null);
    const res = await fetch(apiUrl('/auth/verify-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    if (!res.ok) {
      setError(t.login.verifyError);
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <main style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.login.title}</h1>
        <LanguageToggle />
      </div>

      <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>{t.login.phoneLabel}</label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={otpSent}
        placeholder="9876543210"
        style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}
      />

      {otpSent && (
        <>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>{t.login.otpLabel}</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder={t.login.otpPlaceholder}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}
          />
        </>
      )}

      <button
        onClick={otpSent ? verifyOtp : requestOtp}
        style={{ width: '100%', padding: 14, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none' }}
      >
        {otpSent ? t.login.verify : t.login.sendOtp}
      </button>

      {error && <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p>}
    </main>
  );
}
