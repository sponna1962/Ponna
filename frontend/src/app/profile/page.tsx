'use client';

// Profile page — finalized redesign. Personal Information + Education only;
// Account section links out to My Plans (subscription info lives there, not
// duplicated here) and — no Change Password, since student login is
// Firebase Phone OTP, not password-based, so that option doesn't apply.
//
// This same page IS the "Complete Your Profile" flow — when a student is
// redirected here from a locked Rank or from a payment attempt, the required
// fields are simply highlighted/empty and ready to fill in.
//
// Date of Birth/Education are collected for FUTURE personalization only —
// never used here or anywhere else to restrict exam access (finalized
// requirement).

import { useEffect, useState, useRef } from 'react';
import { GoogleAuthProvider, linkWithPopup, RecaptchaVerifier, linkWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

type EducationStatus = 'SCHOOL_STUDENT' | 'COLLEGE_STUDENT' | 'COMPLETED_STUDIES' | '';

type ProfileData = {
  name: string | null;
  phone: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null;
  email: string | null;
  whatsappNumber: string | null;
  district: string | null;
  cityTownVillage: string | null;
  educationStatus: EducationStatus | null;
  currentClass: string | null;
  courseOrDegree: string | null;
  yearOfStudy: string | null;
  highestQualification: string | null;
  community: string | null;
  profileComplete: boolean;
  isTestAccount: boolean;
};

export default function ProfilePage() {
  const { t } = useLanguage();
  // Read ?complete=1 via the plain browser API rather than Next's
  // useSearchParams(), which requires a Suspense boundary during static
  // export and caused an opaque build failure. Read once on mount,
  // client-side only — fine here since it only controls a UI banner.
  const [cameFromGate, setCameFromGate] = useState(false);
  const verifyPhoneSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCameFromGate(new URLSearchParams(window.location.search).get('complete') === '1');
    }
  }, []);

  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Draws the eye straight to Verify Phone Number when THAT's specifically
  // why they were redirected here — otherwise a student could easily miss
  // it below the fold and just click the regular Save button instead,
  // which doesn't touch phone and would bounce them right back to this
  // same page next time from Quiz.
  useEffect(() => {
    if (cameFromGate && profile && !profile.phone) {
      verifyPhoneSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [cameFromGate, profile]);

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [educationStatus, setEducationStatus] = useState<EducationStatus>('');
  const [currentClass, setCurrentClass] = useState('');
  const [courseOrDegree, setCourseOrDegree] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [highestQualification, setHighestQualification] = useState('');
  const [community, setCommunity] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [googleLinkMessage, setGoogleLinkMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Verify Phone Number (finalized requirement — Free Preview needs a
  // verified phone; a Google-only account has none by default). Same
  // Firebase phone-OTP pattern as the login page's flow, but linking onto
  // the ALREADY-authenticated current user instead of a fresh sign-in.
  const [phoneLinkStep, setPhoneLinkStep] = useState<'idle' | 'enterPhone' | 'enterOtp'>('idle');
  const [phoneToVerify, setPhoneToVerify] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneLinkMessage, setPhoneLinkMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);
  const phoneRecaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    studentFetch('/students/me/profile')
      .then((r) => r.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setName(data.name ?? '');
        setDateOfBirth(data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '');
        setEmail(data.email ?? '');
        setWhatsapp(data.whatsappNumber ?? '');
        setDistrict(data.district ?? '');
        setCity(data.cityTownVillage ?? '');
        setEducationStatus(data.educationStatus ?? '');
        setCurrentClass(data.currentClass ?? '');
        setCourseOrDegree(data.courseOrDegree ?? '');
        setYearOfStudy(data.yearOfStudy ?? '');
        setHighestQualification(data.highestQualification ?? '');
        setCommunity(data.community ?? '');
      })
      .catch(() => {});
  }, []);

  const [resettingHistory, setResettingHistory] = useState(false);

  /** Test Accounts only (finalized requirement — self-service, no need
   * to ask an admin each time) — wipes THIS account's own quiz history/
   * score, keeping the account itself intact. Backend independently
   * re-checks isTestAccount and rejects otherwise, regardless of what
   * this button does. */
  async function resetHistory() {
    if (!confirm('Reset your own quiz history and score? This clears Practice, Daily Quiz, and Brain Challenge history for this account — cannot be undone.')) return;
    setResettingHistory(true);
    const res = await studentFetch('/students/me/reset-history', { method: 'POST' });
    setResettingHistory(false);
    if (res.ok) {
      alert('History reset.');
    } else {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Could not reset history'}`);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await studentFetch('/students/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        dateOfBirth,
        email,
        whatsappNumber: whatsapp,
        district,
        cityTownVillage: city,
        educationStatus,
        currentClass,
        courseOrDegree,
        yearOfStudy,
        highestQualification,
        community,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const result = await res.json();
      setProfile((p) => (p ? { ...p, profileComplete: result.profileComplete } : p));
      setSaved(true);
      // Free Preview needs BOTH email and a verified phone (finalized
      // requirement) — if phone was already verified and this Save just
      // supplied the missing email, both requirements are now met, so
      // send them straight back to where they were trying to go instead
      // of leaving them stranded on Profile to navigate back manually.
      if (cameFromGate && profile?.phone) {
        window.location.href = '/quiz';
        return;
      }
    }
  }

  /**
   * Links Google to the currently-logged-in (Phone-OTP) student account.
   * linkWithPopup operates on the CURRENT Firebase Auth session — same uid
   * before and after — so this is the secure alternative to guessing based
   * on matching emails. `auth/credential-already-in-use` means this exact
   * Google account is already the canonical identity of a DIFFERENT
   * account (e.g. from a prior fresh "Continue with Google"); surfaced
   * clearly rather than silently failing.
   */
  /** Reads the picked file as a base64 data URL and uploads it — Part B
   * (finalized requirement): every student, not just Google sign-ins. */
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same file again re-trigger onChange
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image is too large — please choose one under 5MB.');
      return;
    }

    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read the selected file.'));
        reader.readAsDataURL(file);
      });

      const res = await studentFetch('/students/me/profile-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to upload photo.');
      }
      const { photoUrl } = await res.json();
      setProfile((p) => (p ? { ...p, photoUrl } : p));
    } catch (err: any) {
      console.error(err);
      setPhotoError(err.message ?? 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function connectGoogle() {
    setConnectingGoogle(true);
    setGoogleLinkMessage(null);
    try {
      if (!firebaseAuth.currentUser) {
        setGoogleLinkMessage({ ok: false, text: t.profile.googleLinkNeedsRelogin });
        return;
      }
      const credential = await linkWithPopup(firebaseAuth.currentUser, new GoogleAuthProvider());
      const firebaseIdToken = await credential.user.getIdToken();

      const res = await studentFetch('/students/me/link-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to link Google account');
      }
      setGoogleLinkMessage({ ok: true, text: t.profile.googleLinked });
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      if (err?.code === 'auth/credential-already-in-use') {
        setGoogleLinkMessage({ ok: false, text: t.profile.googleAlreadyLinkedElsewhere });
        return;
      }
      console.error(err);
      setGoogleLinkMessage({ ok: false, text: err.message ?? t.profile.googleLinkFailed });
    } finally {
      setConnectingGoogle(false);
    }
  }

  /**
   * Sends an OTP to verify+link a phone number onto the currently-logged-in
   * (Google) student account — mirrors connectGoogle above, using Firebase's
   * linkWithPhoneNumber on the CURRENT session instead of a fresh sign-in.
   */
  async function sendPhoneVerification() {
    setVerifyingPhone(true);
    setPhoneLinkMessage(null);
    try {
      if (!firebaseAuth.currentUser) {
        setPhoneLinkMessage({ ok: false, text: t.profile.googleLinkNeedsRelogin });
        return;
      }
      const verifier = new RecaptchaVerifier(firebaseAuth, phoneRecaptchaRef.current!, { size: 'invisible' });
      const fullPhone = phoneToVerify.startsWith('+') ? phoneToVerify : `+91${phoneToVerify}`;
      phoneConfirmationRef.current = await linkWithPhoneNumber(firebaseAuth.currentUser, fullPhone, verifier);
      setPhoneLinkStep('enterOtp');
    } catch (err: any) {
      console.error(err);
      setPhoneLinkMessage({ ok: false, text: err.message ?? t.login.sendError });
    } finally {
      setVerifyingPhone(false);
    }
  }

  async function confirmPhoneVerification() {
    setVerifyingPhone(true);
    setPhoneLinkMessage(null);
    try {
      if (!phoneConfirmationRef.current) throw new Error('No OTP request in progress');
      const credential = await phoneConfirmationRef.current.confirm(phoneOtp);
      const firebaseIdToken = await credential.user.getIdToken();

      const res = await studentFetch('/students/me/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to link phone number');
      }
      setPhoneLinkMessage({ ok: true, text: t.profile.phoneVerified });
      setPhoneLinkStep('idle');
      setProfile((p) => (p ? { ...p, phone: phoneToVerify } : p));
      // Same reasoning as save() above — if email was already there and
      // this verification just supplied the missing phone, both Free
      // Preview requirements are now met.
      if (cameFromGate && profile?.email) {
        window.location.href = '/quiz';
        return;
      }
    } catch (err: any) {
      console.error(err);
      setPhoneLinkMessage({ ok: false, text: err.message ?? t.login.verifyError });
    } finally {
      setVerifyingPhone(false);
    }
  }

  if (!profile) return <p style={{ padding: 24, color: '#94a3b8' }}>{t.quiz.loading}</p>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <StudentMenu />
        <strong style={{ fontSize: 16 }}>{t.profile.title}</strong>
      </div>

      <div style={{ padding: '0 20px' }}>
        {cameFromGate && !profile.profileComplete && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{t.profile.completeYourProfile}</strong>
            <span style={{ fontSize: 13, color: '#78350f' }}>{t.profile.completeProfileNote}</span>
          </div>
        )}

        {/* Free Preview specifically needs a verified phone (and an
            email) — a DIFFERENT, narrower gate than the general "complete
            your profile for Rank" one above. Without this, a student
            redirected here for a missing phone saw no banner at all
            whenever their general profileComplete happened to already be
            true, and had no way to tell that clicking the regular Save
            button (which doesn't touch phone) would never actually get
            them past the gate — they'd just bounce straight back to this
            same page from Quiz every time. */}
        {cameFromGate && (!profile.phone || !profile.email) && (
          <div style={{ background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{t.profile.freePreviewGateTitle}</strong>
            <span style={{ fontSize: 13, color: '#78350f' }}>
              {!profile.phone && !profile.email
                ? t.profile.freePreviewGateBothMissing
                : !profile.phone
                  ? t.profile.freePreviewGatePhoneMissing
                  : t.profile.freePreviewGateEmailMissing}
            </span>
          </div>
        )}

        {/* Profile photo — auto-filled from the Google account photo on
            Google sign-in (Part A); every student can also upload their
            own (Part B) — tapping the circle opens the file picker. A
            student's own upload always takes precedence over the
            Google-auto-captured one (student-auth.service.ts only backfills
            when photoUrl is still null). */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            style={{ position: 'relative', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          >
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoUrl}
                alt=""
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0', opacity: uploadingPhoto ? 0.5 : 1 }}
              />
            ) : (
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  fontWeight: 700,
                  color: '#64748b',
                  opacity: uploadingPhoto ? 0.5 : 1,
                }}
              >
                {(profile.name || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <span
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#0f172a',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                border: '2px solid #fff',
              }}
            >
              {uploadingPhoto ? '…' : '📷'}
            </span>
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} style={{ display: 'none' }} />
          {photoError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{photoError}</p>}
        </div>

        <SectionHeading>{t.profile.personalInfo}</SectionHeading>

        <TextField label={t.profile.name} required value={name} onChange={setName} />
        <DateField label={t.profile.dateOfBirth} required value={dateOfBirth} onChange={setDateOfBirth} />
        <TextField label={t.profile.email} required type="email" value={email} onChange={setEmail} />
        <ReadOnlyField label={t.profile.phone} value={profile.phone ?? '—'} />
        <TextField label={t.profile.whatsapp} required type="tel" value={whatsapp} onChange={setWhatsapp} />
        <TextField label={t.profile.district} required value={district} onChange={setDistrict} />
        <TextField label={t.profile.cityTownVillage} required value={city} onChange={setCity} />

        <SectionHeading>{t.profile.education}</SectionHeading>

        <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          {t.profile.educationStatus} {!educationStatus && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <select
          value={educationStatus}
          onChange={(e) => setEducationStatus(e.target.value as EducationStatus)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}
        >
          <option value="">—</option>
          <option value="SCHOOL_STUDENT">{t.profile.educationSchool}</option>
          <option value="COLLEGE_STUDENT">{t.profile.educationCollege}</option>
          <option value="COMPLETED_STUDIES">{t.profile.educationCompleted}</option>
        </select>

        {/* Exactly one detail field, matching the chosen status — never all
            three at once, and switching status clears the others (server
            enforces this too, see profile.service.ts). */}
        {educationStatus === 'SCHOOL_STUDENT' && (
          <TextField label={t.profile.currentClass} required value={currentClass} onChange={setCurrentClass} />
        )}
        {educationStatus === 'COLLEGE_STUDENT' && (
          <>
            <TextField label={t.profile.courseOrDegree} required value={courseOrDegree} onChange={setCourseOrDegree} />
            <TextField label={t.profile.yearOfStudy} required value={yearOfStudy} onChange={setYearOfStudy} />
          </>
        )}
        {educationStatus === 'COMPLETED_STUDIES' && (
          <TextField label={t.profile.highestQualification} required value={highestQualification} onChange={setHighestQualification} />
        )}

        {/* Community — entirely optional (finalized requirement), only
            used for the Cut-off Marks Predictor. Never required to use
            PONNA, never shown elsewhere. */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6 }}>{t.profile.communityLabel}</span>
          <select
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
          >
            <option value="">{t.profile.communitySkip}</option>
            <option value="OC">OC</option>
            <option value="BC">BC</option>
            <option value="BCM">BCM</option>
            <option value="MBC_DNC">MBC / DNC</option>
            <option value="SC">SC</option>
            <option value="SCA">SC(A)</option>
            <option value="ST">ST</option>
          </select>
          <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 4 }}>{t.profile.communityNote}</span>
        </label>

        <button
          onClick={save}
          disabled={saving}
          style={{ width: '100%', padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600, marginTop: 8, marginBottom: 8 }}
        >
          {saving ? '…' : t.profile.save}
        </button>
        {saved && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 16 }}>{t.profile.saved}</p>}

        <SectionHeading>{t.profile.account}</SectionHeading>
        <a
          href="/plans"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: 12,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            textDecoration: 'none',
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          {t.profile.viewMyPlans}
        </a>

        {/* Google account linking (finalized requirement) — a Phone-OTP
            account can link Google here, via Firebase's own authenticated
            linkWithPopup (same Firebase uid preserved throughout), never
            by matching emails after the fact. */}
        <button
          onClick={connectGoogle}
          disabled={connectingGoogle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: 12,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
            color: '#1f2937',
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {connectingGoogle ? '…' : `🔵 ${t.profile.connectGoogle}`}
        </button>
        {googleLinkMessage && <p style={{ fontSize: 13, color: googleLinkMessage.ok ? '#16a34a' : '#dc2626', marginBottom: 16 }}>{googleLinkMessage.text}</p>}

        {/* Verify Phone Number (finalized requirement — Free Preview
            requires a verified phone; a Google-only account has none by
            default). Only shown when there's no phone on the account yet —
            once verified, Profile's own Phone field (read-only) picks it
            up on next load. */}
        {!profile.phone && (
          <div ref={verifyPhoneSectionRef}>
            {phoneLinkStep === 'idle' && (
              <button
                onClick={() => {
                  setPhoneLinkMessage(null);
                  setPhoneLinkStep('enterPhone');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#1f2937',
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                📱 {t.profile.verifyPhone}
              </button>
            )}

            {(phoneLinkStep === 'enterPhone' || phoneLinkStep === 'enterOtp') && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{t.login.phoneLabel}</label>
                <input
                  type="tel"
                  value={phoneToVerify}
                  onChange={(e) => setPhoneToVerify(e.target.value)}
                  placeholder="9876543210"
                  disabled={phoneLinkStep === 'enterOtp'}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    marginBottom: 10,
                    boxSizing: 'border-box',
                    background: phoneLinkStep === 'enterOtp' ? '#f8fafc' : '#fff',
                    color: phoneLinkStep === 'enterOtp' ? '#64748b' : 'inherit',
                  }}
                />
                <div ref={phoneRecaptchaRef} />

                {/* OTP entry appears right here, in the SAME box, once sent
                    — not as a separate block further down the page, so the
                    student never loses sight of the number they just typed. */}
                {phoneLinkStep === 'enterOtp' && (
                  <>
                    <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{t.login.otpLabel}</label>
                    <input
                      type="text"
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value)}
                      placeholder={t.login.otpPlaceholder}
                      style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 10, boxSizing: 'border-box' }}
                      autoFocus
                    />
                  </>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setPhoneLinkStep('idle')}
                    style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    {t.login.cancel}
                  </button>
                  {phoneLinkStep === 'enterPhone' ? (
                    <button
                      onClick={sendPhoneVerification}
                      disabled={verifyingPhone || !phoneToVerify}
                      style={{ flex: 1, padding: 10, borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600 }}
                    >
                      {verifyingPhone ? '…' : t.login.sendOtp}
                    </button>
                  ) : (
                    <button
                      onClick={confirmPhoneVerification}
                      disabled={verifyingPhone || !phoneOtp}
                      style={{ flex: 1, padding: 10, borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600 }}
                    >
                      {verifyingPhone ? '…' : t.login.verify}
                    </button>
                  )}
                </div>
              </div>
            )}

            {phoneLinkMessage && (
              <p style={{ fontSize: 13, color: phoneLinkMessage.ok ? '#16a34a' : '#dc2626', marginBottom: 16 }}>{phoneLinkMessage.text}</p>
            )}
          </div>
        )}

        {/* Test Accounts only (finalized requirement) — self-service reset
            of their own quiz history/score, no need to ask an admin each
            time. Never shown for a real student account. */}
        {profile.isTestAccount && (
          <div style={{ border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginTop: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>🧪 TEST ACCOUNT</p>
            <button
              onClick={resetHistory}
              disabled={resettingHistory}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #dc2626', color: '#dc2626', background: '#fff', fontSize: 13, fontWeight: 600 }}
            >
              {resettingHistory ? '…' : 'Reset My Quiz History & Score'}
            </button>
          </div>
        )}

        {/* No Change Password — student login is Firebase Phone OTP, not
            password-based, so this option from the spec doesn't apply here. */}
      </div>
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, margin: '20px 0 10px' }}>{children}</h2>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
      <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
      <span style={{ color: '#334155', fontSize: 14 }}>{value}</span>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
        {label} {required && !value && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
      />
    </div>
  );
}

function DateField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
        {label} {required && !value && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
      />
    </div>
  );
}
