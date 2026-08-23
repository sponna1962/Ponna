'use client';

// Profile page — implements the profile-completion requirement's fields:
// Name (read-only), Phone (read-only), District, City/Town/Village,
// Preparing For (multiple), Current Plan/Status, Plan Expiry, Language, Logout.
//
// This same page IS the "Complete Your Profile" flow — when a student is
// redirected here from a locked Rank or from a payment attempt, the required
// fields are simply highlighted/empty and ready to fill in; there's no
// separate screen to build or keep in sync.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

const EXAM_OPTIONS = ['TNPSC', 'UPSC', 'Banking', 'Police', 'SSC', 'Railways'];

type ProfileData = {
  name: string | null;
  phone: string | null;
  district: string | null;
  cityTownVillage: string | null;
  preparingFor: string[];
  profileComplete: boolean;
  planName: string;
  planExpiresAt: string | null;
};

export default function ProfilePage() {
  const { t, lang, setLang } = useLanguage();
  const searchParams = useSearchParams();
  const cameFromGate = searchParams.get('complete') === '1'; // set when redirected here because a gate blocked the student

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [preparingFor, setPreparingFor] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    studentFetch('/students/me/profile')
      .then((r) => r.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setDistrict(data.district ?? '');
        setCity(data.cityTownVillage ?? '');
        setPreparingFor(data.preparingFor ?? []);
      })
      .catch(() => {});
  }, []);

  function toggleExam(exam: string) {
    setPreparingFor((prev) => (prev.includes(exam) ? prev.filter((e) => e !== exam) : [...prev, exam]));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await studentFetch('/students/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district, cityTownVillage: city, preparingFor }),
    });
    setSaving(false);
    if (res.ok) {
      const result = await res.json();
      setProfile((p) => (p ? { ...p, district, cityTownVillage: city, preparingFor, profileComplete: result.profileComplete } : p));
      setSaved(true);
    }
  }

  if (!profile) return <p style={{ padding: 24, color: '#94a3b8' }}>{t.quiz.loading}</p>;

  const missingRequired = !district || !city || preparingFor.length === 0;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <strong style={{ fontSize: 16 }}>{t.profile.title}</strong>
        </div>
        <LanguageToggle />
      </div>

      <div style={{ padding: '0 20px' }}>
        {cameFromGate && !profile.profileComplete && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>{t.profile.completeYourProfile}</strong>
            <span style={{ fontSize: 13, color: '#78350f' }}>{t.profile.completeProfileNote}</span>
          </div>
        )}

        {/* Read-only identity fields */}
        <Field label={t.profile.name}>
          <span style={{ color: '#334155' }}>{profile.name ?? '—'}</span>
        </Field>
        <Field label={t.profile.phone}>
          <span style={{ color: '#334155' }}>{profile.phone ?? '—'}</span>
        </Field>

        {/* Editable, required-for-gates fields */}
        <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginTop: 16, marginBottom: 6 }}>
          {t.profile.district} {!district && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}
        />

        <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          {t.profile.cityTownVillage} {!city && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}
        />

        <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          {t.profile.preparingFor} {preparingFor.length === 0 && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {EXAM_OPTIONS.map((exam) => (
            <button
              key={exam}
              onClick={() => toggleExam(exam)}
              style={{
                padding: '6px 14px',
                borderRadius: 16,
                border: preparingFor.includes(exam) ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                background: preparingFor.includes(exam) ? '#0f172a' : '#fff',
                color: preparingFor.includes(exam) ? '#fff' : '#334155',
                fontSize: 13,
              }}
            >
              {exam}
            </button>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{ width: '100%', padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600, marginBottom: 8 }}
        >
          {saving ? '…' : t.profile.save}
        </button>
        {saved && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 16 }}>{t.profile.saved}</p>}

        {/* Plan & language */}
        <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <Field label={t.profile.currentPlan}>
            <span style={{ color: '#334155' }}>{profile.planName}</span>
          </Field>
          {profile.planExpiresAt && (
            <Field label={t.profile.planExpiry}>
              <span style={{ color: '#334155' }}>{new Date(profile.planExpiresAt).toLocaleDateString()}</span>
            </Field>
          )}
          <Field label={t.profile.language}>
            <select value={lang} onChange={(e) => setLang(e.target.value as 'ta' | 'en')}>
              <option value="ta">தமிழ்</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 14, color: '#64748b' }}>{label}</span>
      {children}
    </div>
  );
}
