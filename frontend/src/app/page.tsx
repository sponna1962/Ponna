'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  ConfirmationResult,
} from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { useLanguage } from '../lib/language-context';
import { apiUrl } from '../lib/api-config';
import { StudentMenu } from '../components/StudentMenu';
import { LogoutIcon, ProfileIcon, DevicesIcon, PracticeIcon, ProgressIcon, AboutIcon, AskPonnaIcon, MistakesIcon, StudyNotesIcon, DailyQuizIcon, LiveExamIcon, SubjectPreferenceIcon, CutoffPredictorIcon } from '../components/icons';
import { BitterFontLinks } from '../lib/brand-theme';
import { getDeviceId, getDeviceLabel } from '../lib/device-id';

type View = 'main' | 'chooseMethod' | 'phone' | 'deviceLimit';
type DeviceInfo = { deviceId: string; label: string | null; lastSeenAt: string };

const C = {
  navy: '#0B3864',
  navy2: '#123F68',
  green: '#16835E',
  green2: '#EAF8EF',
  mint: '#DDF5E8',
  yellow: '#FFD32A',
  yellow2: '#FFF4BE',
  red: '#E62D3A',
  ink: '#17324D',
  muted: '#5E7184',
  line: '#E1E8EC',
  white: '#FFFFFF',
  paper: '#F8FBFA',
};

const cards = [
  { icon: PracticeIcon, title: 'பயிற்சி கேள்விகள்', sub: 'தமிழில்', href: '/quiz', tone: 'blue' },
  { icon: AboutIcon, title: 'மாணவர்கள்', sub: 'நம்பிக்கையுடன்', href: '/about', tone: 'purple' },
  { icon: ProgressIcon, title: 'திறன் வளர்ப்பு', sub: 'முன்னேற்றம்', href: '/quiz', tone: 'green' },
  { icon: ProgressIcon, title: 'மாணவர் மதிப்பீடு', sub: 'தெளிவான முன்னேற்றம்', href: '/about', tone: 'pink' },
];

