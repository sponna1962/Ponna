'use client';

import Image from 'next/image';
import {
  PlansIcon, CloseIcon,
} from './icons';

const primary = [
  ['/', 'Home'],
  ['/current-affairs', 'Current Affairs'],
  ['/tnpsc-group-4/notification-2026', 'Group 4 அறிவிப்பு 2026'],
] as const;

const preparation = [
  ['/quiz', 'Start Practice'],
  ['/ask-ponna', 'Ask Ponna'],
  ['/mistakes', 'Review Mistakes'],
  ['/study-notes', 'Study Notes'],
  ['/daily-quiz', 'Daily Challenge'],
  ['/live-exam', 'Live Exam'],
  ['/adaptive-mock', 'Adaptive Mock'],
  ['/dashboard', 'Performance'],
  ['/cutoff-predictor', 'Cut-off Predictor'],
] as const;

const support = [
  ['/about', 'About PONNA'],
  ['/help', 'Help & Support'],
] as const;

const colors = {
  navy: '#0B3864',
  ink: '#20384D',
  muted: '#667786',
  line: '#DDE5E9',
  green: '#17835E',
  gold: '#E2B04A',
  goldLight: '#FFF7DC',
  paper: '#FFFEFB',
};

function Row({ item, active = false, isNew = false }: { item: readonly [string, string]; active?: boolean; isNew?: boolean }) {
  const [href, label] = item;
  return (
    <a href={href} style={{
      display:'flex', alignItems:'center', gap:12, minHeight:48, padding:'5px 10px',
      borderLeft: active ? `3px solid ${colors.gold}` : '3px solid transparent',
      background: active ? '#F5F8F9' : 'transparent',
      color:colors.ink, textDecoration:'none', fontSize:17,
      fontWeight: active ? 800 : 500, boxSizing:'border-box',
    }}>
      <span style={{flex:1,minWidth:0}}>{label}</span>
      {isNew && <span style={{fontSize:10,fontWeight:900,letterSpacing:'.6px',color:'#0B3864',background:'#FFF1B8',border:'1px solid #E8C95D',padding:'3px 7px',borderRadius:5}}>NEW</span>}
      {active && <span style={{fontSize:10,color:colors.green,fontWeight:800,letterSpacing:'.5px'}}>CURRENT</span>}
    </a>
  );
}

function SectionTitle({children}:{children:React.ReactNode}) {
  return <div style={{
    display:'flex',alignItems:'center',gap:10,margin:'15px 10px 5px',
    color:'#52706D',fontSize:11,fontWeight:900,letterSpacing:1.8,
  }}>
    <span>{children}</span><span style={{flex:1,height:1,background:'#D7DFE2'}} />
  </div>;
}

export default function MenuDesignPreview() {
  return (
    <main style={{
      minHeight:'100dvh',background:'#EAF0F2',
      fontFamily:"'Noto Sans Tamil','Nirmala UI',Latha,Arial,sans-serif",color:colors.ink,
    }}>
      <div style={{
        width:'100%',maxWidth:360,height:'100dvh',minHeight:640,background:colors.paper,
        boxShadow:'12px 0 32px rgba(32,56,77,.13)',borderRight:'1px solid '+colors.line,
        display:'flex',flexDirection:'column',overflow:'hidden',
      }}>
        <header style={{
          flex:'0 0 72px',height:72,display:'flex',alignItems:'center',
          justifyContent:'space-between',padding:'0 16px',borderBottom:'3px solid '+colors.gold,
          background:'#fff',boxSizing:'border-box',
        }}>
          <div style={{
            background:'#fff',border:'1px solid '+colors.line,padding:'4px 10px',
            borderRadius:7,display:'flex',
          }}>
            <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258}
              priority style={{width:178,height:'auto'}} />
          </div>
          <button aria-label="Close" style={{
            width:36,height:36,border:'1px solid '+colors.line,borderRadius:'50%',
            background:'#fff',display:'grid',placeItems:'center',padding:0,
          }}>
            <CloseIcon size={18} color={colors.ink} />
          </button>
        </header>

        <div style={{flex:1,overflowY:'auto',padding:'10px 12px 12px',boxSizing:'border-box'}}>
          <nav aria-label="PONNA menu">
            <div style={{paddingBottom:6,borderBottom:'1px solid #E1E7EA'}}>
              {primary.map((item,i)=><Row key={item[0]} item={item} active={i===0} isNew={item[0]==='/tnpsc-group-4/notification-2026'}/>)}
            </div>
            <SectionTitle>PREPARATION</SectionTitle>
            {preparation.map(item=><Row key={item[0]} item={item}/>)}
            <SectionTitle>SUPPORT</SectionTitle>
            {support.map(item=><Row key={item[0]} item={item}/>)}
            <div style={{
              margin:'12px 10px 2px',paddingTop:10,borderTop:'1px solid #E1E7EA',
              color:'#71808B',fontSize:11,lineHeight:1.8,
            }}>
              <div>
                {[
                  ['Terms','/terms'],['Privacy','/privacy'],['Refund','/refund-policy'],
                  ['Delivery','/shipping-policy'],['Contact','/contact']
                ].map(([label,href])=><a key={href} href={href} style={{
                  color:'inherit',textDecoration:'underline',marginRight:10
                }}>{label}</a>)}
              </div>
              <small style={{fontSize:10}}>ARLENA (OPC) PRIVATE LIMITED</small>
            </div>
          </nav>
        </div>

        <div style={{flex:'0 0 auto',padding:'10px 14px 14px',background:'#fff',borderTop:'1px solid '+colors.line}}>
          <a href="/plans" style={{
            display:'flex',alignItems:'center',gap:11,minHeight:62,padding:'8px 13px',
            background:'#F5C548',color:colors.ink,textDecoration:'none',
            border:'1px solid #DDAE35',borderRadius:10,boxShadow:'0 5px 12px rgba(176,122,16,.12)',
            boxSizing:'border-box',
          }}>
            <span style={{
              width:36,height:36,display:'grid',placeItems:'center',borderRadius:7,
              background:'rgba(255,255,255,.55)',flex:'0 0 36px',
            }}><PlansIcon size={19} color={colors.navy}/></span>
            <span>
              <strong style={{display:'block',fontSize:18,lineHeight:1.2}}>Pass</strong>
              <small style={{display:'block',fontSize:11,marginTop:2}}>பயிற்சியைத் தொடருங்கள்</small>
            </span>
            <b style={{marginLeft:'auto',fontSize:27,fontWeight:400}}>›</b>
          </a>
        </div>
      </div>
    </main>
  );
}
