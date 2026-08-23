'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminFetch } from '../../../../lib/admin-fetch';

// Student Detail — the individual-student view backing §7.5, reachable from
// the student list. Shows subscription history, per-bucket performance, and
// recent quiz sessions — everything an admin needs to answer a support
// question like "why does this student say their quota looks wrong?".

type StudentDetail = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  preferredLang: string;
  createdAt: string;
  subscriptions: {
    id: string;
    plan: { name: string; code: string };
    status: string;
    cycleStart: string;
    cycleEnd: string;
    questionsUsedInCycle: number;
    questionsUsedToday: number;
  }[];
  performanceSummary: {
    bucket: string;
    questionsAnswered: number;
    correctAnswers: number;
    averagePercent: number;
    rank: number | null;
  }[];
  quizSessions: {
    id: string;
    mode: string;
    status: string;
    totalQuestions: number;
    startedAt: string;
    completedAt: string | null;
  }[];
};

export default function StudentDetailPage() {
  const params = useParams();
  const [student, setStudent] = useState<StudentDetail | null>(null);

  useEffect(() => {
    adminFetch(`/admin/students/${params.id}`).then((r) => r.json()).then(setStudent);
  }, [params.id]);

  if (!student) return <p style={{ color: '#94a3b8' }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <a href="/admin/students" style={{ fontSize: 13, color: '#64748b' }}>&larr; Back to Students</a>
      <h1 style={{ fontSize: 20, margin: '8px 0 20px 0' }}>
        {student.name ?? student.phone ?? student.email ?? student.id.slice(0, 8)}
      </h1>

      <Section title="Performance">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {student.performanceSummary.map((p) => (
            <div key={p.bucket} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, minWidth: 140 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{p.bucket}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{p.averagePercent.toFixed(1)}%</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{p.correctAnswers}/{p.questionsAnswered} correct</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Rank: {p.rank ?? 'Not yet eligible'}</div>
            </div>
          ))}
          {student.performanceSummary.length === 0 && <span style={{ color: '#94a3b8', fontSize: 13 }}>No answers yet.</span>}
        </div>
      </Section>

      <Section title="Subscriptions">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: 6 }}>Plan</th>
              <th style={{ padding: 6 }}>Status</th>
              <th style={{ padding: 6 }}>Cycle</th>
              <th style={{ padding: 6 }}>Used (cycle / today)</th>
            </tr>
          </thead>
          <tbody>
            {student.subscriptions.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 6 }}>{s.plan.name}</td>
                <td style={{ padding: 6 }}>{s.status}</td>
                <td style={{ padding: 6 }}>
                  {new Date(s.cycleStart).toLocaleDateString()} – {new Date(s.cycleEnd).toLocaleDateString()}
                </td>
                <td style={{ padding: 6 }}>{s.questionsUsedInCycle} / {s.questionsUsedToday}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Recent Sessions">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: 6 }}>Mode</th>
              <th style={{ padding: 6 }}>Status</th>
              <th style={{ padding: 6 }}>Questions</th>
              <th style={{ padding: 6 }}>Started</th>
            </tr>
          </thead>
          <tbody>
            {student.quizSessions.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 6 }}>{s.mode}</td>
                <td style={{ padding: 6 }}>{s.status}</td>
                <td style={{ padding: 6 }}>{s.totalQuestions}</td>
                <td style={{ padding: 6, color: '#94a3b8' }}>{new Date(s.startedAt).toLocaleString()}</td>
              </tr>
            ))}
            {student.quizSessions.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>No sessions yet.</td></tr>
            )}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}
