'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRequireStaffAuth } from '../../lib/use-require-staff-auth';

const navItems = [
  { href: '/admin/questions', label: 'Questions' },
  { href: '/admin/questions/upload', label: 'Bulk Upload' },
  { href: '/admin/questions/review', label: 'Needs Review' },
  { href: '/admin/question-reports', label: 'Question Reports' },
  { href: '/admin/question-audit', label: 'AI Question Audit' },
  { href: '/admin/bulk-explanation', label: 'Bulk Explanation Generator' },
  { href: '/admin/subject-classification', label: 'Subject Classification' },
  { href: '/admin/study-notes', label: 'Study Notes' },
  { href: '/admin/html-entity-cleanup', label: 'HTML Entity Cleanup' },
  { href: '/admin/daily-quiz', label: 'Daily Quiz' },
  { href: '/admin/current-affairs-learning', label: 'Current Affairs — Learning' },
  { href: '/admin/live-exam', label: 'Live Exam' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/settings', label: 'Settings' },
];

const tnpscNavItems = [
  { href: '/admin/exam-taxonomy', label: 'Exam Taxonomy' },
  { href: '/admin/syllabus', label: 'Subject & Topic' },
  { href: '/admin/syllabus-import', label: 'Syllabus PDF Import' },
  { href: '/admin/exam-data-import', label: 'Exam Data Import' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';
  const [tnpscMenuOpen, setTnpscMenuOpen] = useState(false);
  const checked = useRequireStaffAuth(isLoginPage);

  function logout() {
    localStorage.removeItem('ponna_staff_token');
    localStorage.removeItem('ponna_staff_role');
    window.location.href = '/admin/login';
  }

  if (isLoginPage) return <div style={{ fontFamily: 'sans-serif' }}>{children}</div>;
  if (!checked) return null;
  const tnpscActive = tnpscNavItems.some((item) => pathname?.startsWith(item.href));

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f8fafc' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <strong style={{ color: '#fff', fontSize: 16 }}>PONNA Admin</strong>
          {navItems.map((item) => <Link key={item.href} href={item.href} style={{ color: '#cbd5e1', fontSize: 14, textDecoration: 'none' }}>{item.label}</Link>)}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setTnpscMenuOpen((v) => !v)} style={{ background: 'transparent', border: 'none', color: tnpscActive ? '#fff' : '#cbd5e1', fontSize: 14, fontWeight: tnpscActive ? 700 : 400, cursor: 'pointer', padding: 0 }}>TNPSC ▾</button>
            {tnpscMenuOpen && (
              <>
                <div onClick={() => setTnpscMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', minWidth: 200, zIndex: 20, overflow: 'hidden' }}>
                  {tnpscNavItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setTnpscMenuOpen(false)} style={{ display: 'block', padding: '10px 14px', color: '#0f172a', fontSize: 13, textDecoration: 'none', borderBottom: '1px solid #f1f5f9' }}>{item.label}</Link>)}
                </div>
              </>
            )}
          </div>
        </div>
        <button onClick={logout} style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>Log out</button>
      </nav>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}
