import { useState, useEffect } from 'react';
import { authFetch } from '../api';
import { PERIODS } from '../constants/periods';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

export default function Stats({ api }) {
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    authFetch(`${api}/stats?period=${encodeURIComponent(period)}`)
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api, period]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!stats) return null;

  const totalRevenue = Number(stats.revenue || 0).toFixed(2);
  const ordersInPeriod = stats.ordersCount ?? stats.ordersToday ?? 0;
  const ordersToday = stats.ordersToday ?? 0;
  const topProducts = stats.topProducts || [];
  const series = stats.series || [];
  const maxSeries = Math.max(1, ...series.map((x) => Number(x.revenue) || 0));

  const periodLabel = PERIODS.find((p) => p.key === period)?.label || period;

  return (
    <div className="card">
      <div className="stats-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.15rem, 4vw, 1.5rem)' }}>الإحصائيات</h1>
        <div className="segmented">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={period === key ? 'active' : ''}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
        الفترة: <strong>{periodLabel}</strong> — طلبات مؤكدة فقط
      </p>
      <div className="stats-kpi-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 180, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>طلبات الفترة</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{ordersInPeriod}</div>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 180, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>طلبات اليوم</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{ordersToday}</div>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 180, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>الإيرادات (تقريبي)</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalRevenue}</div>
        </div>
      </div>

      <h2 style={{ marginTop: '1.5rem' }}>توزيع الإيرادات</h2>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem', minHeight: 120, flexWrap: 'wrap' }}>
        {series.length === 0 ? (
          <p style={{ color: '#6b7280' }}>لا توجد بيانات في هذه الفترة.</p>
        ) : (
          series.map((seg, idx) => {
            const rev = Number(seg.revenue) || 0;
            const h = 20 + (rev / maxSeries) * 80;
            return (
              <div key={idx} style={{ textAlign: 'center', minWidth: 36 }}>
                <div
                  style={{
                    width: 24,
                    margin: '0 auto',
                    height: h,
                    background: '#111827',
                    borderRadius: 4,
                  }}
                />
                <div style={{ fontSize: '0.65rem', color: '#666', marginTop: 4 }}>{seg.label}</div>
              </div>
            );
          })
        )}
      </div>

      <h2 style={{ marginTop: '1.5rem' }}>أكثر المنتجات طلباً</h2>
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={i}>
                <td>{p.name}</td>
                <td>{p.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
