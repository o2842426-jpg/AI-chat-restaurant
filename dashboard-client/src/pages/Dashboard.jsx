import { useState, useEffect, useMemo } from 'react';
import { authFetch } from '../api';
import { getRestaurantId } from '../lib/authToken';
import { snapshotLine } from '../lib/orderSnapshots';
import { PERIODS } from '../constants/periods';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

export default function Dashboard({ api }) {
  const [range, setRange] = useState('day');
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const s = await authFetch(`${api}/stats?period=${encodeURIComponent(range)}`);
        setStats(s);

        const ordersRaw = await authFetch(`${api}/orders?status=confirmed&limit=150`);
        const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
        const sorted = [...orders].sort((a, b) => b.id - a.id);
        setRecentOrders(sorted);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [api, range]);

  const q = searchQuery.trim().toLowerCase();

  const filteredTopProducts = useMemo(() => {
    const list = stats?.topProducts || [];
    if (!q) return list;
    return list.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [stats, q]);

  const filteredRecentOrders = useMemo(() => {
    if (!q) return recentOrders.slice(0, 8);
    return recentOrders.filter((o) => {
      const idStr = String(o.id);
      const uid = String(o.user_id ?? '');
      const note = String(o.public_order_note ?? '').toLowerCase();
      const name = String(o.customer_name_snapshot ?? '').toLowerCase();
      const phone = String(o.customer_phone_snapshot ?? '').toLowerCase();
      const addr = String(o.customer_address_snapshot ?? '').toLowerCase();
      return (
        idStr.includes(q) ||
        uid.includes(q) ||
        note.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        addr.includes(q)
      );
    }).slice(0, 20);
  }, [recentOrders, q]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!stats) return null;

  const myRestaurantId = getRestaurantId();

  const totalRevenue = Number(stats.revenue || 0).toFixed(2);
  const ordersInPeriod = stats.ordersCount ?? stats.ordersToday ?? 0;
  const ordersTodayOnly = stats.ordersToday ?? 0;
  const topProducts = stats.topProducts || [];
  const series = stats.series || [];
  const maxSeries = Math.max(1, ...series.map((x) => Number(x.revenue) || 0));

  const periodLabel =
    PERIODS.find((p) => p.key === range)?.label || range;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>لوحة التحكم</h1>
          <p style={{ margin: 0, marginTop: '0.25rem', color: '#6b7280', fontSize: '0.85rem' }}>
            نظرة عامة على أداء المطعم — الفترة: <strong>{periodLabel}</strong>
          </p>
        </div>
        <div className="top-search" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <input
            type="search"
            placeholder="بحث برقم الطلب أو معرف العميل أو ملاحظة الزبون…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              minWidth: 260,
              maxWidth: 420,
              padding: '0.45rem 0.65rem',
              borderRadius: 8,
              border: '1px solid #d1d5db',
            }}
          />
          <div className="segmented">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={range === key ? 'active' : ''}
                onClick={() => setRange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card-row">
        <div className="card">
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>إجمالي الإيرادات ({periodLabel})</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
            ${totalRevenue}
          </div>
          <div className="badge-success" style={{ marginTop: '0.3rem' }}>
            طلبات مؤكدة ضمن الفترة
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>عدد الطلبات ({periodLabel})</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
            {ordersInPeriod}
          </div>
          <div className="badge-success" style={{ marginTop: '0.3rem' }}>
            طلبات اليوم (أي تاريخ): {ordersTodayOnly}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>عدد المنتجات (أعلى المبيعات)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
            {topProducts.length}
          </div>
          <div className="badge-success" style={{ marginTop: '0.3rem' }}>
            ضمن الفترة المختارة
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>أفضل منتج</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.3rem' }}>
            {topProducts[0]?.name || '—'}
          </div>
          <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#6b7280' }}>
            إجمالي الكمية: {topProducts[0]?.total ?? 0}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>ملخص الإيرادات</span>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {`إجمالي الفترة: $${totalRevenue}`}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              height: 180,
              gap: '0.35rem',
              overflowX: 'auto',
            }}
          >
            {series.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>لا توجد بيانات إيرادات في هذه الفترة.</p>
            ) : (
              series.map((seg, idx) => {
                const rev = Number(seg.revenue) || 0;
                const height = 24 + (rev / maxSeries) * 140;
                return (
                  <div key={idx} style={{ flex: '1 0 32px', minWidth: 28, textAlign: 'center' }}>
                    <div
                      style={{
                        margin: '0 auto',
                        width: '100%',
                        maxWidth: 24,
                        borderRadius: 999,
                        background: idx === series.length - 1 ? '#111827' : '#d1d5db',
                        height,
                      }}
                    />
                    <div style={{ marginTop: '0.35rem', fontSize: '0.65rem', color: '#6b7280', wordBreak: 'break-all' }}>
                      {seg.label}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>أكثر المنتجات طلباً</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
              {q ? `مفلتر حسب البحث (عرض ${filteredTopProducts.length})` : 'ضمن الفترة المختارة'}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
              </tr>
            </thead>
            <tbody>
              {filteredTopProducts.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTopProducts.length === 0 && (
            <p style={{ marginTop: '0.75rem', color: '#6b7280' }}>لا توجد نتائج.</p>
          )}
        </div>
      </div>

      <div className="card">
        {myRestaurantId != null && (
          <p
            style={{
              margin: '0 0 0.75rem',
              padding: '0.5rem 0.65rem',
              background: '#eff6ff',
              borderRadius: 8,
              fontSize: '0.82rem',
              color: '#1e3a5f',
            }}
          >
            طلبات الويب والتيليجرام لنفس المطعم ({myRestaurantId}) تظهر هنا عندما يطابق الرابط{' '}
            <code style={{ background: '#fff', padding: '0.05rem 0.25rem', borderRadius: 4 }}>/order/{myRestaurantId}</code>.
          </p>
        )}
        <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>أحدث الطلبات المؤكدة</span>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            {q ? `نتائج البحث (${filteredRecentOrders.length})` : 'آخر الطلبات (حتى 150)'}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>المصدر</th>
              <th>الاسم</th>
              <th>الهاتف</th>
              <th>العنوان</th>
              <th>ملاحظة</th>
              <th>الإجمالي التقريبي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecentOrders.map((o) => {
              const total = (o.items || []).reduce(
                (sum, it) => sum + (it.price || 0) * (it.quantity || 0),
                0
              );
              return (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {o.order_source === 'web' ? (
                      <span style={{ color: '#059669', fontWeight: 600 }}>ويب</span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>تيليجرام</span>
                    )}
                  </td>
                  <td style={dashCell}>{snapshotLine(o.customer_name_snapshot)}</td>
                  <td style={dashCell}>{snapshotLine(o.customer_phone_snapshot)}</td>
                  <td style={dashCell}>{snapshotLine(o.customer_address_snapshot)}</td>
                  <td style={dashCell}>{snapshotLine(o.public_order_note)}</td>
                  <td>${total.toFixed(2)}</td>
                  <td>
                    <span className="badge-success">{o.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRecentOrders.length === 0 && (
          <p style={{ marginTop: '0.75rem', color: '#6b7280' }}>لا توجد طلبات مطابقة.</p>
        )}
      </div>
    </div>
  );
}

const dashCell = {
  maxWidth: 180,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: '0.85rem',
};
