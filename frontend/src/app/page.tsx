'use client';

// Root index page — the ONE "front page" of the app (finalized requirement:
// no separate /login or /home route, and the SAME rich layout — ☰ menu,
// PONNA.in brand, "வெற்றியின் முதல் படி" headline, pitch, Start Practising —
// is the very first thing shown whether or not the visitor is logged in.
// Only two things vary by login state:
//   - top-right: "Login" button (logged out) vs account icon + Logout
//     dropdown (logged in)
//   - the Active Plans summary block (logged-in only)
//
// Tapping "Login" or "Start Practising" while logged out swaps the BODY
// (header stays put) to the Google/Phone choice, and then the Phone OTP
// sub-flow — all still on this one page, no navigation. Logged in,
// "Start Practising" goes straight to /quiz.
//
// No language toggle anywhere on this page (finalized requirement) — pitch
// and CTAs are shown bilingually instead. Language becomes a student
// choice only inside Practice Preference Setup.
//
// Account linking (finalized requirement): the Firebase uid is the ONE
// canonical identity key server-side (see student-auth.service.ts) — a
// Google sign-in whose email matches an existing Phone-only account is
// NEVER auto-merged; it comes back as a 409 ACCOUNT_LINKING_CONFLICT,
// handled below by guiding the student to log in with Phone instead and
// link Google from their Profile (the secure, explicitly-authenticated
// linking flow, not a same-email guess).

