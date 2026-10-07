// Scoped styles for the Group 4 notification guide. Everything is prefixed
// .g4n so nothing leaks to other pages. Uses the site's brand variables
// (gold = Ponna, teal header band, warm paper) from ThemeStyles.

const CSS = `
.g4n{background:var(--color-paper);color:var(--color-ink);font-family:'Noto Sans Tamil','Noto Sans',system-ui,sans-serif;line-height:1.8;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overflow-x:clip}
.g4n img{-webkit-user-drag:none;user-drag:none}
.g4n *{box-sizing:border-box}

/* top bar */
.g4n-top{position:sticky;top:0;z-index:60;background:linear-gradient(180deg,var(--color-head1),var(--color-head2));border-bottom:3px solid #E2B04A}
.g4n-top-in{max-width:1240px;margin:0 auto;padding:9px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.g4n-logo{display:flex;background:#fefefe;border-radius:10px;padding:4px 10px}
.g4n-logo img{height:30px;width:auto}
.g4n-top-r{display:flex;align-items:center;gap:8px}
.g4n-btn-gold{background:#E2B04A;color:#2b1c00;border:0;border-radius:999px;padding:9px 18px;font:800 14px/1 inherit;font-family:inherit;cursor:pointer;text-decoration:none;display:inline-block}
.g4n-btn-ghost{color:#fff;border:1.5px solid rgba(255,255,255,.55);border-radius:999px;padding:8px 14px;font:700 13px/1 inherit;font-family:inherit;text-decoration:none}
.g4n-progress{position:absolute;left:0;right:0;bottom:-3px;height:3px;background:transparent}
.g4n-progress-bar{height:3px;width:0;background:#fff;transition:width .08s linear}
.g4n-share{position:relative}
.g4n-share-menu{position:absolute;right:0;top:calc(100% + 8px);background:#fff;border:1px solid var(--color-line);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.2);padding:6px;min-width:210px;display:flex;flex-direction:column;z-index:70}
.g4n-share-menu a,.g4n-share-menu button{display:block;text-align:left;padding:10px 12px;border-radius:8px;color:var(--color-ink);font:600 14px/1.3 inherit;font-family:inherit;text-decoration:none;background:none;border:0;cursor:pointer}
.g4n-share-menu a:hover,.g4n-share-menu button:hover{background:var(--color-paperAlt)}

/* breadcrumb */
.g4n-bc{max-width:1240px;margin:0 auto;padding:14px 16px 0;font-size:12.5px;color:var(--color-inkMuted)}
.g4n-bc a{color:inherit;text-decoration:underline}

/* hero */
.g4n-hero-wrap{max-width:1240px;margin:0 auto;padding:12px 16px 0}
.g4n-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,var(--color-head1) 0%,#124a55 55%,var(--color-head2) 100%);color:#fff;border-radius:22px;padding:44px 38px 34px;box-shadow:0 14px 40px rgba(12,47,63,.25)}
.g4n-hero:after{content:'';position:absolute;right:-90px;top:-90px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(226,176,74,.28),transparent 68%)}
.g4n-eyebrow{font-weight:800;letter-spacing:.4px;color:#F3D488;font-size:15px}
.g4n-hero h1{font-family:'Bitter','Noto Sans Tamil',serif;font-size:42px;line-height:1.22;margin:8px 0 14px;font-weight:800}
.g4n-hero p{font-size:17.5px;max-width:880px;margin:8px 0;color:#eaf3f4;position:relative;z-index:1}
.g4n-tags{margin-top:12px;position:relative;z-index:1}
.g4n-tag{display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:5px 13px;margin:5px 6px 0 0;font-size:13.5px}
.g4n-count{display:inline-block;margin-top:16px;background:#E2B04A;color:#2b1c00;font-weight:800;border-radius:999px;padding:9px 18px;font-size:15px;position:relative;z-index:1}

/* stat cards */
.g4n-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;max-width:1240px;margin:16px auto 0;padding:0 16px}
.g4n-stat{background:var(--color-card);border:1px solid var(--color-line);border-top:4px solid #E2B04A;border-radius:14px;padding:14px 12px;text-align:center;text-decoration:none;color:inherit;display:block;transition:transform .15s,box-shadow .15s}
.g4n-stat:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(26,34,56,.1)}
.g4n-stat b{display:block;font-family:'Bitter','Noto Sans',serif;font-size:24px;line-height:1.2;color:var(--color-head1)}
.g4n-stat span{display:block;font-size:12.5px;color:var(--color-inkMuted);line-height:1.45;margin-top:3px}

/* note */
.g4n-note{max-width:1240px;margin:16px auto 0;padding:0 16px}
.g4n-note div{background:var(--color-paperAlt);border-left:5px solid #E2B04A;border-radius:10px;padding:13px 16px;font-size:14.5px}

/* layout */
.g4n-layout{max-width:1240px;margin:22px auto 0;padding:0 16px;display:grid;grid-template-columns:290px minmax(0,1fr);gap:26px;align-items:start}
.g4n-aside{position:sticky;top:76px;max-height:calc(100vh - 92px);overflow:auto;background:var(--color-card);border:1px solid var(--color-line);border-radius:16px;padding:14px 8px 10px}
.g4n-aside-h{font-family:'Bitter','Noto Sans Tamil',serif;font-weight:800;font-size:17px;margin:2px 10px 8px;color:var(--color-head1)}
.g4n-toc-gt{font-size:11.5px;font-weight:800;letter-spacing:.5px;color:var(--color-teal);margin:12px 10px 3px;text-transform:uppercase}
.g4n-toc-list ul{list-style:none;margin:0;padding:0}
.g4n-toc-list a{display:block;padding:6px 10px;border-radius:8px;font-size:13.5px;line-height:1.45;color:var(--color-ink);text-decoration:none;border-left:3px solid transparent}
.g4n-toc-list a:hover{background:var(--color-paperAlt)}
.g4n-toc-list a.on{background:var(--color-goldLight);border-left-color:#E2B04A;font-weight:700}
.g4n-fab{display:none}

/* quick answers */
.g4n-main{min-width:0}
.g4n-faq{background:var(--color-card);border:1px solid var(--color-line);border-radius:18px;padding:24px 26px;margin-bottom:22px}
.g4n-faq h2,.g4n-sec h2{font-family:'Bitter','Noto Sans Tamil',serif;color:var(--color-head1);margin:0 0 14px;font-size:26px;line-height:1.35;padding:2px 0 10px 14px;border-left:5px solid #E2B04A;border-bottom:1px solid var(--color-line)}
.g4n-faq details{border-top:1px solid var(--color-line);padding:2px 0}
.g4n-faq summary{cursor:pointer;font-weight:700;padding:11px 0;list-style:none;display:flex;justify-content:space-between;gap:12px;font-size:16px}
.g4n-faq summary::-webkit-details-marker{display:none}
.g4n-faq summary:after{content:'+';color:var(--color-gold);font-weight:800;font-size:22px;line-height:1}
.g4n-faq details[open] summary:after{content:'–'}
.g4n-faq details p{margin:0 0 12px;color:var(--color-inkMuted);font-size:15.5px}

/* sections */
.g4n-sec{background:var(--color-card);border:1px solid var(--color-line);border-radius:18px;padding:26px;margin-bottom:20px;scroll-margin-top:76px;box-shadow:0 4px 18px rgba(26,34,56,.04)}
.g4n-sec h3{color:var(--color-teal);margin:22px 0 8px;font-size:19px}
.g4n-sec h4{margin:16px 0 6px}
.g4n-sec p,.g4n-sec li{font-size:16px}
.g4n-sec ul,.g4n-sec ol{padding-left:24px}
.g4n-sec li{margin:5px 0}
.g4n-sec .scroll{overflow-x:auto;margin:14px 0;border:1px solid var(--color-line);border-radius:12px}
.g4n-sec table{width:100%;border-collapse:collapse;font-size:14px;min-width:560px}
.g4n-sec th,.g4n-sec td{border-bottom:1px solid var(--color-line);border-right:1px solid var(--color-line);padding:9px 10px;vertical-align:top;text-align:left}
.g4n-sec th{background:var(--color-paperAlt);color:var(--color-head1);position:sticky;top:0}
.g4n-sec tr:last-child td{border-bottom:0} .g4n-sec td:last-child,.g4n-sec th:last-child{border-right:0}
.g4n-sec tbody tr:nth-child(even) td{background:rgba(244,240,230,.4)}
.g4n-sec .note{background:var(--color-paperAlt);border-left:5px solid #E2B04A;padding:12px 16px;border-radius:10px;margin:14px 0}
.g4n-sec .warn{background:var(--color-badBg);border-left-color:var(--color-bad)}
.g4n-sec .ok{background:var(--color-okBg);border-left-color:var(--color-ok)}
.g4n-sec .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.g4n-sec .card{border:1px solid var(--color-line);border-top:3px solid #E2B04A;border-radius:12px;padding:14px;background:var(--color-field)}
.g4n-sec .check{list-style:none;padding-left:0}
.g4n-sec .check li{padding:7px 10px 7px 34px;border:1px solid var(--color-line);border-radius:10px;margin:7px 0;position:relative;background:var(--color-field)}
.g4n-sec .check li:before{content:'';position:absolute;left:11px;top:13px;width:14px;height:14px;border:2px solid var(--color-gold);border-radius:4px}
.g4n-sec .small{font-size:13px;color:var(--color-inkMuted)}
.g4n-sec pre{white-space:pre-wrap;background:var(--color-paperAlt);border:1px solid var(--color-line);padding:14px;border-radius:12px;font:12px/1.5 ui-monospace,Consolas,monospace;overflow:auto}
.g4n-sec .docimg{margin:18px 0;text-align:center}
.g4n-sec .docimg img{max-width:100%;height:auto;border:1px solid var(--color-line);border-radius:10px;box-shadow:0 6px 20px rgba(26,34,56,.1);pointer-events:none}
.g4n-sec figcaption{font-size:12.5px;color:var(--color-inkMuted);margin-top:6px}
.g4n-sec a{color:var(--color-gold);text-decoration:underline}

/* cta + footer */
.g4n-cta{background:linear-gradient(135deg,var(--color-head1),var(--color-head2));color:#fff;border-radius:20px;padding:30px;margin:6px 0 22px;text-align:center;border:2px solid #E2B04A}
.g4n-cta h2{font-family:'Bitter','Noto Sans Tamil',serif;margin:0 0 8px;font-size:25px;color:#fff;border:0;padding:0}
.g4n-cta p{margin:0 auto 16px;max-width:620px;color:#e6f1f2;font-size:16px}
.g4n-cta-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.g4n-foot{max-width:1240px;margin:0 auto;padding:10px 16px 90px;text-align:center;color:var(--color-inkMuted);font-size:13px}

/* watermark */
.g4n-wm{position:fixed;inset:0;z-index:40;pointer-events:none;overflow:hidden}
.g4n-wm span{position:absolute;white-space:nowrap;font:800 52px/1 Arial,sans-serif;color:rgba(12,47,63,.07);transform:rotate(-28deg);letter-spacing:2px}

/* mobile sheet */
.g4n-sheet-bg{position:fixed;inset:0;background:rgba(15,47,51,.55);z-index:90;display:flex;align-items:flex-end}
.g4n-sheet{background:var(--color-paper);width:100%;max-height:78vh;overflow:auto;border-radius:20px 20px 0 0;padding:6px 10px 24px}
.g4n-sheet-top{position:sticky;top:0;background:var(--color-paper);display:flex;justify-content:space-between;align-items:center;padding:12px 8px;font-size:17px;border-bottom:1px solid var(--color-line)}
.g4n-sheet-top button{background:var(--color-paperAlt);border:0;border-radius:50%;width:34px;height:34px;font-size:15px;cursor:pointer}

@media(max-width:1020px){
  .g4n-layout{grid-template-columns:minmax(0,1fr)}
  .g4n-aside{display:none}
  .g4n-fab{display:inline-flex;position:fixed;right:14px;bottom:18px;z-index:80;background:var(--color-head1);color:#fff;border:2px solid #E2B04A;border-radius:999px;padding:12px 18px;font:800 14.5px/1 inherit;font-family:inherit;box-shadow:0 8px 22px rgba(0,0,0,.3);cursor:pointer}
  .g4n-stats{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:640px){
  .g4n-hero{padding:28px 20px 24px;border-radius:18px}
  .g4n-hero h1{font-size:30px}
  .g4n-hero p{font-size:16px}
  .g4n-stats{grid-template-columns:repeat(2,1fr);gap:10px}
  .g4n-stat b{font-size:20px}
  .g4n-sec,.g4n-faq{padding:18px 15px;border-radius:14px}
  .g4n-sec h2,.g4n-faq h2{font-size:21px}
  .g4n-sec p,.g4n-sec li{font-size:15.5px}
  .g4n-btn-ghost{display:none}
  .g4n-wm span{font-size:38px}
}
@media(prefers-reduced-motion:reduce){.g4n-stat{transition:none}}

/* print — the watermark prints on every page; interactive chrome is hidden */
@media print{
  .g4n-noprint,.g4n-top,.g4n-aside,.g4n-fab,.g4n-cta{display:none!important}
  .g4n{background:#fff}
  .g4n-layout{display:block}
  .g4n-sec,.g4n-faq,.g4n-hero{box-shadow:none;break-inside:auto}
  .g4n-hero{background:#fff!important;color:#000;border:1px solid #999}
  .g4n-hero *{color:#000!important}
  .g4n-sec .docimg{break-inside:avoid}
  .g4n-sec .scroll{overflow:visible}
  .g4n-sec table{min-width:0}
  .g4n-wm{position:fixed}
  .g4n-wm span{color:rgba(12,47,63,.17)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:46px}
}
`;

export function GuideStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