const tools = [
  { icon: PracticeIcon, title: 'பயிற்சியைத் தொடங்குங்கள்', body: 'பாடங்களையும் கேள்விகளையும் தேர்ந்தெடுத்து திட்டமிட்டுப் பயிற்சி செய்யுங்கள்.', href: '/quiz', tone: 'mint' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', body: 'தேர்வு தொடர்பான உங்கள் சந்தேகங்களுக்கு எளிய விளக்கங்களைப் பெறுங்கள்.', href: '/ask-ponna', tone: 'blue' },
  { icon: MistakesIcon, title: 'தவறுகளை மீண்டும் பயிற்சி செய்யுங்கள்', body: 'தவறாகப் பதிலளித்த கேள்விகளை மீண்டும் செய்து, அதே தவறைத் தவிர்க்கப் பழகுங்கள்.', href: '/quiz', tone: 'pink' },
  { icon: StudyNotesIcon, title: 'படிப்புக் குறிப்புகள்', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களை எளிமையாகவும் தெளிவாகவும் படியுங்கள்.', href: '/current-affairs', tone: 'yellow' },
  { icon: DailyQuizIcon, title: 'தினசரி சவால்', body: 'தினமும் புதிய கேள்விகளுடன் உங்கள் அறிவையும் வேகத்தையும் சோதியுங்கள்.', href: '/daily-quiz', tone: 'purple' },
  { icon: LiveExamIcon, title: 'நேரடித் தேர்வு', body: 'தேர்வு போன்ற சூழலில் முழுமையான மாதிரித் தேர்வை எழுதி பயிற்சி பெறுங்கள்.', href: '/tnpsc-group-4/online-test', tone: 'red' },
  { icon: SubjectPreferenceIcon, title: 'தனிப்பயன் மாதிரித் தேர்வு', body: 'உங்கள் திறனுக்கேற்ப கேள்விகளின் கடினத்தன்மை மாறும் வகையில் பயிற்சி செய்யுங்கள்.', href: '/quiz', tone: 'blue' },
  { icon: ProgressIcon, title: 'செயல்திறன்', body: 'உங்கள் முன்னேற்றம், பலம், மேம்படுத்த வேண்டிய பகுதிகளைத் தெளிவாகப் பாருங்கள்.', href: '/profile', tone: 'green' },
];

function tone(tone: string) {
  const map: Record<string, { bg: string; icon: string }> = {
    blue: { bg: '#E9F5FF', icon: '#1687D4' },
    purple: { bg: '#F2EBFF', icon: '#7C4DCE' },
    green: { bg: '#E8F8EF', icon: '#19A56C' },
    pink: { bg: '#FFEAF1', icon: '#E84D78' },
    yellow: { bg: '#FFF4D8', icon: '#D79623' },
    red: { bg: '#FFE9EE', icon: '#E83F58' },
    mint: { bg: '#E7F8F0', icon: '#1E9A6A' },
  };
  return map[tone] ?? map.blue;
}

export default function IndexPage() {
  const { t } = useLanguage();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<View>('main');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFirebaseToken, setPendingFirebaseToken] = useState<string | null>(null);
  const [existingDevices, setExistingDevices] = useState<DeviceInfo[]>([]);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [headerPhotoUrl, setHeaderPhotoUrl] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'google' | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('ponna_student_token'));
    setCheckedAuth(true);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(apiUrl('/students/me/profile'), {
      headers: { Authorization: `Bearer ${localStorage.getItem('ponna_student_token') ?? ''}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setLoginMethod(data?.phone ? 'phone' : data?.email ? 'google' : null);
        setHeaderPhotoUrl(data?.photoUrl ?? null);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  function openLogin() {
    setError(null);
    setView('chooseMethod');
  }

  function completeLogin(token: string) {
    localStorage.setItem('ponna_student_token', token);
    setIsLoggedIn(true);
    setView('main');
    setLoading(false);
  }

  async function attemptLogin(firebaseIdToken: string) {
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    const res = await fetch(apiUrl('/auth/firebase-login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firebaseIdToken,
        deviceId: getDeviceId(),
        deviceLabel: getDeviceLabel(),
        referralCode,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (body.code === 'ACCOUNT_LINKING_CONFLICT') {
        setError(t.login.linkingConflict);
      } else if (body.code === 'DEVICE_LIMIT_REACHED') {
        setPendingFirebaseToken(firebaseIdToken);
        setExistingDevices(body.devices ?? []);
        setView('deviceLimit');
      } else {
        setError(body.error ?? t.login.sendError);
      }
      setLoading(false);
      return;
    }
    completeLogin(body.token);
  }

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      await attemptLogin(await credential.user.getIdToken());
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err?.message ?? t.login.sendError);
      }
      setLoading(false);
    }
  }

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      try { verifierRef.current?.clear(); } catch {}
      if (recaptchaContainerRef.current) recaptchaContainerRef.current.innerHTML = '';
      const verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current!, { size: 'invisible' });
      verifierRef.current = verifier;
      confirmationRef.current = await signInWithPhoneNumber(
        firebaseAuth,
        phone.startsWith('+') ? phone : `+91${phone}`,
        verifier,
      );
      setOtpSent(true);
    } catch {
      setError(t.login.sendError);
      try { verifierRef.current?.clear(); } catch {}
      verifierRef.current = null;
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      if (!confirmationRef.current) throw new Error('OTP request missing');
      const credential = await confirmationRef.current.confirm(otp);
      await attemptLogin(await credential.user.getIdToken());
    } catch (err: any) {
      setError(err?.code === 'auth/code-expired' ? (t.login.otpExpiredError ?? t.login.verifyError) : t.login.verifyError);
      setLoading(false);
    }
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
      await attemptLogin(pendingFirebaseToken);
    } catch {
      setError(t.login.sendError);
      setLoading(false);
    } finally {
      setRemovingDeviceId(null);
    }
  }

  function logout() {
    localStorage.removeItem('ponna_student_token');
    setIsLoggedIn(false);
    setAccountMenuOpen(false);
    setView('main');
  }

  if (!checkedAuth) return null;

  return (
    <main style={{ width: '100%', maxWidth: 620, margin: '0 auto', minHeight: '100dvh', background: C.paper, color: C.ink, boxSizing: 'border-box' }}>
      <BitterFontLinks />

      <header style={{ height: 62, background: C.white, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', position: 'sticky', top: 0, zIndex: 30, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StudentMenu />
          <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority style={{ width: 144, height: 'auto' }} />
        </div>
        {isLoggedIn ? (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAccountMenuOpen((v) => !v)} aria-label="Account" style={{ width: 40, height: 40, borderRadius: 22, border: '1px solid #D9E1E7', background: C.white, overflow: 'hidden', padding: 0, cursor: 'pointer' }}>
              {headerPhotoUrl ? <img src={headerPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : loginMethod === 'google' ? <GoogleIcon size={17} /> : '📱'}
            </button>
            {accountMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 48, width: 180, background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 12px 35px rgba(0,0,0,.14)', overflow: 'hidden' }}>
                <a href="/profile" style={menuItem}><ProfileIcon size={16} color={C.green} /> {t.menu.profile}</a>
                <a href="/devices" style={menuItem}><DevicesIcon size={16} color={C.green} /> {t.menu.devices}</a>
                <button onClick={logout} style={{ ...menuItem, color: C.red, border: 0, borderTop: `1px solid ${C.line}`, background: C.white, width: '100%', cursor: 'pointer' }}><LogoutIcon size={16} color={C.red} /> {t.menu.logout}</button>
              </div>
            )}
          </div>
        ) : (
          view === 'main' && <button onClick={openLogin} style={{ background: C.navy, color: C.white, border: 0, borderRadius: 22, padding: '9px 17px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>உள்நுழைவு</button>
        )}
      </header>

      {view === 'main' && (
        <>
          <section style={{ position: 'relative', overflow: 'hidden', minHeight: 255, padding: '25px 22px 18px', boxSizing: 'border-box', background: 'linear-gradient(115deg,#EAFBF0 0%,#F7FFF9 58%,#DDF4E7 100%)' }}>
            <div style={{ position: 'relative', zIndex: 2, width: '62%' }}>
              <div style={{ color: C.green, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>அரசுப் போட்டித் தேர்வுகளுக்கான நம்பகமான பயிற்சித் தளம்</div>
              <h1 style={{ margin: 0, color: C.navy, fontSize: 27, lineHeight: 1.24, fontWeight: 900 }}>
                TNPSC Group 4<br />
                தேர்வுக்கான உங்கள்<br />
                <span style={{ color: C.red }}>முழுமையான பயிற்சி</span><br />
                இங்கே தொடங்குகிறது!
              </h1>
              <div style={{ marginTop: 13, display: 'grid', gap: 6, fontSize: 12, fontWeight: 650, color: C.ink }}>
                <span>✓ புதிய பாடத்திட்டத்துக்கு ஏற்ப பயிற்சி</span>
                <span>✓ தமிழில் எளிய விளக்கங்களுடன்</span>
                <span>✓ உங்கள் முன்னேற்றத்தை நீங்களே அறிந்துகொள்ள</span>
              </div>
              <button onClick={() => (isLoggedIn ? (window.location.href = '/quiz') : openLogin())} style={{ marginTop: 14, border: 0, background: C.yellow, color: C.ink, borderRadius: 22, padding: '11px 17px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 5px 12px rgba(217,164,0,.2)' }}>
                இப்போதே பயிற்சியைத் தொடங்குங்கள் →
              </button>
            </div>
            <Image src="/ponna-hero-woman.jpg" alt="PONNA மாணவி" width={227} height={250} priority style={{ position: 'absolute', right: 0, bottom: 0, width: '47%', height: '100%', objectFit: 'cover', objectPosition: 'center top', mixBlendMode: 'normal' }} />
          </section>

          <div style={{ padding: '9px 10px 0', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
            {cards.map((c) => { const Icon = c.icon; const s = tone(c.tone); return (
              <a key={c.title} href={c.href} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 13, minHeight: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: C.navy, boxShadow: '0 2px 8px rgba(28,53,71,.04)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: s.bg, display: 'grid', placeItems: 'center', marginBottom: 5 }}><Icon size={18} color={s.icon} /></span>
                <strong style={{ fontSize: 11.5, textAlign: 'center' }}>{c.title}</strong>
                <span style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>{c.sub}</span>
              </a>
            ); })}
          </div>

          <a href="/tnpsc-group-4/notification-2026" style={{ display: 'block', margin: '9px 12px 0', borderRadius: 15, overflow: 'hidden', border: '1px solid #CFE6D9', background: '#EAF8EF', textDecoration: 'none' }}>
            <Image src="/ads/tnpsc-group4-banner.png" alt="TNPSC Group 4 2026 அறிவிப்பு" width={900} height={420} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </a>

          <section style={{ padding: '16px 12px 0' }}>
            <h2 style={{ textAlign: 'center', color: C.navy, fontSize: 20, lineHeight: 1.35, margin: '0 0 13px', fontWeight: 900 }}>
              உங்கள் தேர்வுத் தயாரிப்புக்குத் தேவையான அனைத்தும்<br />ஒரே இடத்தில்
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {tools.map((item) => {
                const s = tone(item.tone);
                return (
                  <a key={item.title} href={item.href} style={{ minHeight: 112, background: s.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 12px', textDecoration: 'none', color: C.ink, boxSizing: 'border-box', display: 'block' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: C.white, display: 'grid', placeItems: 'center' }}><item.icon size={19} color={s.icon} /></span>
                      <strong style={{ color: s.icon, fontSize: 12.5, lineHeight: 1.25 }}>{item.title}</strong>
                    </div>
                    <p style={{ margin: 0, color: C.muted, fontSize: 10.5, lineHeight: 1.45 }}>{item.body}</p>
                  </a>
                );
              })}
            </div>

            <a href="/quiz" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, background: '#FFF1D8', border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 14px', textDecoration: 'none', color: C.ink }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: C.white, display: 'grid', placeItems: 'center' }}><CutoffPredictorIcon size={21} color={C.green} /></span>
              <span><strong style={{ display: 'block', color: C.navy, fontSize: 13 }}>கட்-ஆஃப் கணிப்பான்</strong><span style={{ display: 'block', color: C.muted, fontSize: 10.5, marginTop: 2 }}>உங்கள் பயிற்சி மற்றும் தேர்வு முடிவுகளை அடிப்படையாகக் கொண்டு கட்-ஆஃப் மதிப்பெண்ணை கணிக்க உதவும்.</span></span>
              <span style={{ marginLeft: 'auto', fontSize: 20, color: C.muted }}>›</span>
            </a>

            <a href="/current-affairs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, minHeight: 74, background: '#EAF4FB', border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 13px', textDecoration: 'none', overflow: 'hidden' }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ width: 36, height: 36, borderRadius: 10, background: C.white, display: 'grid', placeItems: 'center' }}><StudyNotesIcon size={21} color={C.navy} /></span><span><strong style={{ display: 'block', color: C.navy, fontSize: 13 }}>நடப்பு நிகழ்வுகள்</strong><span style={{ color: C.muted, fontSize: 10.5 }}>போட்டித் தேர்வுகளுக்குத் தேவையான முக்கியமான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படியுங்கள்.</span></span></span>
              <b style={{ color: C.red, fontSize: 9, background: C.white, borderRadius: 10, padding: '3px 6px' }}>NEW</b>
            </a>

            <div style={{ marginTop: 9, borderRadius: 15, padding: '17px 16px', background: 'linear-gradient(110deg,#E7F7EA,#F7FCEB)', border: '1px solid #D9EAD9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: C.white, display: 'grid', placeItems: 'center', flexShrink: 0 }}><PracticeIcon size={28} color={C.green} /></div>
              <div><strong style={{ display: 'block', color: C.navy, fontSize: 19 }}>தமிழில், எளிமையாக,<br />தேர்வு நோக்கில்!</strong><span style={{ display: 'block', marginTop: 5, color: C.muted, fontSize: 10.5 }}>அவசியமான பாடங்கள், பயிற்சிக் கேள்விகள், நடப்பு நிகழ்வுகள் — அனைத்தும் ஒரே இடத்தில்.</span><a href="/quiz" style={{ display: 'inline-block', marginTop: 9, background: C.yellow, color: C.ink, padding: '8px 13px', borderRadius: 18, fontWeight: 800, fontSize: 10.5, textDecoration: 'none' }}>பாடங்களைப் பார்க்க →</a></div>
            </div>

            <div style={{ marginTop: 9, background: C.white, borderRadius: 15, border: `1px solid ${C.line}`, padding: '15px 14px', textAlign: 'center' }}>
              <div style={{ color: C.yellow, fontSize: 24, marginBottom: 3 }}>“</div>
              <strong style={{ color: C.navy, fontSize: 13, lineHeight: 1.45 }}>PONNA மாணவரை மதிப்பிடுவதற்காக மட்டும் அல்ல;<br />மாணவர் தனது திறனை அறிந்துகொள்வதற்கும் முன்னேறுவதற்கும் உதவுகிறது.</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 13, fontSize: 9.5, color: C.muted }}>
                <span>பயிற்சி</span><span>முயற்சி</span><span>தவறுகளைச் சரிசெய்தல்</span><span>முன்னேற்றம்</span>
              </div>
            </div>

            <div style={{ margin: '9px 0 16px', borderRadius: 15, padding: '18px 16px', background: 'linear-gradient(135deg,#0A5B67,#167A63)', color: C.white, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <strong style={{ display: 'block', fontSize: 20, lineHeight: 1.3 }}>உங்கள் தேர்வுத் தயாரிப்பு<br />இன்று தொடங்கட்டும்!</strong>
                <span style={{ display: 'block', marginTop: 5, fontSize: 10.5, opacity: .9 }}>படிப்போம். பயிற்சி செய்வோம். தவறுகளைச் சரிசெய்வோம். முன்னேறுவோம்.</span>
                <button onClick={() => (isLoggedIn ? (window.location.href = '/quiz') : openLogin())} style={{ marginTop: 10, background: C.yellow, border: 0, color: C.ink, borderRadius: 20, padding: '9px 15px', fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>இப்போதே பயிற்சியைத் தொடங்குங்கள் →</button>
              </div>
              <div style={{ position: 'absolute', right: -15, bottom: -28, width: 145, height: 145, borderRadius: '50%', background: 'rgba(255,211,42,.18)' }} />
            </div>
          </section>
        </>
      )}

      {view === 'chooseMethod' && <LoginChoice loading={loading} error={error} onGoogle={signInWithGoogle} onPhone={() => { setError(null); setView('phone'); }} />}
      {view === 'phone' && <PhoneLogin phone={phone} setPhone={setPhone} otp={otp} setOtp={setOtp} otpSent={otpSent} loading={loading} error={error} recaptchaContainerRef={recaptchaContainerRef} onSubmit={otpSent ? verifyOtp : requestOtp} onBack={() => { setView('chooseMethod'); setOtpSent(false); setOtp(''); setError(null); }} />}
      {view === 'deviceLimit' && <DeviceLimit devices={existingDevices} removingDeviceId={removingDeviceId} error={error} onRemove={removeDeviceAndRetry} onCancel={() => { setView('main'); setPendingFirebaseToken(null); }} />}
    </main>
  );
}

const menuItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', textDecoration: 'none', color: '#17324D', fontSize: 13 };

function LoginChoice({ loading, error, onGoogle, onPhone }: { loading: boolean; error: string | null; onGoogle: () => void; onPhone: () => void }) {
  return <section style={loginBox}><h1 style={loginTitle}>உள்நுழையுங்கள்</h1><p style={loginSub}>உங்கள் பயிற்சியைத் தொடர ஒரு முறையைத் தேர்ந்தெடுக்கவும்.</p><button onClick={onGoogle} disabled={loading} style={googleBtn}><GoogleIcon /> Google மூலம் தொடரவும்</button><div style={orLine}>அல்லது</div><button onClick={onPhone} style={darkBtn}>📱 கைபேசி எண்ணைப் பயன்படுத்தவும்</button>{error && <p style={errorText}>{error}</p>}</section>;
}

function PhoneLogin({ phone, setPhone, otp, setOtp, otpSent, loading, error, recaptchaContainerRef, onSubmit, onBack }: any) {
  return <section style={loginBox}><button onClick={onBack} style={backBtn}>← பின்செல்</button><h1 style={loginTitle}>கைபேசி மூலம் உள்நுழைவு</h1><label style={label}>கைபேசி எண்</label><input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={otpSent} placeholder="9876543210" style={inputStyle} />{otpSent && <><label style={label}>OTP</label><input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="OTP" style={inputStyle} /></>}<div ref={recaptchaContainerRef} /><button onClick={onSubmit} disabled={loading || !phone} style={darkBtn}>{loading ? '…' : otpSent ? 'சரிபார்க்கவும்' : 'OTP அனுப்பவும்'}</button>{error && <p style={errorText}>{error}</p>}</section>;
}

function DeviceLimit({ devices, removingDeviceId, error, onRemove, onCancel }: any) {
  return <section style={loginBox}><h1 style={loginTitle}>சாதன வரம்பு</h1><p style={loginSub}>இரண்டு சாதனங்கள் ஏற்கனவே இணைக்கப்பட்டுள்ளன. ஒன்றை நீக்கி தொடருங்கள்.</p>{devices.map((d: DeviceInfo) => <div key={d.deviceId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 8 }}><span style={{ fontSize: 12 }}>{d.label ?? 'Device'}</span><button onClick={() => onRemove(d.deviceId)} disabled={removingDeviceId === d.deviceId} style={{ border: `1px solid ${C.red}`, color: C.red, background: C.white, borderRadius: 8, padding: '6px 9px' }}>{removingDeviceId === d.deviceId ? '…' : 'நீக்கவும்'}</button></div>)}{error && <p style={errorText}>{error}</p>}<button onClick={onCancel} style={backBtn}>முகப்புக்குத் திரும்பவும்</button></section>;
}

function StudentIllustration() {
  return <svg viewBox="0 0 260 250" aria-hidden="true" style={{ position: 'absolute', right: -6, bottom: -2, width: '49%', height: '100%', maxHeight: 255 }}>
    <circle cx="190" cy="64" r="39" fill="#FFD74A" opacity=".8" />
    <path d="M145 240c5-69 18-104 52-111 34-7 53 35 61 111z" fill="#176F83" />
    <path d="M168 133c-8 25-9 63-4 107h-22c-4-38 2-85 14-108z" fill="#0C5265" />
    <path d="M211 128c26 10 38 51 44 112h-25c-2-45-9-77-24-96z" fill="#145F70" />
    <path d="M181 91c8 8 26 10 35-1v31c-8 11-27 10-35 0z" fill="#F1B28D" />
    <ellipse cx="198" cy="67" rx="29" ry="35" fill="#F2B790" />
    <path d="M169 68c-3-29 12-52 38-49 19 2 31 17 29 39-12-9-25-16-43-13-7 11-13 19-24 23z" fill="#2A2422" />
    <path d="M169 73c-8 10-10 29 2 42" fill="none" stroke="#2A2422" strokeWidth="7" strokeLinecap="round" />
    <circle cx="188" cy="70" r="2.3" fill="#4D342A" /><circle cx="207" cy="70" r="2.3" fill="#4D342A" />
    <path d="M191 82c6 4 11 4 16 0" fill="none" stroke="#9B5B50" strokeWidth="2" strokeLinecap="round" />
    <path d="M151 146c22 13 48 18 76 8l18 57c-29 13-61 11-90-2z" fill="#176E83" />
    <path d="M150 157c-18 21-25 44-26 69" fill="none" stroke="#F2B790" strokeWidth="14" strokeLinecap="round" />
    <path d="M126 222l-23 9" stroke="#F2B790" strokeWidth="11" strokeLinecap="round" />
    <rect x="78" y="186" width="67" height="54" rx="7" fill="#F3C544" transform="rotate(-12 78 186)" />
    <rect x="84" y="181" width="62" height="10" rx="4" fill="#E74C3C" transform="rotate(-12 84 181)" />
    <path d="M128 111c-8 12-14 20-25 28" stroke="#F2B790" strokeWidth="13" strokeLinecap="round" />
    <path d="M93 137l22 11" stroke="#F2B790" strokeWidth="12" strokeLinecap="round" />
  </svg>;
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" /><path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.95H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.34z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" /></svg>;
}

const loginBox: React.CSSProperties = { padding: '34px 20px 60px', minHeight: 520, boxSizing: 'border-box', background: C.white };
const loginTitle: React.CSSProperties = { margin: '0 0 8px', color: C.navy, fontSize: 25, fontWeight: 900 };
const loginSub: React.CSSProperties = { color: C.muted, fontSize: 13, lineHeight: 1.5, margin: '0 0 24px' };
const googleBtn: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 13, border: '1px solid #D8E1E8', background: C.white, color: C.ink, fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 9, cursor: 'pointer' };
const darkBtn: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 13, border: 0, background: C.navy, color: C.white, fontWeight: 800, cursor: 'pointer' };
const orLine: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 0', color: C.muted, fontSize: 12 };
const errorText: React.CSSProperties = { color: C.red, fontSize: 12, lineHeight: 1.5 };
const backBtn: React.CSSProperties = { border: 0, background: 'transparent', color: C.muted, padding: 0, marginBottom: 20, cursor: 'pointer' };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: C.ink };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 13, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 14, fontSize: 15 };
