'use client';

import { useState } from 'react';
import { apiUrl } from '../../../lib/api-config';

// Admin login — separate from student login (staff accounts, §3/§7.8).
// On success, stores the JWT in localStorage for subsequent admin API calls.

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setError(null);
    const res = await fetch(apiUrl('/admin/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError('தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்');
      return;
    }
    const { token, role } = await res.json();
    localStorage.setItem('ponna_staff_token', token);
    localStorage.setItem('ponna_staff_role', role);
    window.location.href = '/admin/questions';
  }

  return (
    <main style={{ padding: 24, maxWidth: 380, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>PONNA Admin</h1>

      <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#475569' }}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@ponna.in"
        style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 14 }}
      />

      <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#475569' }}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 18 }}
      />

      <button
        onClick={login}
        style={{ width: '100%', padding: 12, borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}
      >
        Log In
      </button>

      {error && <p style={{ color: '#dc2626', marginTop: 12, fontSize: 13 }}>{error}</p>}
    </main>
  );
}
