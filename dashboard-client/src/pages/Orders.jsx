import { useState, useEffect } from 'react';
import { authFetch } from '../api';
import { getRestaurantId } from '../lib/authToken';
import { orderTypeLabelAr, snapshotLine } from '../lib/orderSnapshots';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

const CHAIN = ['confirmed', 'preparing', 'ready', 'delivered'];

function statusOptions(current) {
  const c = String(current || '').toLowerCase();
  const idx = CHAIN.indexOf(c);
  if (idx === -1) return CHAIN;
  return CHAIN.slice(idx);
}

export default function Orders({ api }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | confirmed | preparing | ready | delivered

  useEffect(() => {
    setLoading(true);
    const query = filter === 'all' ? '' : `?status=${filter}`;
    authFetch(`${api}/orders${query}`)
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api, filter]);

  const updateStatus = (orderId, status) => {
    authFetch(`${api}/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then(() => {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
      })
      .catch((err) => setError(err.message));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  const myRestaurantId = getRestaurantId();

  return (
    <div className="card">
      <h1>الطلبات</h1>

      {myRestaurantId != null && (
        <p
          style={{
            margin: '0 0 1rem',
            padding: '0.65rem 0.75rem',
            background: '#eff6ff',
            borderRadius: 8,
            fontSize: '0.9rem',
            color: '#1e3a5f',
            lineHeight: 1.5,
          }}
        >
          تظهر هنا طلبات <strong>المطعم رقم {myRestaurantId}</strong> فقط — من التيليجرام <strong>ومن صفحة الويب</strong> معاً، طالما الزبون يفتح{' '}
          <code style={{ background: '#fff', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
            /order/{myRestaurantId}
          </code>
          . إذا كان الرابط لرقم مطعم آخر، لن ترى ذلك الطلب هنا.
        </p>
      )}

      <div className="orders-filter-row" style={{ marginBottom: '1rem' }}>
        <label htmlFor="orders-status-filter">فلتر الحالة: </label>
        <select
          id="orders-status-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">الكل</option>
          <option value="confirmed">مؤكد</option>
          <option value="preparing">قيد التحضير</option>
          <option value="ready">جاهز</option>
          <option value="delivered">تم التوصيل</option>
        </select>
      </div>

      <div className="table-responsive table-responsive--wide">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>المصدر</th>
              <th>النوع</th>
              <th>الطاولة</th>
              <th>التاريخ</th>
              <th>العناصر</th>
              <th>الاسم</th>
              <th>الهاتف</th>
              <th>العنوان</th>
              <th>ملاحظة</th>
              <th>الحالة</th>
              <th>تغيير</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>
                  {order.order_source === 'web' ? (
                    <span style={{ color: '#059669', fontWeight: 600 }}>ويب</span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>تيليجرام</span>
                  )}
                </td>
                <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  {orderTypeLabelAr(order.order_type)}
                </td>
                <td style={{ fontSize: '0.85rem' }}>{snapshotLine(order.table_number)}</td>
                <td>{order.created_at?.slice(0, 16)}</td>
                <td>
                  {order.items
                    ?.map((i) => `${i.name} x${i.quantity}`)
                    .join('، ')}
                </td>
                <td style={cellWide}>{snapshotLine(order.customer_name_snapshot)}</td>
                <td style={cellWide}>{snapshotLine(order.customer_phone_snapshot)}</td>
                <td style={cellWide}>{snapshotLine(order.customer_address_snapshot)}</td>
                <td style={cellWide}>{snapshotLine(order.public_order_note)}</td>
                <td>{order.status}</td>
                <td>
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                  >
                    {statusOptions(order.status).map((s) => (
                      <option key={s} value={s}>
                        {s === 'confirmed'
                          ? 'مؤكد'
                          : s === 'preparing'
                            ? 'قيد التحضير'
                            : s === 'ready'
                              ? 'جاهز'
                              : 'تم التوصيل'}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && <p>لا توجد طلبات.</p>}
    </div>
  );
}

const cellWide = {
  maxWidth: 200,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: '0.9rem',
};
