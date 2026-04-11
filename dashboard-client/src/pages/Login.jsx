import { useState } from 'react';
import { setAuthToken } from '../lib/authToken';

export default function Login({ api }) {
  const [mode, setMode] = useState('restaurant');
  const [email, setEmail] = useState('owner@example.com');
  const [password, setPassword] = useState('test123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = mode === 'admin' ? `${api}/auth/admin-login` : `${api}/auth/login`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setAuthToken(data.token);
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: 360,
        padding: '2rem',
        borderRadius: 16,
        background: '#f9fafb',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
      }}
    >
      <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>تسجيل الدخول</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setMode('restaurant')}
          style={tabButton(mode === 'restaurant')}
        >
          مطعم
        </button>
        <button
          type="button"
          onClick={() => setMode('admin')}
          style={tabButton(mode === 'admin')}
        >
          Admin
        </button>
      </div>
      {error && <p style={{ color: 'red', marginBottom: '0.75rem' }}>خطأ: {error}</p>}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.85rem' }}>
          الإيميل
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          كلمة المرور
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '0.5rem',
            padding: '0.6rem',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            background: loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          {loading ? 'جاري الدخول...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  marginTop: '0.25rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: '0.9rem',
};

const tabButton = (active) => ({
  flex: 1,
  border: 'none',
  borderRadius: 8,
  padding: '0.5rem 0.75rem',
  cursor: 'pointer',
  background: active ? '#1f2937' : '#e5e7eb',
  color: active ? '#f9fafb' : '#111827',
});