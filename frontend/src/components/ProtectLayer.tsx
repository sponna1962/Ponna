'use client';

import { useEffect } from 'react';

// Read-only protection for reading pages (Current Affairs, Study Notes),
// the same approach as the TNPSC Group 4 notification guide:
//  - a faint "ponna.in" watermark across the whole screen that also prints on
//    every page, so a printout or screenshot still shows where it came from;
//  - select / copy / cut / right-click / drag are blocked, and Ctrl/Cmd +
//    C / X / A / S are ignored.
// This only deters casual copying. The text stays in the DOM (search engines
// still read it) and printing is allowed. Elements with the class
// `ponna-noprint` (menus, buttons) are hidden when printing.
const CSS = `
.ponna-protect, .ponna-protect *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.ponna-wm{position:fixed;inset:0;z-index:40;pointer-events:none;overflow:hidden}
.ponna-wm span{position:absolute;white-space:nowrap;font:800 46px/1 Arial,sans-serif;color:rgba(12,47,63,.07);transform:rotate(-28deg);letter-spacing:2px}
@media(max-width:640px){.ponna-wm span{font-size:34px}}
@media print{
  .ponna-noprint{display:none!important}
  .ponna-wm{position:fixed}
  .ponna-wm span{color:rgba(12,47,63,.17)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:42px}
}
`;

export function ProtectLayer() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const events = ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'];
    events.forEach((ev) => document.addEventListener(ev, stop));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a', 's'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, stop));
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const marks: { x: number; y: number }[] = [];
  for (let y = -4; y < 108; y += 17) for (let x = -12; x < 108; x += 38) marks.push({ x: x + (Math.round((y + 4) / 17) % 2 ? 19 : 0), y });
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ponna-wm" aria-hidden="true">
        {marks.map((m, i) => (
          <span key={i} style={{ left: m.x + '%', top: m.y + '%' }}>ponna.in</span>
        ))}
      </div>
    </>
  );
}
