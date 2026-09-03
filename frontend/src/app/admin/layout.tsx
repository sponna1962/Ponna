'use client';

// Shared admin shell — simple top nav across all /admin/* pages except login.
// Kept deliberately plain per the requirements doc's emphasis: the admin panel
// must be usable by non-technical staff, not a showcase of UI polish.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRequireStaffAuth } from '../../lib/use-require-staff-auth';

const navItems = [
  { href: '/admin/questions', label: 'Questions' },
  { href: '/admin/questions/upload', label: 'Bulk Upload' },
  { href: '/admin/questions/review', label: 'Needs Review' },
  { href: '/admin/question-reports', label: 'Question Reports' },
  { href: '/admin/current-affairs', label: 'Current Affairs' },
  { href: '/admin/exam-taxonomy', label: 'Exam Taxonomy' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  // Hooks must run unconditionally — `skip` tells it to no-op on the login page
  // itself, avoiding a redirect-to-self reload loop (see hook's comment).
  const checked = useRequireStaffAuth(isLoginPage);

  function logout() {
    localStorage.removeItem('ponna_staff_token');
    localStorage.removeItem('ponna_staff_role');
    window.location.href = '/admin/login';
  }

  if (isLoginPage) return <div style={{ fontFamily: 'sans-serif' }}>{children}</div>;
  if (!checked) return null; // brief blank frame while the redirect (if any) kicks in

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f8fafc' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: '#0f172a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <strong style={{ color: '#fff', fontSize: 16 }}>PONNA Admin</strong>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ color: '#cbd5e1', fontSize: 14, textDecoration: 'none' }}>
              {item.label}
            </Link>
          ))}
        </div>
        <button
          onClick={logout}
          style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13 }}
        >
          Log out
        </button>
      </nav>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}
