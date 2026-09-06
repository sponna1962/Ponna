'use client';

// Profile page — finalized redesign. Personal Information + Education only.
// Account section contains Plans, Google linking and test-account tools.
// Date of Birth/Education are collected for future personalization only and
// never restrict exam access.

import { useEffect, useState, useRef } from 'react';
import { GoogleAuthProvider, linkWithPopup, RecaptchaVerifier, linkWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { useLanguage } from '../../lib/language-context';
import { useTheme } from '../../lib/theme-context';
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

const QUALIFICATION_OPTIONS = [
  { value: 'SSLC', label: '10th / SSLC' },
  { value: 'HSC', label: '12th / HSC' },
  { value: 'ITI', label: 'ITI' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'UG', label: 'Undergraduate Degree' },
  { value: 'PG', label: 'Postgraduate Degree' },
  { value: 'MPHIL', label: 'M.Phil.' },
  { value: 'PHD', label: 'Ph.D.' },
];
const QUALIFICATION_VALUES = QUALIFICATION_OPTIONS.map((o) => o.value);

export default function ProfilePage() {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [cameFromGate, setCameFromGate] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCameFromGate(new URLSearchParams(window.location.search).get('complete') === '1');
    }
  }, []);

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phoneToVerify, setPhoneToVerify] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [educationStatus, setEducationStatus] = useState<EducationStatus>('');
  const [currentClass, setCurrentClass] = useState('');
  const [courseOrDegree, setCourseOrDegree] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [highestQualification, setHighestQualification] = useState('');
  const [otherQualification, setOtherQualification] = useState('');
  const [community, setCommunity] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [googleLinkMessage, setGoogleLinkMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [phoneLinkStep, setPhoneLinkStep] = useState<'idle' | 'enterOtp'>('idle');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneLinkMessage, setPhoneLinkMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);
  const phoneRecaptchaRef = useRef<HTMLDivElement>(null);
  const [resettingHistory, setResettingHistory] = useState(false);

  useEffect(() => {
    studentFetch('/students/me/profile')
      .then((r) => r.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setName(data.name ?? '');
        setDateOfBirth(data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '');
        setEmail(data.email ?? '');
        setPhoneToVerify(data.phone ?? '');
        setWhatsapp(data.whatsappNumber ?? '');
        setDistrict(data.district ?? '');
        setCity(data.cityTownVillage ?? '');
        setEducationStatus(data.educationStatus ?? '');
        setCurrentClass(data.currentClass ?? '');
        setCourseOrDegree(data.courseOrDegree ?? '');
        setYearOfStudy(data.yearOfStudy ?? '');
        const existingQualification = data.highestQualification ?? '';
        if (QUALIFICATION_VALUES.includes(existingQualification)) {
          setHighestQualification(existingQualification);
          setOtherQualification('');
        } else {
          setHighestQualification(existingQualification);
          setOtherQualification(existingQualification);
        }
        setCommunity(data.community ?? '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cameFromGate && profile && !profile.phone) {
      document.getElementById('phone-number-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [cameFromGate, profile]);

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
      if (cameFromGate && profile?.phone) {
        window.location.href = '/quiz';
        return;
      }
    }
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
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

  async function sendPhoneVerification() {
    setVerifyingPhone(true);
    setPhoneLinkMessage(null);
    try {
      if (!firebaseAuth.currentUser) {
        setPhoneLinkMessage({ ok: false, text: t.profile.googleLinkNeedsRelogin });
        return;
      }
      const normalized = phoneToVerify.trim().replace(/[\s-]/g, '');
      if (!/^\+?\d{10,15}$/.test(normalized)) {
        setPhoneLinkMessage({ ok: false, text: 'Enter a valid phone number.' });
        return;
      }
      const fullPhone = normalized.startsWith('+') ? normalized : `+91${normalized}`;
      const verifier = new RecaptchaVerifier(firebaseAuth, phoneRecaptchaRef.current!, { size: 'invisible' });
      phoneConfirmationRef.current = await linkWithPhoneNumber(firebaseAuth.currentUser, fullPhone, verifier);
      setPhoneToVerify(fullPhone);
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
      const verifiedPhone = phoneToVerify;
      setPhoneLinkMessage({ ok: true, text: t.profile.phoneVerified });
      setPhoneLinkStep('idle');
      setProfile((p) => (p ? { ...p, phone: verifiedPhone } : p));
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

  const qualificationChoice = QUALIFICATION_VALUES.includes(highestQualification)
    ? highestQualification
    : highestQualification
      ? 'OTHER'
      : '';

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <StudentMenu />
        <strong style={{ fontSize: 16 }}>{t.profile.title}</strong>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t.profile.darkMode}
          title={t.profile.darkMode}
          style={{ width: 44, height: 28, borderRadius: 14, border: '1px solid #cbd5e1', background: theme === 'dark' ? '#0f172a' : '#e2e8f0', position: 'relative', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ position: 'absolute', top: 3, left: theme === 'dark' ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
        </button>
      </header>

      <div style={{ padding: '0 20px' }}>
        {cameFromGate && !profile.profileComplete && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{t.profile.completeYourProfile}</strong>
            <span style={{ fontSize: 13, color: '#78350f' }}>{t.profile.completeProfileNote}</span>
          </div>
        )}

        {cameFromGate && (!profile.phone || !profile.email) && (
          <div style={{ background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{t.profile.freePreviewGateTitle}</strong>
            <span style={{ fontSize: 13, color: '#78350f' }}>
              {!profile.phone && !profile.email ? t.profile.freePreviewGateBothMissing : !profile.phone ? t.profile.freePreviewGatePhoneMissing : t.profile.freePreviewGateEmailMissing}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} style={{ position: 'relative', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoUrl} alt="" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0', opacity: uploadingPhoto ? 0.5 : 1 }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#64748b', opacity: uploadingPhoto ? 0.5 : 1 }}>
                {(profile.name || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: '2px solid #fff' }}>
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

        <div id="phone-number-field" style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
            {t.profile.phone} {!profile.phone && <span style={{ color: '#dc2626' }}>*</span>}
          </label>
          {profile.phone ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#334155', fontSize: 14 }}>{profile.phone}</span>
              <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Verified</span>
            </div>
          ) : (
            <>
              <input
                type="tel"
                value={phoneToVerify}
                onChange={(e) => { setPhoneToVerify(e.target.value); setPhoneLinkMessage(null); }}
                placeholder="9876543210"
                disabled={phoneLinkStep === 'enterOtp' || verifyingPhone}
                autoComplete="tel"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box', background: phoneLinkStep === 'enterOtp' ? '#f8fafc' : '#fff' }}
              />
              <div ref={phoneRecaptchaRef} />
              {phoneLinkStep === 'idle' && (
                <button
                  type="button"
                  onClick={sendPhoneVerification}
                  disabled={verifyingPhone || !phoneToVerify.trim()}
                  style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#111827', fontWeight: 700, cursor: verifyingPhone || !phoneToVerify.trim() ? 'not-allowed' : 'pointer', opacity: verifyingPhone || !phoneToVerify.trim() ? 0.55 : 1 }}
                >
                  📱 {verifyingPhone ? 'Sending OTP…' : t.profile.verifyPhone}
                </button>
              )}
              {phoneLinkStep === 'enterOtp' && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>{t.login.otpLabel}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    placeholder={t.login.otpPlaceholder}
                    autoFocus
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => { setPhoneLinkStep('idle'); setPhoneOtp(''); setPhoneLinkMessage(null); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}>
                      {t.login.cancel}
                    </button>
                    <button type="button" onClick={confirmPhoneVerification} disabled={verifyingPhone || !phoneOtp.trim()} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, opacity: verifyingPhone || !phoneOtp.trim() ? 0.55 : 1 }}>
                      {verifyingPhone ? '…' : t.login.verify}
                    </button>
                  </div>
                </div>
              )}
              {phoneLinkMessage && <p style={{ fontSize: 13, color: phoneLinkMessage.ok ? '#16a34a' : '#dc2626', margin: '8px 0 0' }}>{phoneLinkMessage.text}</p>}
            </>
          )}
        </div>

        <TextField label={t.profile.whatsapp} required type="tel" value={whatsapp} onChange={setWhatsapp} />
        <TextField label={t.profile.district} required value={district} onChange={setDistrict} />
        <TextField label={t.profile.cityTownVillage} required value={city} onChange={setCity} />

        <SectionHeading>{t.profile.education}</SectionHeading>
        <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          {t.profile.educationStatus} {!educationStatus && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <select value={educationStatus} onChange={(e) => setEducationStatus(e.target.value as EducationStatus)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}>
          <option value="">—</option>
          <option value="SCHOOL_STUDENT">{t.profile.educationSchool}</option>
          <option value="COLLEGE_STUDENT">{t.profile.educationCollege}</option>
          <option value="COMPLETED_STUDIES">{t.profile.educationCompleted}</option>
        </select>

        {educationStatus === 'SCHOOL_STUDENT' && <TextField label={t.profile.currentClass} required value={currentClass} onChange={setCurrentClass} />}
        {educationStatus === 'COLLEGE_STUDENT' && (
          <>
            <TextField label={t.profile.courseOrDegree} required value={courseOrDegree} onChange={setCourseOrDegree} />
            <TextField label={t.profile.yearOfStudy} required value={yearOfStudy} onChange={setYearOfStudy} />
          </>
        )}
        {educationStatus === 'COMPLETED_STUDIES' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
              {t.profile.highestQualification} {!highestQualification && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <select
              value={qualificationChoice}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'OTHER') {
                  setHighestQualification(otherQualification);
                } else {
                  setHighestQualification(value);
                  setOtherQualification('');
                }
              }}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            >
              <option value="">—</option>
              {QUALIFICATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              <option value="OTHER">Other</option>
            </select>
            {qualificationChoice === 'OTHER' && (
              <input
                type="text"
                value={otherQualification}
                onChange={(e) => { setOtherQualification(e.target.value); setHighestQualification(e.target.value); }}
                placeholder="Other Qualification"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box', marginTop: 8 }}
              />
            )}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6 }}>{t.profile.communityLabel}</span>
          <select value={community} onChange={(e) => setCommunity(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}>
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

        <button onClick={save} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600, marginTop: 8, marginBottom: 8 }}>
          {saving ? '…' : t.profile.save}
        </button>
        {saved && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 16 }}>{t.profile.saved}</p>}

        <SectionHeading>{t.profile.account}</SectionHeading>
        <a href="/plans" style={{ display: 'block', textAlign: 'center', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', color: '#0f172a', textDecoration: 'none', fontWeight: 600, marginBottom: 12 }}>
          {t.profile.viewMyPlans}
        </a>

        <button onClick={connectGoogle} disabled={connectingGoogle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#1f2937', fontWeight: 600, marginBottom: 8 }}>
          {connectingGoogle ? '…' : `🔵 ${t.profile.connectGoogle}`}
        </button>
        {googleLinkMessage && <p style={{ fontSize: 13, color: googleLinkMessage.ok ? '#16a34a' : '#dc2626', marginBottom: 16 }}>{googleLinkMessage.text}</p>}

        <ReferralSection />

        {profile.isTestAccount && (
          <div style={{ border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginTop: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>🧪 TEST ACCOUNT</p>
            <button onClick={resetHistory} disabled={resettingHistory} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #dc2626', color: '#dc2626', background: '#fff', fontSize: 13, fontWeight: 600 }}>
              {resettingHistory ? '…' : 'Reset My Quiz History & Score'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, margin: '20px 0 10px' }}>{children}</h2>;
}

function TextField({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
        {label} {required && !value && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
    </div>
  );
}

function DateField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
        {label} {required && !value && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
    </div>
  );
}

function ReferralSection() {
  const [info, setInfo] = useState<{ code: string; totalReferred: number; totalRewarded: number; pending: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    studentFetch('/students/me/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info) return null;
  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${info.code}` : '';

  function copyLink() {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginTop: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>🎁 Invite &amp; Earn</p>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Invite a friend — you both get a reward once they get a paid plan.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input readOnly value={shareLink} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, background: '#f8fafc' }} />
        <button onClick={copyLink} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', fontSize: 12, fontWeight: 600 }}>{copied ? '✓' : 'Copy'}</button>
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8' }}>{info.totalReferred} invited · {info.totalRewarded} rewarded · {info.pending} pending</p>
    </div>
  );
}
