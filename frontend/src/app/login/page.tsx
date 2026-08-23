'use client';

import { useState, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { apiUrl } from '../../lib/api-config';

// Login page implementing §4.1 (Account — mobile OTP-based login) using
// Firebase Phone Auth. Firebase's client SDK sends/verifies the OTP directly
// with Google's servers (via an invisible reCAPTCHA) — our backend is only
// involved AFTER Firebase confirms the phone number, to verify that result
// and issue our own session JWT (see student-auth.service.ts).

export default function LoginPage() {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      // A fresh RecaptchaVerifier is created per attempt — reusing a stale
      // one across retries is a common source of confusing Firebase errors.
      const verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current!, {
        size: 'invisible',
      });
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`; // defaults to India country code
      confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, fullPhone, verifier);
      setOtpSent(true);
    } catch (err) {
      console.error(err);
      setError(t.login.sendError);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      if (!confirmationRef.current) throw new Error('No OTP request in progress');
      const credential = await confirmationRef.current.confirm(otp);
      const firebaseIdToken = await credential.user.getIdToken();

      // Now exchange the verified Firebase token for our own session JWT.
      const res = await fetch(apiUrl('/auth/firebase-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken }),
      });
      if (!res.ok) throw new Error('Backend login failed');

      const { token } = await res.json();
      localStorage.setItem('ponna_student_token', token);
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
      setError(t.login.verifyError);
    } finally {
      setLoading(false);
    }
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

      {/* Invisible reCAPTCHA anchor required by Firebase — renders nothing visible */}
      <div ref={recaptchaContainerRef} />

      <button
        onClick={otpSent ? verifyOtp : requestOtp}
        disabled={loading || !phone}
        style={{ width: '100%', padding: 14, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none' }}
      >
        {loading ? '…' : otpSent ? t.login.verify : t.login.sendOtp}
      </button>

      {error && <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p>}
    </main>
  );
}
