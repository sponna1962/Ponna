'use client';

// Interactive pieces of the Group 4 notification guide (Oct 2026): reading
// progress, table of contents (sticky sidebar on desktop, bottom sheet on
// mobile), share, deadline countdown, and the copy-protection + watermark
// layer. Everything here is progressive enhancement — the guide's text and
// all links are rendered on the server, so crawlers see the full content.

import { useEffect, useRef, useState } from 'react';
import { DEADLINE_ISO, PAGE_URL, SITE, TOC_GROUPS } from './guide-data';

type TocItem = { id: string; title: string };

// ---------------------------------------------------------------- progress
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (h.scrollTop / max) * 100)) : 0;
      if (bar.current) bar.current.style.width = pct + '%';
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="g4n-progress g4n-noprint" aria-hidden="true">
      <div ref={bar} className="g4n-progress-bar" />
    </div>
  );
}

// --------------------------------------------------------------------- TOC
export function GuideToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>('');
  const [open, setOpen] = useState(false);
  const byId = new Map(items.map((i) => [i.id, i]));

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const go = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    setOpen(false);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
  };

  const list = (
    <div className="g4n-toc-list">
      {TOC_GROUPS.map((g) => (
        <div key={g.title} className="g4n-toc-group">
          <p className="g4n-toc-gt">{g.title}</p>
          <ul>
            {g.ids.map((id) => {
              const it = byId.get(id);
              if (!it) return null;
              return (
                <li key={id}>
                  <a href={'#' + id} onClick={go(id)} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
                    {it.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <aside className="g4n-aside g4n-noprint" aria-label="பொருளடக்கம்">
        <p className="g4n-aside-h">பொருளடக்கம்</p>
        {list}
      </aside>

      <button type="button" className="g4n-fab g4n-noprint" onClick={() => setOpen(true)} aria-haspopup="dialog">
        ☰ பொருளடக்கம்
      </button>
      {open && (
        <div className="g4n-sheet-bg g4n-noprint" onClick={() => setOpen(false)}>
          <div className="g4n-sheet" role="dialog" aria-label="பொருளடக்கம்" onClick={(e) => e.stopPropagation()}>
            <div className="g4n-sheet-top">
              <b>பொருளடக்கம்</b>
              <button type="button" onClick={() => setOpen(false)} aria-label="மூடு">✕</button>
            </div>
            {list}
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------- share
export function ShareButton() {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const title = 'TNPSC Group 4 2026 அறிவிப்பு – முழுமையான வழிகாட்டி | PONNA.in';
  const text = 'TNPSC Group 4 2026 அறிவிப்பு: காலியிடங்கள், தகுதி, வயது, தேதிகள், விண்ணப்ப முறை – முழு விவரம்';

  const url = () => (typeof window !== 'undefined' ? window.location.origin + PAGE_URL : SITE + PAGE_URL);

  const onShare = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title, text, url: url() }); return; } catch { /* cancelled */ }
    }
    setMenu((m) => !m);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };
  const enc = encodeURIComponent;
  const u = () => url();

  return (
    <div className="g4n-share g4n-noprint">
      <button type="button" className="g4n-btn-gold" onClick={onShare} aria-haspopup="menu" aria-expanded={menu}>
        பகிர்க ↗
      </button>
      {menu && (
        <div className="g4n-share-menu" role="menu" onMouseLeave={() => setMenu(false)}>
          <a role="menuitem" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(text + ' ' + u())}`}>WhatsApp</a>
          <a role="menuitem" target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${enc(u())}&text=${enc(text)}`}>Telegram</a>
          <a role="menuitem" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(u())}`}>Facebook</a>
          <a role="menuitem" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${enc(u())}&text=${enc(text)}`}>X (Twitter)</a>
          <button type="button" role="menuitem" onClick={copy}>{copied ? '✓ இணைப்பு நகலெடுக்கப்பட்டது' : 'இணைப்பை நகலெடு'}</button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------- countdown
export function Countdown() {
  const [label, setLabel] = useState<string>('');
  useEffect(() => {
    const calc = () => {
      const ms = new Date(DEADLINE_ISO).getTime() - Date.now();
      if (ms <= 0) { setLabel('ஆன்லைன் விண்ணப்ப காலம் முடிந்தது'); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      setLabel(d >= 1 ? `விண்ணப்பிக்க இன்னும் ${d} நாட்கள் ${h} மணி` : `விண்ணப்பிக்க இன்னும் ${h} மணி நேரமே!`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, []);
  if (!label) return <span className="g4n-count" suppressHydrationWarning>கடைசி நாள்: 05.11.2026 இரவு 11.59 மணி</span>;
  return <span className="g4n-count">⏳ {label} · கடைசி நாள் 05.11.2026</span>;
}

// ----------------------------------------------- copy protection + watermark
// Deters casual copying only (select / copy / cut / right-click / drag).
// The text stays in the DOM, so search engines index it normally, and
// printing is allowed — the watermark prints on every page.
export function ProtectLayer() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const events = ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'];
    events.forEach((ev) => document.addEventListener(ev, stop));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a', 's'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    // Open every FAQ answer so the printout is complete.
    const openAll = () => document.querySelectorAll('.g4n-faq details').forEach((d) => d.setAttribute('open', ''));
    window.addEventListener('beforeprint', openAll);
    return () => {
      window.removeEventListener('beforeprint', openAll);
      events.forEach((ev) => document.removeEventListener(ev, stop));
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const marks: { x: number; y: number }[] = [];
  for (let y = -4; y < 108; y += 17) for (let x = -12; x < 108; x += 38) marks.push({ x: x + (Math.round((y + 4) / 17) % 2 ? 19 : 0), y });
  return (
    <div className="g4n-wm" aria-hidden="true">
      {marks.map((m, i) => (
        <span key={i} style={{ left: m.x + '%', top: m.y + '%' }}>ponna.in</span>
      ))}
    </div>
  );
}
