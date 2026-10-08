'use client';

import Image from 'next/image';
import {
  HomeIcon, StudyNotesIcon, PracticeIcon, AskPonnaIcon, MistakesIcon,
  DailyQuizIcon, LiveExamIcon, ProgressIcon, CutoffPredictorIcon,
  AboutIcon, HelpIcon, PlansIcon, CloseIcon,
} from './icons';

const primary = [
  ['/', 'Home', HomeIcon],
  ['/current-affairs', 'Current Affairs', StudyNotesIcon],
  ['/tnpsc-group-4/notification-2026', 'Group 4 அறிவிப்பு 2026', StudyNotesIcon],
] as const;

const preparation = [
  ['/quiz', 'Start Practice', PracticeIcon],
  ['/ask-ponna', 'Ask Ponna', AskPonnaIcon],
  ['/mistakes', 'Review Mistakes', MistakesIcon],
  ['/study-notes', 'Study Notes', StudyNotesIcon],
  ['/daily-quiz', 'Daily Challenge', DailyQuizIcon],
  ['/live-exam', 'Live Exam', LiveExamIcon],
  ['/adaptive-mock', 'Adaptive Mock', PracticeIcon],
  ['/dashboard', 'Performance', ProgressIcon],
  ['/cutoff-predictor', 'Cut-off Predictor', CutoffPredictorIcon],
] as const;

const support = [
  ['/about', 'About PONNA', AboutIcon],
  ['/help', 'Help & Support', HelpIcon],
] as const;

function Row({ item, active = false }: { item: readonly [string, string, any]; active?: boolean }) {
  const [href, label, Icon] = item;
  return (
    <a href={href} className={active ? 'row active' : 'row'}>
      <span className="icon"><Icon size={18} color={active ? '#0B3864' : '#6B7B88'} /></span>
      <span className="label">{label}</span>
      {active && <span className="current">Current</span>}
    </a>
  );
}

export default function MenuDesignPreview() {
  return (
    <main className="preview-page">
      <div className="preview-note">
        <strong>PONNA Menu — Design Preview</strong>
        <span>உள்ளடக்கம், வரிசை, இணைப்புகள் மாற்றப்படவில்லை.</span>
      </div>

      <div className="stage">
        <div className="drawer">
          <header className="drawer-header">
            <div className="logo-wrap">
              <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority />
            </div>
            <button aria-label="Close"><CloseIcon size={18} color="#20384D" /></button>
          </header>

          <div className="drawer-body">
            <nav aria-label="PONNA menu">
              <div className="primary-list">
                {primary.map((item, i) => <Row key={item[0]} item={item} active={i === 0} />)}
              </div>

              <SectionTitle>PREPARATION</SectionTitle>
              <div className="item-list">
                {preparation.map((item) => <Row key={item[0]} item={item} />)}
              </div>

              <SectionTitle>SUPPORT</SectionTitle>
              <div className="item-list">
                {support.map((item) => <Row key={item[0]} item={item} />)}
              </div>

              <div className="legal">
                <div>
                  <a href="/terms">Terms</a>
                  <a href="/privacy">Privacy</a>
                  <a href="/refund-policy">Refund</a>
                  <a href="/shipping-policy">Delivery</a>
                  <a href="/contact">Contact</a>
                </div>
                <small>ARLENA (OPC) PRIVATE LIMITED</small>
              </div>
            </nav>
          </div>

          <div className="drawer-footer">
            <a href="/plans" className="pass">
              <span className="pass-icon"><PlansIcon size={19} color="#0B3864" /></span>
              <span>
                <strong>Pass</strong>
                <small>பயிற்சியைத் தொடருங்கள்</small>
              </span>
              <b>›</b>
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .preview-page {
          min-height: 100dvh;
          background: #EAF0F2;
          font-family: 'Noto Sans Tamil','Nirmala UI',Latha,Arial,sans-serif;
          color: #20384D;
          padding: 18px;
        }
        .preview-note {
          max-width: 520px;
          margin: 0 auto 14px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 13px;
          color: #536575;
        }
        .preview-note strong { color: #0B3864; font-size: 15px; }
        .stage {
          max-width: 520px;
          min-height: calc(100dvh - 88px);
          margin: 0 auto;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
        }
        .drawer {
          width: min(100%, 360px);
          height: calc(100dvh - 88px);
          min-height: 620px;
          background: #FFFEFB;
          box-shadow: 12px 0 32px rgba(32,56,77,.13);
          border-right: 1px solid #D9E1E5;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .drawer-header {
          flex: none;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 3px solid #E2B04A;
          background: #fff;
        }
        .logo-wrap {
          background: #fff;
          border: 1px solid #DDE5E9;
          padding: 4px 10px;
          border-radius: 7px;
          display: flex;
        }
        .logo-wrap :global(img) { width: 178px !important; height: auto !important; }
        .drawer-header button {
          width: 36px;
          height: 36px;
          border: 1px solid #DDE5E9;
          border-radius: 50%;
          background: #fff;
          display: grid;
          place-items: center;
        }
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px 12px;
        }
        .primary-list { padding-bottom: 6px; border-bottom: 1px solid #E1E7EA; }
        .row {
          min-height: 48px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px;
          border-left: 3px solid transparent;
          color: #20384D;
          text-decoration: none;
          font-size: 17px;
          font-weight: 500;
        }
        .row.active {
          border-left-color: #E2B04A;
          background: #F5F8F9;
          font-weight: 800;
        }
        .icon {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: grid;
          place-items: center;
          border: 1px solid #D9E1E5;
          background: #FAFBFA;
          border-radius: 6px;
        }
        .label { flex: 1; min-width: 0; }
        .current {
          font-size: 10px;
          color: #17835E;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .5px;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 15px 10px 5px;
          color: #52706D;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.8px;
        }
        .section-title::after { content: ''; flex: 1; height: 1px; background: #D7DFE2; }
        .item-list .row { min-height: 46px; }
        .legal {
          margin: 12px 10px 2px;
          padding-top: 10px;
          border-top: 1px solid #E1E7EA;
          color: #71808B;
          font-size: 11px;
          line-height: 1.8;
        }
        .legal a { color: inherit; text-decoration: underline; margin-right: 10px; }
        .legal small { font-size: 10px; }
        .drawer-footer {
          flex: none;
          padding: 10px 14px 14px;
          background: #fff;
          border-top: 1px solid #DDE5E9;
        }
        .pass {
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 62px;
          padding: 8px 13px;
          background: #F5C548;
          color: #20384D;
          text-decoration: none;
          border: 1px solid #DDAE35;
          border-radius: 10px;
          box-shadow: 0 5px 12px rgba(176,122,16,.12);
        }
        .pass-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: rgba(255,255,255,.55);
        }
        .pass strong { display: block; font-size: 18px; line-height: 1.2; }
        .pass small { display: block; font-size: 11px; margin-top: 2px; }
        .pass b { margin-left: auto; font-size: 27px; font-weight: 400; }
        @media (max-width: 420px) {
          .preview-page { padding: 0; background: #fff; }
          .preview-note { display: none; }
          .stage { min-height: 100dvh; }
          .drawer { width: 100%; height: 100dvh; border-right: 0; }
          .logo-wrap :global(img) { width: 164px !important; }
        }
      `}
      </style>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title">{children}</div>;
}
