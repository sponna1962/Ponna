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

import { useEffect, useState } from 'react';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

type EducationStatus = 'SCHOOL_STUDENT' | 'COLLEGE_STUDENT' | 'COMPLETED_STUDIES' | '';

type ProfileData = {
  name: string | null;
  phone: string | null;
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
  profileComplete: boolean;
};

export default function ProfilePage() {
  const { t } = useLanguage();
  // Read ?complete=1 via the plain browser API rather than Next's
  // useSearchParams(), which requires a Suspense boundary during static
  // export and caused an opaque build failure. Read once on mount,
  // client-side only — fine here since it only controls a UI banner.
  const [cameFromGate, setCameFromGate] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCameFromGate(new URLSearchParams(window.location.search).get('complete') === '1');
    }
  }, []);

  const [profile, setProfile] = useState<ProfileData | null>(null);
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [googleLinkMessage, setGoogleLinkMessage] = useState<{ ok: boolean; text: string } | null>(null);

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
      })
      .catch(() => {});
  }, []);

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
      }),
    });
    setSaving(false);
    if (res.ok) {
      const result = await res.json();
      setProfile((p) => (p ? { ...p, profileComplete: result.profileComplete } : p));
      setSaved(true);
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
