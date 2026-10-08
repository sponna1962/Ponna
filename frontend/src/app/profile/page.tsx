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
  otherQualificationText: string | null;
  community: string | null;
  profileComplete: boolean;
  isTestAccount: boolean;
};

const QUALIFICATION_OPTIONS = [
  { value: 'BELOW_SSLC', label: 'Below 10th' },
  { value: 'SSLC', label: '10th / SSLC' },
  { value: 'HSC', label: '12th / HSC' },
  { value: 'ITI', label: 'ITI' },
  { value: 'DIPLOMA', label: 'Diploma (Polytechnic)' },
  { value: 'UG', label: 'UG — Arts & Science (B.A./B.Sc.)' },
  { value: 'UG_ENGINEERING', label: 'UG — Engineering (B.E./B.Tech)' },
  { value: 'UG_COMMERCE_MGMT', label: 'UG — Commerce/Management (B.Com/BBA)' },
  { value: 'UG_LAW', label: 'UG — Law (LLB)' },
  { value: 'UG_MEDICINE', label: 'UG — Medicine (MBBS)' },
  { value: 'BED_TEACHER_TRAINING', label: 'B.Ed / Teacher Training' },
  { value: 'PG', label: 'PG — Arts & Science (M.A./M.Sc.)' },
  { value: 'PG_ENGINEERING', label: 'PG — Engineering (M.E./M.Tech)' },
  { value: 'PG_COMMERCE_MGMT', label: 'PG — Management (MBA/M.Com)' },
  { value: 'PG_LAW', label: 'PG — Law (LLM)' },
  { value: 'PG_MEDICINE', label: 'PG — Medicine (MD/MS)' },
  { value: 'MPHIL', label: 'M.Phil.' },
  { value: 'PHD', label: 'Ph.D.' },
  { value: 'PROFESSIONAL_CERT', label: 'Professional Cert. (CA/CS/ICWA/CMA)' },
];

