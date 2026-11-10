'use client';

// Shared top bar, header (full menu on computers, the StudentMenu drawer on
// phones) and footer for the redesigned public pages: the home page and the
// /exams/<slug> pages. Styles are in ../home-v2.css, scoped under .pn2.

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { EXAMS, EXAM_GROUPS, examHref } from '../../lib/exams';

export const PHONE_DISPLAY = '99653 99896';
export const PHONE_HREF = 'tel:+919965399896';
const COMPANY_ADDRESS = 'Vaigai Vilas Colony, Kochadi, Madurai – 625016';
const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61594326726262';
const WHATSAPP_CHANNEL_URL = ''; // shown once the channel link is supplied

const GROUP4_EXAM_DATE = { y: 2027, m: 1, d: 10 };

/** Days left to the TNPSC Group 4 written exam; null until mounted. */
export function useGroup4Days() {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const exam = new Date(GROUP4_EXAM_DATE.y, GROUP4_EXAM_DATE.m - 1, GROUP4_EXAM_DATE.d).getTime();
      setDays(Math.max(0, Math.ceil((exam - today) / 86400000)));
    };
    update();
    const timer = window.setInterval(update, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  return days;
}

export function Ico({ children, w = 1.8 }: { children: ReactNode; w?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
export const PhonePath = <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />;

type HeaderProps = {
  menu?: ReactNode;
  account?: ReactNode;
  onLogin?: () => void;
  onStart?: () => void;
};

export function SiteHeader({ menu, account, onLogin, onStart }: HeaderProps) {
  const days = useGroup4Days();
  const startClick = onStart ? (e: MouseEvent) => { e.preventDefault(); onStart(); } : undefined;
  const loginClick = onLogin ? (e: MouseEvent) => { e.preventDefault(); onLogin(); } : undefined;

  return (
    <>
      <div className="util">
        <div className="wrap">
          <div>
            <b>TNPSC Group 4 தேர்வு</b><span className="date">: 10 ஜனவரி 2027</span>
            {days !== null && <> &nbsp;|&nbsp; <span className="days">இன்னும் {days} நாட்கள்</span></>}
          </div>
          <div className="help">
            <a href={PHONE_HREF}><Ico w={2}>{PhonePath}</Ico>உதவிக்கு: <b>{PHONE_DISPLAY}</b></a>
            <a href="/contact">தொடர்புக்கு</a>
          </div>
        </div>
      </div>

      <header className="head">
        <div className="wrap">
          {menu ? <div className="menu-slot">{menu}</div> : <span />}
          <a className="logo" href="/"><img src="/logo-wordmark.png" alt="PONNA.in" width={982} height={264} /></a>
          <ul className="nav">
            <li>
              <a href="/#exams">தேர்வுகள்<i className="caret" /></a>
              <div className="drop mega">
                {EXAM_GROUPS.map((g) => (
                  <div key={g.id} className="mega-col">
                    <div className="mega-h">{g.title}</div>
                    {EXAMS.filter((e) => e.group === g.id).map((e) => (
                      <a key={e.slug} href={examHref(e)} className={e.ready ? 'on' : ''}>
                        <b>{e.name}</b>
                        <span className={`tag${e.ready ? '' : ' soon'}`}>{e.ready ? 'பயிற்சி தயார்' : 'விரைவில்'}</span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </li>
            <li>
              <a href="/quiz" onClick={startClick}>தேர்வுப் பயிற்சி<i className="caret" /></a>
              <ul className="drop">
                <li><a href="/quiz" onClick={startClick}><b>Practice</b><small>பாடவாரியாகக் கேள்விப் பயிற்சி</small></a></li>
                <li><a href="/live-exam"><b>Live Exam</b><small>தேர்வு போன்ற சூழலில் எழுதலாம்</small></a></li>
                <li><a href="/adaptive-mock"><b>Adaptive Mock</b><small>உங்கள் நிலைக்கேற்ற மாதிரித் தேர்வு</small></a></li>
                <li><a href="/study-notes"><b>Study Notes</b><small>தேர்வுவாரியாகப் பாடக்குறிப்புகள்</small></a></li>
                <li><a href="/tnpsc-group-4/notification-2026"><b>தேர்வு அறிவிப்புகள்</b><small>Group 4 அறிவிப்பு 2026 முழு வழிகாட்டி</small></a></li>
              </ul>
            </li>
            <li>
              <a href="/current-affairs">பொதுப் பகுதிகள்<i className="caret" /></a>
              <ul className="drop">
                <li className="drop-h">எல்லாத் தேர்வுக்கும் பொதுவானவை</li>
                <li><a href="/current-affairs"><b>Current Affairs</b><small>தினசரி நடப்பு நிகழ்வுகள்</small></a></li>
                <li><a href="/daily-quiz"><b>Daily Challenge</b><small>தினசரி Current Affairs, Brain Challenge</small></a></li>
                <li><a href="/mind-gym"><b>Mind Gym</b><small>நினைவாற்றல், வேகப் பயிற்சிகள்</small></a></li>
                <li><a href="/ask-ponna"><b>Ask PONNA</b><small>தேர்வு பற்றிய சந்தேகங்களுக்கு விளக்கம்</small></a></li>
              </ul>
            </li>
            <li>
              <a href="/dashboard">என் முன்னேற்றம்<i className="caret" /></a>
              <ul className="drop">
                <li><a href="/dashboard"><b>Performance</b><small>மதிப்பெண், முன்னேற்றம்</small></a></li>
                <li><a href="/mistakes"><b>Review Mistakes</b><small>தவறிய கேள்விகளை மீண்டும் பார்க்க</small></a></li>
                <li><a href="/cutoff-predictor"><b>Cut-off Predictor</b><small>கட்-ஆஃப் கணிப்பு</small></a></li>
              </ul>
            </li>
            <li><a href="/plans">திட்டங்கள்</a></li>
          </ul>
          <div className="acts">
            {account
              ? <div className="account-slot">{account}</div>
              : <a className="btn btn-line" href="/?startLogin=1" onClick={loginClick}>உள்நுழைவு</a>}
            <a className="btn btn-gold" href="/quiz" onClick={startClick}>இலவசப் பயிற்சி</a>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ onStart }: { onStart?: () => void }) {
  const startClick = onStart ? (e: MouseEvent) => { e.preventDefault(); onStart(); } : undefined;
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="brand">PONNA<em>.in</em></div>
            <p style={{ marginTop: 6 }}>அரசுப் போட்டித் தேர்வுகளுக்கான பயிற்சி</p>
            <p className="co">
              <b>ARLENA (OPC) PRIVATE LIMITED</b><br />
              CIN: U63122TN2026OPC197880<br />
              Director: HARSHA S S
              {COMPANY_ADDRESS && <><br />{COMPANY_ADDRESS}</>}
            </p>
            {(FACEBOOK_URL || WHATSAPP_CHANNEL_URL) && (
              <div className="social">
                {FACEBOOK_URL && <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.500 21v-7.500h2.500l.400-3h-2.900V8.600c0-.900.300-1.500 1.600-1.500h1.500V4.400c-.300 0-1.200-.100-2.200-.100-2.200 0-3.700 1.300-3.700 3.800v2.400H8.200v3h2.500V21z" /></svg>Facebook</a>}
                {WHATSAPP_CHANNEL_URL && <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l1.300-4A8 8 0 1 1 8 18.700z" /></svg>WhatsApp Channel</a>}
              </div>
            )}
          </div>
          <div>
            <h4>தேர்வுகள்</h4>
            <ul>
              {EXAMS.filter((e) => e.group === 'group').map((e) => (
                <li key={e.slug}><a href={examHref(e)}>TNPSC {e.name}</a></li>
              ))}
              <li><a href="/#exams">தொழில்நுட்பப் பணித் தேர்வுகள்</a></li>
            </ul>
          </div>
          <div>
            <h4>தேர்வுப் பயிற்சி</h4>
            <ul>
              <li><a href="/quiz" onClick={startClick}>Practice</a></li>
              <li><a href="/live-exam">Live Exam</a></li>
              <li><a href="/adaptive-mock">Adaptive Mock</a></li>
              <li><a href="/study-notes">Study Notes</a></li>
            </ul>
            <h4 style={{ marginTop: 20 }}>எல்லாத் தேர்வுக்கும் பொது</h4>
            <ul>
              <li><a href="/current-affairs">Current Affairs</a></li>
              <li><a href="/daily-quiz">Daily Challenge</a></li>
              <li><a href="/mind-gym">Mind Gym</a></li>
              <li><a href="/ask-ponna">Ask PONNA</a></li>
            </ul>
          </div>
          <div>
            <h4>தொடர்பு</h4>
            <ul>
              <li>தொலைபேசி / WhatsApp:<br /><a href={PHONE_HREF} style={{ color: '#fff', fontWeight: 600 }}>+91 {PHONE_DISPLAY}</a></li>
              <li><a href="mailto:ponna@arlena.in">ponna@arlena.in</a></li>
              <li><a href="/contact">தொடர்புப் பக்கம்</a></li>
              <li><a href="/about">PONNA.in பற்றி</a></li>
              <li><a href="/plans">திட்டங்கள்</a></li>
              <li><a href="/teachers">ஆசிரியர்களுக்கு</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 ARLENA (OPC) PRIVATE LIMITED. All rights reserved.</span>
          <span><a href="/terms">Terms</a> &nbsp;|&nbsp; <a href="/privacy">Privacy</a> &nbsp;|&nbsp; <a href="/refund-policy">Refund Policy</a> &nbsp;|&nbsp; <a href="/shipping-policy">Delivery</a></span>
        </div>
      </div>
    </footer>
  );
}
