import { useEffect, useState } from 'react';
import { authFetch } from '../api';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

const TYPE_AR = {
  call_waiter: 'استدعاء نادل',
  request_bill: 'طلب الحساب',
};

export default function ServiceRequests({ api }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    authFetch(`${api}/service-requests`)
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const markDone = (id) => {
    authFetch(`${api}/service-requests/${id}/done`, { method: 'PATCH' })
      .then(() => {
        setRows((prev) => prev.filter((r) => r.id !== id));
      })
      .catch((err) => setError(err.message));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="card">
      <h1>طلبات الخدمة</h1>
      <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.95rem' }}>
        طلبات «نداء النادل» و«الحساب» من صفحة الطلب العامة — تظهر هنا الطلبات{' '}
        <strong>المعلّقة</strong> فقط.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>لا توجد طلبات معلّقة حالياً.</p>
      ) : (
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem 0.25rem' }}>الطاولة</th>
                <th style={{ padding: '0.5rem 0.25rem' }}>النوع</th>
                <th style={{ padding: '0.5rem 0.25rem' }}>الوقت</th>
                <th style={{ padding: '0.5rem 0.25rem' }}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.6rem 0.25rem', fontWeight: 600 }}>{r.table_number}</td>
                  <td style={{ padding: '0.6rem 0.25rem' }}>
                    {TYPE_AR[r.request_type] || r.request_type}
                  </td>
                  <td style={{ padding: '0.6rem 0.25rem', color: '#6b7280', fontSize: '0.88rem' }}>
                    {r.created_at || '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => markDone(r.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 8,
                        border: 'none',
                        background: '#059669',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      تم
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