export default function ProfilePage() {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [cameFromGate, setCameFromGate] = useState(false);
  // Oct 2026 — after completing the profile, return to wherever the gate
  // came from. Whitelisted (never an arbitrary URL): the Plans page sends
  // next=plans so a student who clicked "Get Pass" lands back there to pay.
  const [afterGateUrl, setAfterGateUrl] = useState('/quiz');
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      setCameFromGate(q.get('complete') === '1');
      if (q.get('next') === 'plans') setAfterGateUrl('/plans');
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
  const [otherQualificationText, setOtherQualificationText] = useState('');
  const [community, setCommunity] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  const phoneVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [resettingHistory, setResettingHistory] = useState(false);
  const [milestones, setMilestones] = useState<{ type: string; label: string; emoji: string; achievedAt: string }[]>([]);
  const [pushStatus, setPushStatus] = useState<{ configured: boolean; subscribed: boolean; vapidPublicKey: string | null } | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

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
        setHighestQualification(data.highestQualification ?? '');
        setOtherQualificationText(data.otherQualificationText ?? '');
        setCommunity(data.community ?? '');
      })
      .catch(() => {});
  }, []);

  // Sept 2026 — Gamification badges: same /students/me/milestones data
  // as Dashboard, shown here too so achievements are visible from the
  // student's own profile, not only Dashboard.
  useEffect(() => {
    studentFetch('/students/me/milestones')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMilestones(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Sept 2026 — Push Notifications (Priority 1, Accessibility & Reach).
  useEffect(() => {
    studentFetch('/students/me/push-subscription/status')
      .then((r) => (r.ok ? r.json() : null))
      .then(setPushStatus)
      .catch(() => {});
  }, []);

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  // Oct 2026 — every failure path now tells the student what happened (it used
  // to fail silently, so the toggle just looked "dead").
  async function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW_TIMEOUT')), 8000)),
    ]);
  }

  async function enablePushNotifications() {
    setPushMsg(null);
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushMsg('இந்த உலாவியில் அறிவிப்புகள் ஆதரிக்கப்படவில்லை. Chrome-ல் ponna.in-ஐத் திறந்து முயலவும். (Notifications are not supported in this browser — please open ponna.in in Chrome.)');
      return;
    }
    if (!pushStatus?.vapidPublicKey) {
      setPushMsg('அறிவிப்பு அமைப்பு இன்னும் தயாராகவில்லை. சிறிது நேரம் கழித்து முயலவும். (Notifications are not set up on the server yet.)');
      return;
    }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushMsg('அறிவிப்பு அனுமதி வழங்கப்படவில்லை. உலாவியின் முகவரிப் பட்டியில் 🔒 → Permissions → Notifications → Allow செய்து மீண்டும் முயலவும். (Notification permission was not granted.)');
        return;
      }
      const registration = await waitForServiceWorker();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushStatus.vapidPublicKey) as BufferSource,
      });
      const res = await studentFetch('/students/me/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error('SAVE_FAILED_' + res.status);
      setPushStatus((cur) => (cur ? { ...cur, subscribed: true } : cur));
    } catch (err: any) {
      console.error('Push subscribe failed:', err);
      if (err?.message === 'SW_TIMEOUT') {
        setPushMsg('பின்னணிச் சேவை இன்னும் தயாராகவில்லை. பக்கத்தை ஒருமுறை புதுப்பித்து (refresh) மீண்டும் முயலவும். (Service worker is not ready — refresh the page and try again.)');
      } else {
        setPushMsg(`அறிவிப்பை இயக்க முடியவில்லை. (Could not enable notifications: ${err?.message ?? 'unknown error'})`);
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePushNotifications() {
    setPushMsg(null);
    setPushBusy(true);
    try {
      const registration = await waitForServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await studentFetch('/students/me/push-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setPushStatus((cur) => (cur ? { ...cur, subscribed: false } : cur));
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      setPushMsg('அறிவிப்பை நிறுத்த முடியவில்லை. மீண்டும் முயலவும். (Could not turn notifications off — please try again.)');
    } finally {
      setPushBusy(false);
    }
  }

  async function shareBadge(m: { label: string; emoji: string }) {
    const text = `நான் PONNA-ல் "${m.label}" ${m.emoji} சாதனை பெற்றேன்! நீங்களும் இணையுங்க: https://ponna.in`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ text });
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
    } else if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

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
    setSaveError(null);
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
        otherQualificationText: highestQualification === 'OTHER' ? otherQualificationText : '',
        community,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const result = await res.json();
      setProfile((p) => (p ? { ...p, profileComplete: result.profileComplete } : p));
      setSaved(true);
      if (cameFromGate && profile?.phone) {
        window.location.href = afterGateUrl;
        return;
      }
    } else {
      // Sept 2026 (real bug fix) — was silently doing nothing on
      // failure (e.g. a duplicate email hitting the unique constraint),
      // leaving the student with no idea their edits weren't saved.
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? 'Save ஆகவில்லை. மீண்டும் முயற்சிக்கவும்.');
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
      // Oct 2026 — a RecaptchaVerifier can only be rendered once per element;
      // a second attempt (retry after an error, or after Cancel) threw
      // "reCAPTCHA has already been rendered in this element". Always clear the
      // previous verifier and the container first.
      try { phoneVerifierRef.current?.clear(); } catch { /* already cleared */ }
      if (phoneRecaptchaRef.current) phoneRecaptchaRef.current.innerHTML = '';
      const verifier = new RecaptchaVerifier(firebaseAuth, phoneRecaptchaRef.current!, { size: 'invisible' });
      phoneVerifierRef.current = verifier;
      phoneConfirmationRef.current = await linkWithPhoneNumber(firebaseAuth.currentUser, fullPhone, verifier);
      setPhoneToVerify(fullPhone);
      setPhoneLinkStep('enterOtp');
    } catch (err: any) {
      console.error(err);
      try { phoneVerifierRef.current?.clear(); } catch { /* ignore */ }
      phoneVerifierRef.current = null;
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
        window.location.href = afterGateUrl;
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
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 130, background: 'var(--color-paper)', color: 'var(--color-ink)', minHeight: '100dvh' }}>
      <style>{`.pf-field:focus { outline: none; border-color: var(--color-teal) !important; box-shadow: 0 0 0 3px rgba(28,107,107,0.18); }`}</style>
      {/* Oct 2026 redesign — teal header, avatar on a gold ring, sectioned cards, sticky Save.
          All behaviour is unchanged; only presentation. */}
      <header style={{ background: 'var(--color-head1)', padding: '14px 16px 64px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '3px solid #E2B04A' }}>
        <StudentMenu iconColor="#fff" />
        <strong style={{ fontSize: 17 }}>{t.profile.title}</strong>
        <div style={{ flex: 1 }} />
        <Switch on={theme === 'dark'} onClick={toggleTheme} label={t.profile.darkMode} onColor="#E2B04A" offColor="rgba(255,255,255,0.25)" />
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -52 }}>
        <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} aria-label="Change photo" style={{ position: 'relative', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoUrl} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--color-paper)', boxShadow: '0 0 0 3px #E2B04A', opacity: uploadingPhoto ? 0.5 : 1 }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--color-goldDisc)', border: '4px solid var(--color-paper)', boxShadow: '0 0 0 3px #E2B04A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 700, color: 'var(--color-gold)', opacity: uploadingPhoto ? 0.5 : 1 }}>
              {(profile.name || '?').trim().charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ position: 'absolute', right: -4, bottom: -4, width: 32, height: 32, borderRadius: '50%', background: 'var(--color-btn)', color: 'var(--color-btnText)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: '3px solid var(--color-paper)' }}>
            {uploadingPhoto ? '…' : '📷'}
          </span>
        </button>
        <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} style={{ display: 'none' }} />
        {photoError && <p style={{ fontSize: 12, color: 'var(--color-bad)', marginTop: 8 }}>{photoError}</p>}
        {profile.name && <p style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 2px' }}>{profile.name}</p>}
        {profile.phone && <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ok)', margin: 0 }}>✓ {t.profile.phone} — Verified</p>}
      </div>

      {cameFromGate && !profile.profileComplete && (
        <div style={{ background: 'var(--color-goldDisc)', border: '1px solid #E2B04A', borderRadius: 8, padding: 14, margin: '16px 16px 0' }}>
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{t.profile.completeYourProfile}</strong>
          <span style={{ fontSize: 13, color: 'var(--color-inkMuted)' }}>{t.profile.completeProfileNote}</span>
        </div>
      )}

      {cameFromGate && (!profile.phone || !profile.email) && (
        <div style={{ background: 'var(--color-goldDisc)', border: '1.5px solid #E2B04A', borderRadius: 8, padding: 14, margin: '16px 16px 0' }}>
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{t.profile.freePreviewGateTitle}</strong>
          <span style={{ fontSize: 13, color: 'var(--color-inkMuted)' }}>
            {!profile.phone && !profile.email ? t.profile.freePreviewGateBothMissing : !profile.phone ? t.profile.freePreviewGatePhoneMissing : t.profile.freePreviewGateEmailMissing}
          </span>
        </div>
      )}

      <Card title={t.profile.personalInfo}>
        <TextField label={t.profile.name} required value={name} onChange={setName} />
        <DateField label={t.profile.dateOfBirth} required value={dateOfBirth} onChange={setDateOfBirth} />
        <TextField label={t.profile.email} required type="email" value={email} onChange={setEmail} />

        <div id="phone-number-field" style={{ marginBottom: 14 }}>
          <label style={LABEL}>
            {t.profile.phone} {!profile.phone && <span style={{ color: 'var(--color-bad)' }}>*</span>}
          </label>
          {profile.phone ? (
            <div style={{ ...FIELD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>{profile.phone}</span>
              <span style={{ color: 'var(--color-ok)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Verified</span>
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
                className="pf-field" style={FIELD}
              />
              <div ref={phoneRecaptchaRef} />
              {phoneLinkStep === 'idle' && (
                <button
                  type="button"
                  onClick={sendPhoneVerification}
                  disabled={verifyingPhone || !phoneToVerify.trim()}
                  style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 12, border: '1.5px solid var(--color-line)', background: 'var(--color-card)', color: 'var(--color-ink)', fontWeight: 700, cursor: verifyingPhone || !phoneToVerify.trim() ? 'not-allowed' : 'pointer', opacity: verifyingPhone || !phoneToVerify.trim() ? 0.55 : 1 }}
                >
                  📱 {verifyingPhone ? 'Sending OTP…' : t.profile.verifyPhone}
                </button>
              )}
              {phoneLinkStep === 'enterOtp' && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--color-inkMuted)', marginBottom: 6 }}>{t.login.otpLabel}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    placeholder={t.login.otpPlaceholder}
                    autoFocus
                    className="pf-field" style={{ ...FIELD, marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => { setPhoneLinkStep('idle'); setPhoneOtp(''); setPhoneLinkMessage(null); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid var(--color-line)', background: 'var(--color-card)', color: 'var(--color-ink)' }}>
                      {t.login.cancel}
                    </button>
                    <button type="button" onClick={confirmPhoneVerification} disabled={verifyingPhone || !phoneOtp.trim()} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700, opacity: verifyingPhone || !phoneOtp.trim() ? 0.55 : 1 }}>
                      {verifyingPhone ? '…' : t.login.verify}
                    </button>
                  </div>
                </div>
              )}
              {phoneLinkMessage && <p style={{ fontSize: 13, color: phoneLinkMessage.ok ? 'var(--color-ok)' : 'var(--color-bad)', margin: '8px 0 0' }}>{phoneLinkMessage.text}</p>}
            </>
          )}
        </div>

        <TextField label={t.profile.whatsapp} required type="tel" value={whatsapp} onChange={setWhatsapp} />
        <TextField label={t.profile.district} required value={district} onChange={setDistrict} />
        <TextField label={t.profile.cityTownVillage} required value={city} onChange={setCity} last />

        <div style={{ borderTop: '1px solid var(--color-line)', marginTop: 16, paddingTop: 16 }}>
          <button onClick={connectGoogle} disabled={connectingGoogle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 13, borderRadius: 12, border: '1.5px solid var(--color-line)', background: 'var(--color-card)', color: 'var(--color-ink)', fontWeight: 700, fontSize: 15 }}>
            {connectingGoogle ? '…' : `🔵 ${t.profile.connectGoogle} (விருப்பம்)`}
          </button>
          <p style={{ fontSize: 12, color: 'var(--color-inkMuted)', margin: '8px 2px 0', lineHeight: 1.5 }}>எண் மாறினாலும் உங்கள் பாஸ் பாதுகாப்பாக இருக்கும்.</p>
          {googleLinkMessage && <p style={{ fontSize: 13, color: googleLinkMessage.ok ? 'var(--color-ok)' : 'var(--color-bad)', margin: '10px 0 0' }}>{googleLinkMessage.text}</p>}
        </div>
      </Card>

      <Card title={t.profile.education}>
        <label style={LABEL}>
          {t.profile.educationStatus} {!educationStatus && <span style={{ color: 'var(--color-bad)' }}>*</span>}
        </label>
        <select value={educationStatus} onChange={(e) => setEducationStatus(e.target.value as EducationStatus)} className="pf-field" style={{ ...FIELD, marginBottom: 14 }}>
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
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>
              {t.profile.highestQualification} {!highestQualification && <span style={{ color: 'var(--color-bad)' }}>*</span>}
            </label>
            <select
              value={highestQualification}
              onChange={(e) => setHighestQualification(e.target.value)}
              className="pf-field" style={FIELD}
            >
              <option value="">—</option>
              {QUALIFICATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              <option value="OTHER">Other</option>
            </select>
            {highestQualification === 'OTHER' && (
              <input
                type="text"
                value={otherQualificationText}
                onChange={(e) => setOtherQualificationText(e.target.value)}
                placeholder="Please specify your qualification"
                className="pf-field" style={{ ...FIELD, marginTop: 8 }}
              />
            )}
          </div>
        )}

        <label style={{ display: 'block' }}>
          <span style={LABEL}>{t.profile.communityLabel}</span>
          <select value={community} onChange={(e) => setCommunity(e.target.value)} className="pf-field" style={{ ...FIELD, marginBottom: 6 }}>
            <option value="">{t.profile.communitySkip}</option>
            <option value="OC">OC</option>
            <option value="BC">BC</option>
            <option value="BCM">BCM</option>
            <option value="MBC_DNC">MBC / DNC</option>
            <option value="SC">SC</option>
            <option value="SCA">SC(A)</option>
            <option value="ST">ST</option>
          </select>
          <span style={{ fontSize: 11.5, color: 'var(--color-inkMuted)', display: 'block' }}>{t.profile.communityNote}</span>
        </label>
      </Card>

      {/* Sept 2026 — Gamification badges, same data as Dashboard. Tap a
          badge to share it. Silently absent until the first badge is earned. */}
      {milestones.length > 0 && (
        <Card title={t.dashboard.badgesLabel}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {milestones.map((m) => (
              <button key={m.type} onClick={() => shareBadge(m)} style={{ textAlign: 'center', width: 64, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}>
                <p style={{ fontSize: 28, margin: 0 }}>{m.emoji}</p>
                <p style={{ fontSize: 10.5, color: 'var(--color-inkMuted)', margin: '2px 0 0', lineHeight: 1.2 }}>{m.label}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Sept 2026 — Push Notifications. Hidden entirely if VAPID keys aren't
          configured on the backend, rather than offering a dead toggle. */}
      {pushStatus?.configured && (
        <Card title="அறிவிப்புகள் / Notifications">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>🔔 Notifications</p>
              <p style={{ fontSize: 12, color: 'var(--color-inkMuted)', margin: 0 }}>Daily Challenge, streak reminders, exam updates</p>
            </div>
            <Switch on={!!pushStatus.subscribed} disabled={pushBusy} onClick={() => (pushStatus.subscribed ? disablePushNotifications() : enablePushNotifications())} label="Toggle notifications" onColor="var(--color-teal)" offColor="var(--color-line)" />
          </div>
          {pushBusy && <p style={{ fontSize: 12.5, color: 'var(--color-inkMuted)', margin: '10px 0 0' }}>…</p>}
          {pushMsg && <p role="alert" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-bad)', margin: '10px 0 0' }}>{pushMsg}</p>}
        </Card>
      )}

      {/* Oct 2026 — the separate "Account" card was removed by request (the plans link duplicated the menu's Pass button); Google linking now lives at the end of Personal info. */}

      <ReferralSection />

      {profile.isTestAccount && (
        <div style={{ border: '1px solid var(--color-bad)', borderRadius: 8, padding: 14, margin: '16px 16px 0' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-bad)', marginBottom: 8 }}>🧪 TEST ACCOUNT</p>
          <button onClick={resetHistory} disabled={resettingHistory} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--color-bad)', color: 'var(--color-bad)', background: 'var(--color-card)', fontSize: 13, fontWeight: 600 }}>
            {resettingHistory ? '…' : 'Reset My Quiz History & Score'}
          </button>
        </div>
      )}

      {/* Sticky Save — always reachable on this long page. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 16px 16px', background: 'linear-gradient(transparent, var(--color-paper) 40%)', zIndex: 5 }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {saved && <p style={{ color: 'var(--color-ok)', fontSize: 13, fontWeight: 700, margin: '0 0 6px', textAlign: 'center' }}>{t.profile.saved}</p>}
          {saveError && <p style={{ color: 'var(--color-bad)', fontSize: 13, margin: '0 0 6px', textAlign: 'center' }}>{saveError}</p>}
          <button onClick={save} disabled={saving} style={{ width: '100%', padding: 16, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', border: 'none', fontWeight: 700, fontSize: 17, boxShadow: '0 10px 24px -10px rgba(15,47,51,0.7)' }}>
            {saving ? '…' : t.profile.save}
          </button>
        </div>
      </div>
    </main>
  );
}


const FIELD: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 12, border: '1.5px solid var(--color-line)',
  background: 'var(--color-field)', color: 'var(--color-ink)', fontSize: 16, boxSizing: 'border-box', fontFamily: 'inherit',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--color-inkMuted)', marginBottom: 6, fontWeight: 500 };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 18, padding: 16, margin: '16px 16px 0', boxShadow: '0 8px 24px -18px rgba(15,47,51,0.5)' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--color-ink)' }}>
        <span style={{ width: 5, height: 18, borderRadius: 3, background: '#E2B04A' }} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Switch({ on, onClick, label, onColor, offColor, disabled }: { on: boolean; onClick: () => void; label: string; onColor: string; offColor: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} role="switch" aria-checked={on}
      style={{ width: 46, height: 28, borderRadius: 8, border: 'none', background: on ? onColor : offColor, position: 'relative', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
    </button>
  );
}

function TextField({ label, value, onChange, required, type = 'text', last }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <label style={LABEL}>
        {label} {required && !value && <span style={{ color: 'var(--color-bad)' }}>*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="pf-field" style={FIELD} />
    </div>
  );
}

function DateField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LABEL}>
        {label} {required && !value && <span style={{ color: 'var(--color-bad)' }}>*</span>}
      </label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="pf-field" style={FIELD} />
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
    <div style={{ background: 'linear-gradient(135deg, var(--color-goldDisc), var(--color-card))', border: '1px solid var(--color-line)', borderRadius: 18, padding: 16, margin: '16px 16px 0' }}>
      <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>🎁 Invite &amp; Earn</p>
      <p style={{ fontSize: 13, color: 'var(--color-inkMuted)', marginBottom: 12 }}>Invite a friend — you both get a reward once they get a paid plan.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input readOnly value={shareLink} style={{ ...FIELD, flex: 1, padding: 10, borderRadius: 10, fontSize: 12, minWidth: 0 }} />
        <button onClick={copyLink} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontSize: 13, fontWeight: 700 }}>{copied ? '✓' : 'Copy'}</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-inkMuted)' }}>{info.totalReferred} invited · {info.totalRewarded} rewarded · {info.pending} pending</p>
    </div>
  );
}