import { useEffect, useState, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup, GoogleAuthProvider, ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { useLanguage } from '../lib/language-context';
import { apiUrl } from '../lib/api-config';
import { studentFetch } from '../lib/student-fetch';
import { getDeviceId, getDeviceLabel } from '../lib/device-id';
import { StudentMenu } from '../components/StudentMenu';
import { LogoutIcon, ProfileIcon, DevicesIcon } from '../components/icons';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../lib/brand-theme';
import { daysRemaining, shouldShowRemainingDays, formatValidUntil } from '../lib/pass-validity';

type View = 'main' | 'chooseMethod' | 'phone' | 'deviceLimit';
type ActiveSubscription = { id: string; cycleEnd: string; validUntil: string; plan: { name: string; nameTa: string | null } };
type DeviceInfo = { deviceId: string; label: string | null; lastSeenAt: string };

export default function IndexPage() {
  const { t } = useLanguage();

  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<View>('main');

  // Login-flow state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Device-limit-reached flow — the pending Firebase token (so we can
  // retry the exact same login after a device is removed) and the
  // existing devices to offer for removal.
  const [pendingFirebaseToken, setPendingFirebaseToken] = useState<string | null>(null);
  const [existingDevices, setExistingDevices] = useState<DeviceInfo[]>([]);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Logged-in extras
  const [activeSubs, setActiveSubs] = useState<ActiveSubscription[] | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<{ questionsAnswered: number; timeSpentMinutes: number; currentStreak: number } | null>(null);
  const [weakArea, setWeakArea] = useState<{ subCategoryId: string; subjectId: string; subjectName: string; accuracy: number; overallAccuracy: number; sampleSize: number } | null>(null);
  const [settingWeakAreaPractice, setSettingWeakAreaPractice] = useState(false);
  const [examCountdown, setExamCountdown] = useState<{ subCategoryId: string; subCategoryName: string; examDate: string; daysRemaining: number } | null>(null);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'google' | null>(null);
  const [headerPhotoUrl, setHeaderPhotoUrl] = useState<string | null>(null);
  const [showDiagnosticPrompt, setShowDiagnosticPrompt] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggedOutElsewhere, setLoggedOutElsewhere] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ponna_student_token') : null;
    setIsLoggedIn(!!token);
    setCheckedAuth(true);
    // Single-active-session enforcement (finalized requirement) —
    // student-fetch.ts stashes this right before redirecting here when a
    // request came back 401/SESSION_INVALIDATED, since nothing in memory
    // survives that full-page redirect.
    if (typeof window !== 'undefined' && sessionStorage.getItem('ponna_logout_reason') === 'SESSION_INVALIDATED') {
      setLoggedOutElsewhere(true);
      sessionStorage.removeItem('ponna_logout_reason');
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    studentFetch('/students/me/subscriptions')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setActiveSubs(Array.isArray(data) ? data : []))
      .catch(() => setActiveSubs([]));
    studentFetch('/students/me/monthly-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMonthlySummary)
      .catch(() => setMonthlySummary(null));
    studentFetch('/students/me/weak-area')
      .then((r) => (r.ok ? r.json() : null))
      .then(setWeakArea)
      .catch(() => setWeakArea(null));
    studentFetch('/students/me/exam-countdown')
      .then((r) => (r.ok ? r.json() : null))
      .then(setExamCountdown)
      .catch(() => setExamCountdown(null));
    studentFetch('/students/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setLoginMethod(data?.phone ? 'phone' : data?.email ? 'google' : null);
        setHeaderPhotoUrl(data?.photoUrl ?? null);
      })
      .catch(() => {});
    studentFetch('/diagnostic/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setShowDiagnosticPrompt(s?.access === 'NOT_STARTED'))
      .catch(() => {});
  }, [isLoggedIn]);

  function completeLogin(token: string) {
    localStorage.setItem('ponna_student_token', token);
    setIsLoggedIn(true);
    setView('main');
  }

  /** Shared by both Google and Phone sign-in — sends the persisted device
   * id along with the Firebase token (finalized requirement: 2-device cap
   * + single-active-session). Handles the DEVICE_LIMIT_REACHED response by
   * switching to a small inline "remove a device to continue" view,
   * keeping the Firebase token so the same login can be retried right
   * after a device is removed — no need to sign in with Google/OTP again. */
  async function attemptLogin(firebaseIdToken: string) {
    // Referral Program (finalized requirement) — captured once from the
    // URL (?ref=CODE), only actually used server-side for a genuinely
    // NEW signup (recordReferralIfPresent no-ops for an existing login),
    // so sending it here on every login attempt is harmless.
    const referralCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;
    const res = await fetch(apiUrl('/auth/firebase-login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseIdToken, deviceId: getDeviceId(), deviceLabel: getDeviceLabel(), referralCode }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.code === 'ACCOUNT_LINKING_CONFLICT') {
        setError(t.login.linkingConflict);
        setLoading(false);
        return;
      }
      if (body.code === 'DEVICE_LIMIT_REACHED') {
        setPendingFirebaseToken(firebaseIdToken);
        setExistingDevices(body.devices ?? []);
        setView('deviceLimit');
        setLoading(false);
        return;
      }
      setError(body.error ?? t.login.sendError);
      setLoading(false);
      return;
    }
    const { token } = await res.json();
    completeLogin(token);
    setLoading(false);
  }

  async function removeDeviceAndRetry(deviceId: string) {
    if (!pendingFirebaseToken) return;
    setRemovingDeviceId(deviceId);
    setError(null);
    try {
      await fetch(apiUrl('/auth/remove-device'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken: pendingFirebaseToken, deviceId }),
      });
      setLoading(true);
      await attemptLogin(pendingFirebaseToken);
    } catch (err) {
      console.error(err);
      setError(t.login.sendError);
    } finally {
      setRemovingDeviceId(null);
    }
  }

  function logout() {
    localStorage.removeItem('ponna_student_token');
    setIsLoggedIn(false);
    setActiveSubs(null);
    setMonthlySummary(null);
    setWeakArea(null);
    setExamCountdown(null);
    setLoginMethod(null);
    setAccountMenuOpen(false);
    setView('main');
  }

  function openLogin() {
    setError(null);
    setView('chooseMethod');
  }

  function handleStartPractising() {
    if (isLoggedIn) {
      window.location.href = '/quiz';
    } else {
      openLogin();
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const firebaseIdToken = await credential.user.getIdToken();
      await attemptLogin(firebaseIdToken);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      console.error(err);
      setError(err.message ?? t.login.sendError);
      setLoading(false);
    }
  }

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      const verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current!, { size: 'invisible' });
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
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
      await attemptLogin(firebaseIdToken);
    } catch (err) {
      console.error(err);
      setError(t.login.verifyError);
      setLoading(false);
    }
  }

  if (!checkedAuth) return null;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: COLORS.paper, color: COLORS.ink }}>
      <BitterFontLinks />
      {/* Header — identical whether logged in or not; only the top-right
          element changes. Always present, on every view of this page. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <strong style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 700, color: COLORS.ink }}>PONNA.in</strong>
        </div>

        {isLoggedIn ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAccountMenuOpen((o) => !o)}
              aria-label="Account"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: `1px solid ${COLORS.line}`,
                background: COLORS.paper,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 16,
                overflow: 'hidden',
                padding: 0,
              }}
            >
              {headerPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headerPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : loginMethod === 'google' ? (
                <GoogleIcon />
              ) : (
                '📱'
              )}
            </button>

            {accountMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 44,
                  background: COLORS.paper,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(26,34,56,0.12)',
                  minWidth: 170,
                  zIndex: 10,
                  overflow: 'hidden',
                }}
              >
                <a
                  href="/profile"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14, color: COLORS.ink, textDecoration: 'none' }}
                >
                  <ProfileIcon size={16} color={COLORS.gold} /> {t.menu.profile}
                </a>
                <a
                  href="/devices"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 14, color: COLORS.ink, textDecoration: 'none' }}
                >
                  <DevicesIcon size={16} color={COLORS.gold} /> {t.menu.devices}
                </a>
                <div style={{ borderTop: `1px solid ${COLORS.line}` }} />
                <button
                  onClick={logout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: 14,
                    color: '#B4544A',
                    cursor: 'pointer',
                  }}
                >
                  <LogoutIcon size={16} color="#B4544A" /> {t.menu.logout}
                </button>
              </div>
            )}
          </div>
        ) : (
          view === 'main' && (
            <button
              onClick={openLogin}
              style={{ padding: '8px 18px', borderRadius: 20, border: `1px solid ${COLORS.line}`, background: COLORS.paper, color: COLORS.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {t.index.login}
            </button>
          )
        )}
      </div>

      {/* Body — one of three views. 'main' looks identical logged-in or
          logged-out except for the Active Plans block. */}
      {view === 'main' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          {loggedOutElsewhere && (
            <div style={{ background: COLORS.goldLight, border: `1px solid ${COLORS.gold}`, borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13, color: '#5C4009' }}>
              {t.login.sessionInvalidated}
            </div>
          )}
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 27, fontWeight: 800, lineHeight: 1.3, marginBottom: 4, whiteSpace: 'pre-line', color: COLORS.ink }}>
            வெற்றியின்{'\n'}முதல் படி.
          </h1>
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginBottom: 16, whiteSpace: 'pre-line', color: COLORS.gold }}>
            The first step{'\n'}to success.
          </h1>

          <p style={{ fontSize: 15, color: COLORS.inkMuted, marginBottom: 4, lineHeight: 1.5 }}>
            போட்டித் தேர்வுகள் மற்றும் நுழைவுத் தேர்வுகளுக்கான பயிற்சி இணையதளம்.
          </p>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, marginBottom: 20, lineHeight: 1.5 }}>
            A practice platform for competitive and entrance exam aspirants.
          </p>

          {isLoggedIn && showDiagnosticPrompt && (
            <a
              href="/ask-ponna"
              style={{ display: 'block', border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 20, textDecoration: 'none', background: COLORS.paperAlt }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>🎯 {t.askPonna.examPrepButton}</p>
              <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: 0 }}>{t.index.askPonnaPromptBody}</p>
            </a>
          )}

          {isLoggedIn && activeSubs && activeSubs.length > 0 && (
            <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 10, padding: 12, marginBottom: 20, background: COLORS.goldLight }}>
              <p style={{ fontSize: 11, color: '#7A5A14', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                செயலில் உள்ள திட்டங்கள் / Active Plans
              </p>
              {activeSubs.map((s) => {
                const showDays = shouldShowRemainingDays(s.validUntil);
                const days = daysRemaining(s.validUntil);
                return (
                  <div key={s.id} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                      <span style={{ color: COLORS.ink, fontWeight: 600 }}>{s.plan.name}</span>
                      <span style={{ color: COLORS.inkMuted, whiteSpace: 'nowrap' }}>Valid until {formatValidUntil(s.validUntil)}</span>
                    </div>
                    {showDays && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: days <= 7 ? '#B91C1C' : '#92400E', marginTop: 1 }}>
                        {days} {days === 1 ? 'day' : 'days'} remaining
                      </div>
                    )}
                  </div>
                );
              })}
              <a href="/plans" style={{ display: 'inline-block', marginTop: 4, fontSize: 12, fontWeight: 700, color: '#7A5A14', textDecoration: 'none' }}>
                View Plan →
              </a>
            </div>
          )}

          {/* Sept 2026 — Exam Countdown (Personalization). Only shown once
              admin has confirmed the actual exam date for the student's
              selected exam — see exam-countdown.service.ts's own comment
              on why VerifiedExamFact's free-text date isn't used here. */}
          {isLoggedIn && examCountdown && (
            <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 10, padding: 12, marginBottom: 20, background: COLORS.goldLight, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#7A5A14', margin: '0 0 2px', fontWeight: 600 }}>{examCountdown.subCategoryName}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#5C4009', margin: 0, fontFamily: FONT_FAMILY }}>
                இன்னும் {examCountdown.daysRemaining} நாட்கள்
              </p>
            </div>
          )}

          {/* Sept 2026 — "this month" effort summary (world-class-polish
              quick win): makes invisible practice effort visible, so a
              paying student can see what they're actually getting.
              Purely a read of existing activity data — no new tracking,
              doesn't affect quota/streak/ranking. Only shown once there's
              something to show (avoids an empty "0 questions" card for a
              brand-new student). */}
          {isLoggedIn && monthlySummary && monthlySummary.questionsAnswered > 0 && (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12, marginBottom: 20, background: COLORS.paperAlt }}>
              <p style={{ fontSize: 11, color: COLORS.inkMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                இந்த மாதம் / This Month
              </p>
              <p style={{ fontSize: 14, color: COLORS.ink, fontWeight: 600, margin: 0 }}>
                {monthlySummary.questionsAnswered} கேள்விகள் · {monthlySummary.timeSpentMinutes} நிமிடங்கள்
                {monthlySummary.currentStreak > 0 && <> · {monthlySummary.currentStreak} நாள் streak</>}
              </p>
            </div>
          )}

          {/* Sept 2026 — Weak-Area Alert (BINDING, careful design — see
              weak-area.service.ts's own header comment for the sample-
              size/relative-gap rules that keep this from being a noisy,
              misleading signal for a first-time/rural student). Practice
              Now sets Subject Preference for this one weakest Subject
              (reusing the existing feature, not a new mechanism), then
              goes straight to Start Practice. */}
          {isLoggedIn && weakArea && (
            <div style={{ border: '1px solid #F3D9A8', borderRadius: 10, padding: 12, marginBottom: 20, background: '#FFF8EC' }}>
              <p style={{ fontSize: 11, color: '#92400E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                கவனிக்க வேண்டிய பகுதி / Weak Area
              </p>
              <p style={{ fontSize: 14, color: COLORS.ink, margin: '0 0 10px', lineHeight: 1.5 }}>
                <strong>{weakArea.subjectName}</strong>-ல் உங்க accuracy {weakArea.accuracy}% (overall {weakArea.overallAccuracy}%).
              </p>
              <button
                disabled={settingWeakAreaPractice}
                onClick={async () => {
                  setSettingWeakAreaPractice(true);
                  await studentFetch(`/subject-preference/${weakArea.subCategoryId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subjectIds: [weakArea.subjectId], topicIds: [] }),
                  });
                  window.location.href = '/quiz';
                }}
                style={{ padding: '9px 16px', borderRadius: 8, background: '#92400E', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                {settingWeakAreaPractice ? '...' : 'இப்போ Practice பண்ணுங்க'}
              </button>
            </div>
          )}

          <button
            onClick={handleStartPractising}
            style={{ display: 'block', width: '100%', textAlign: 'center', padding: 16, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
          >
            பயிற்சியைத் தொடங்குங்கள் / Start Practising
          </button>
        </div>
      )}

      {view === 'chooseMethod' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: '0 0 32px', color: COLORS.ink }}>{t.login.title}</h1>

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
                background: COLORS.paper,
                color: COLORS.ink,
                border: `1px solid ${COLORS.line}`,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <GoogleIcon size={18} />
              {t.login.continueWithGoogle}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: COLORS.inkMuted, fontSize: 13 }}>
              <div style={{ flex: 1, height: 1, background: COLORS.line }} />
              {t.login.or}
              <div style={{ flex: 1, height: 1, background: COLORS.line }} />
            </div>

            <button
              onClick={() => {
                setError(null);
                setView('phone');
              }}
              style={{ width: '100%', padding: 14, borderRadius: 8, background: COLORS.ink, color: COLORS.paper, border: 'none', fontSize: 15, fontWeight: 600 }}
            >
              📱 {t.login.continueWithPhone}
            </button>

            {error && <p style={{ color: COLORS.inkMuted, marginTop: 4, fontSize: 13, textAlign: 'center' }}>{error}</p>}
          </div>
        </div>
      )}

      {view === 'phone' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          <button
            onClick={() => {
              setView('chooseMethod');
              setError(null);
              setOtpSent(false);
              setOtp('');
            }}
            style={{ background: 'none', border: 'none', color: COLORS.inkMuted, fontSize: 13, padding: 0, marginBottom: 16, cursor: 'pointer', textAlign: 'left' }}
          >
            {t.login.back}
          </button>

          <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: COLORS.ink }}>{t.login.phoneLabel}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={otpSent}
            placeholder="9876543210"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${COLORS.line}`, marginBottom: 12, boxSizing: 'border-box' }}
          />

          {otpSent && (
            <>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: COLORS.ink }}>{t.login.otpLabel}</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t.login.otpPlaceholder}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${COLORS.line}`, marginBottom: 12, boxSizing: 'border-box' }}
              />
            </>
          )}

          <div ref={recaptchaContainerRef} />

          <button
            onClick={otpSent ? verifyOtp : requestOtp}
            disabled={loading || !phone}
            style={{ width: '100%', padding: 14, borderRadius: 8, background: COLORS.ink, color: COLORS.paper, border: 'none' }}
          >
            {loading ? '…' : otpSent ? t.login.verify : t.login.sendOtp}
          </button>

          {error && <p style={{ color: '#B4544A', marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {view === 'deviceLimit' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: '0 0 8px', color: COLORS.ink }}>{t.login.deviceLimitTitle}</h1>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20, lineHeight: 1.5 }}>{t.login.deviceLimitBody}</p>

          {existingDevices.map((d) => (
            <div
              key={d.deviceId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, border: `1px solid ${COLORS.line}`, borderRadius: 8, marginBottom: 10 }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: COLORS.ink }}>{d.label ?? t.login.unknownDevice}</p>
                <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: 0 }}>
                  {t.login.lastUsed}: {new Date(d.lastSeenAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => removeDeviceAndRetry(d.deviceId)}
                disabled={removingDeviceId === d.deviceId}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #B4544A', color: '#B4544A', background: COLORS.paper, fontSize: 13 }}
              >
                {removingDeviceId === d.deviceId ? '…' : t.login.removeDevice}
              </button>
            </div>
          ))}

          {error && <p style={{ color: '#B4544A', marginTop: 8 }}>{error}</p>}

          <button
            onClick={() => {
              setView('main');
              setPendingFirebaseToken(null);
            }}
            style={{ background: 'none', border: 'none', color: COLORS.inkMuted, fontSize: 13, marginTop: 12, cursor: 'pointer' }}
          >
            {t.login.cancel}
          </button>
        </div>
      )}
    </main>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.95H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
