'use client';

import { useState, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup, GoogleAuthProvider, ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { apiUrl } from '../../lib/api-config';

// Login page — finalized: two passwordless methods, Continue with Google
// (primary) and Continue with Phone (secondary, existing Firebase Phone OTP
// flow, unchanged below). No password field, no email OTP/magic-link field
// anywhere — Email stays Profile information only, never a login credential.
//
// Account linking (finalized requirement): the Firebase uid is the ONE
// canonical identity key server-side (see student-auth.service.ts) — a
// Google sign-in whose email matches an existing Phone-only account is
// NEVER auto-merged; it comes back as a 409 ACCOUNT_LINKING_CONFLICT,
// handled below by guiding the student to log in with Phone instead and
// link Google from their Profile (the secure, explicitly-authenticated
// linking flow, not a same-email guess).

type Method = 'choose' | 'phone';

export default function LoginPage() {
  const { t } = useLanguage();
  const [method, setMethod] = useState<Method>('choose');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const firebaseIdToken = await credential.user.getIdToken();

      const res = await fetch(apiUrl('/auth/firebase-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'ACCOUNT_LINKING_CONFLICT') {
          // Deliberately NOT auto-merged server-side (finalized requirement)
          // — direct the student to the secure, authenticated linking flow
          // instead of guessing based on a matching email.
          setError(t.login.linkingConflict);
          return;
        }
        throw new Error(body.error ?? 'Google sign-in failed');
      }

      const { token } = await res.json();
      localStorage.setItem('ponna_student_token', token);
      window.location.href = '/home';
    } catch (err: any) {
      // A closed/cancelled popup isn't a real error worth alarming over.
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      console.error(err);
      setError(err.message ?? t.login.sendError);
    } finally {
      setLoading(false);
    }
  }

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
      window.location.href = '/home';
    } catch (err) {
      console.error(err);
      setError(t.login.verifyError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.login.title}</h1>
        <LanguageToggle />
      </div>

      {method === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: 14,
              borderRadius: 8,
              background: '#fff',
              color: '#1f2937',
              border: '1px solid #cbd5e1',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            <GoogleIcon />
            {t.login.continueWithGoogle}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 13 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            {t.login.or}
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <button
            onClick={() => {
              setError(null);
              setMethod('phone');
            }}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 8,
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            📱 {t.login.continueWithPhone}
          </button>

          {error && <p style={{ color: '#64748b', marginTop: 4, fontSize: 13, textAlign: 'center' }}>{error}</p>}
        </div>
      )}

      {method === 'phone' && (
        <>
          <button
            onClick={() => {
              setMethod('choose');
              setError(null);
              setOtpSent(false);
              setOtp('');
            }}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, padding: 0, marginBottom: 16, cursor: 'pointer' }}
          >
            {t.login.back}
          </button>

          <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>{t.login.phoneLabel}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={otpSent}
            placeholder="9876543210"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12, boxSizing: 'border-box' }}
          />

          {otpSent && (
            <>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>{t.login.otpLabel}</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t.login.otpPlaceholder}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12, boxSizing: 'border-box' }}
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
        </>
      )}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.95H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
