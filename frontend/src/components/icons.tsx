// Minimal line icons for the student nav — replaces emoji (which render
// inconsistently across phones/browsers and read as unpolished for an
// exam-prep brand) with a consistent custom set in the brand's ink/gold
// palette. One shared stroke style, one shared size, so the whole set
// reads as a single deliberate system rather than mixed glyph styles.

type IconProps = { size?: number; color?: string };

function Base({ size = 20, color = '#1A2238', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3.5 11.5L12 4l8.5 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-6h4v6" />
    </Base>
  );
}

export function PracticeIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14.5 3.5V8h4.5" />
      <path d="M8.5 12.5l2 2 4-4.2" />
    </Base>
  );
}

export function PlansIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="6" width="18" height="13" rx="1.6" />
      <path d="M3 10h18" />
      <path d="M6.5 14.5h4" />
    </Base>
  );
}

export function ProgressIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="4" y="13" width="3.4" height="7" />
      <rect x="10.3" y="9" width="3.4" height="11" />
      <rect x="16.6" y="4.5" width="3.4" height="15.5" />
    </Base>
  );
}

export function ProfileIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.3-3.8 4.4-6 7.5-6s6.2 2.2 7.5 6" />
    </Base>
  );
}

export function DevicesIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="5" width="12" height="9" rx="1" />
      <path d="M3 12h12" />
      <rect x="17" y="9" width="4" height="9" rx="0.8" />
    </Base>
  );
}

export function AboutIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.7v.1" />
    </Base>
  );
}

export function HelpIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.3 9.5a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 2" />
      <path d="M12 16.7v.1" />
    </Base>
  );
}

export function LogoutIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M9.5 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3.5" />
      <path d="M14.5 15.5L19 12l-4.5-3.5" />
      <path d="M19 12H9.5" />
    </Base>
  );
}

export function MistakesIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M9 4l10 10-3.5 3.5L5 7.5z" />
      <path d="M6.5 15.5L4 20l4.5-2.5" />
      <path d="M13.5 6L18 10.5" />
    </Base>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Base>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Base>
  );
}
