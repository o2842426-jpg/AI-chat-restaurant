import { useState, useEffect } from 'react';
import { authFetch } from '../api';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

export default function Admin({ api }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telegramGroupId, setTelegramGroupId] = useState('');

  const load = () => {
    setLoading(true);
    authFetch(`${api}/admin/restaurants`)
      .then((data) => {
        setRestaurants(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const addRestaurant = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    authFetch(`${api}/admin/restaurants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        telegram_group_id: telegramGroupId ? Number(telegramGroupId) : null,
      }),
    })
      .then(() => {
        setName('');
        setEmail('');
        setPassword('');
        setTelegramGroupId('');
        load();
      })
      .catch((err) => setError(err.message));
  };

  const toggleRestaurant = (restaurant) => {
    authFetch(`${api}/admin/restaurants/${restaurant.id}/activation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: restaurant.is_active ? 0 : 1 }),
    })
      .then(() => load())
      .catch((err) => setError(err.message));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: 1 }}>
          <h1 style={{ marginBottom: '0.5rem' }}>إدارة المطاعم</h1>
          <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9rem' }}>
            أضِف مطاعم جديدة وتابع معلوماتها من هنا.
          </p>
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: '0.75rem',
              maxWidth: 760,
            }}
          >
            <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.85rem', lineHeight: 1.7 }}>
              <strong>Quick Go-Live:</strong> Create restaurant {"->"} link Telegram group {"->"} add minimum menu {"->"}
              run bot with BOT_TOKEN/RESTAURANT_ID/KITCHEN_GROUP_ID {"->"} execute first test order.
              Full operator playbook: <code>docs/restaurant-go-live-playbook.md</code>
            </p>
          </div>
        </div>
      </div>

      {/* فورم إضافة مطعم */}
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: '1.5rem',
          boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: 600,
        }}
      >
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>إضافة مطعم جديد</h2>
        <form onSubmit={addRestaurant} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={fieldRow}>
            <label style={labelStyle}>
              اسم المطعم
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: Burger House"
              />
            </label>
          </div>
          <div style={fieldRow}>
            <label style={labelStyle}>
              الإيميل
              <input
                type="email"
                style={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@restaurant.com"
              />
            </label>
          </div>
          <div style={fieldRow}>
            <label style={labelStyle}>
              كلمة المرور
              <input
                type="password"
                style={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة مرور لوحة التحكم"
              />
            </label>
          </div>
          <div style={fieldRow}>
            <label style={labelStyle}>
              Telegram Group ID
              <input
                style={inputStyle}
                value={telegramGroupId}
                onChange={(e) => setTelegramGroupId(e.target.value)}
                placeholder="-1001234567890"
              />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="submit"
              style={{
                padding: '0.6rem 1.4rem',
                borderRadius: 999,
                border: 'none',
                background: '#2563eb',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              إضافة
            </button>
          </div>
        </form>
      </div>

      {/* جدول المطاعم */}
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: '1.5rem',
          boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
        }}
      >
        <h2 style={{ marginBottom: '1rem', fontSize: '1rem' }}>قائمة المطاعم</h2>
        <div className="table-responsive table-responsive--wide">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'right' }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>الاسم</th>
              <th style={thStyle}>الإيميل</th>
              <th style={thStyle}>Telegram Group</th>
              <th style={thStyle}>تاريخ الإنشاء</th>
              <th style={thStyle}>الحالة</th>
              <th style={thStyle}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.id}</td>
                <td style={tdStyle}>{r.name}</td>
                <td style={tdStyle}>{r.email}</td>
                <td style={tdStyle}>{r.telegram_group_id ?? '—'}</td>
                <td style={tdStyle}>{r.created_at?.slice(0, 16) || '—'}</td>
                <td style={tdStyle}>
                  {Number(r.is_active) === 1 ? (
                    <span className="badge-success">مفعل</span>
                  ) : (
                    <span className="badge-danger">معطل</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={() => toggleRestaurant(r)}
                    style={{
                      border: 'none',
                      borderRadius: 8,
                      padding: '0.35rem 0.65rem',
                      cursor: 'pointer',
                      color: 'white',
                      background: Number(r.is_active) === 1 ? '#dc2626' : '#16a34a',
                    }}
                  >
                    {Number(r.is_active) === 1 ? 'تعطيل' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {restaurants.length === 0 && (
          <p style={{ marginTop: '0.75rem', color: '#6b7280' }}>لا توجد مطاعم بعد.</p>
        )}
      </div>
    </div>
  );
}

const fieldRow = { display: 'flex', gap: '1rem' };

const labelStyle = {
  flex: 1,
  fontSize: '0.85rem',
  color: '#374151',
  display: 'flex',
  flexDirection: 'column',
};

const inputStyle = {
  marginTop: '0.25rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: '0.9rem',
};

const thStyle = {
  padding: '0.6rem 0.75rem',
  fontSize: '0.85rem',
  color: '#4b5563',
  borderBottom: '1px solid #e5e7eb',
};

const tdStyle = {
  padding: '0.6rem 0.75rem',
  fontSize: '0.85rem',
  borderBottom: '1px solid #f3f4f6',
};



