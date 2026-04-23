import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';

export default function OrderPrintPage({ api }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id } = useParams();

  useEffect(() => {
    setLoading(true);
    setError(null);
    authFetch(`${api}/orders/${id}`)
      .then((data) => {
        setOrder(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'فشل تحميل بيانات الطلب');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [api, id]);

  const typeKey = String(order?.order_type ?? '').trim().toLowerCase();
  const orderTypeLabel =
    typeKey === 'dine_in' ? 'داخل المطعم' : typeKey === 'car' ? 'سيارة' : 'توصيل';

  const { targetLabel, targetValue } = useMemo(() => {
    if (typeKey === 'dine_in') {
      return { targetLabel: 'الطاولة', targetValue: order?.table_number ?? '' };
    }
    if (typeKey === 'car') {
      return { targetLabel: 'السيارة', targetValue: order?.car_identifier ?? '' };
    }
    return { targetLabel: 'العنوان', targetValue: order?.customer_address_snapshot ?? '' };
  }, [order, typeKey]);

  const items = Array.isArray(order?.items) ? order.items : [];

  if (loading) {
    return <div style={{ padding: '1rem' }}>جاري تحميل بيانات الطباعة...</div>;
  }
  if (error) {
    return <div style={{ padding: '1rem', color: '#991b1b' }}>خطأ: {error}</div>;
  }
  if (!order) {
    return <div style={{ padding: '1rem' }}>الطلب غير موجود.</div>;
  }

  return (
    <div className="print-page" dir="rtl">
      <style>
        {`
        .print-page {
          padding: 16px;
          background: #f3f4f6;
          min-height: 100vh;
        }
        .print-receipt {
          width: 80mm;
          margin: 0 auto;
          background: #fff;
          color: #111;
          padding: 10px;
          border: 1px solid #e5e7eb;
          font-size: 12px;
          line-height: 1.45;
        }
        .print-actions {
          width: 80mm;
          margin: 0 auto 8px;
          display: flex;
          justify-content: center;
        }
        .print-btn {
          padding: 8px 14px;
          border: none;
          border-radius: 8px;
          background: #111827;
          color: #fff;
          cursor: pointer;
        }
        .print-line {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 3px 0;
        }
        .print-items {
          list-style: none;
          padding: 0;
          margin: 6px 0 0;
        }
        .print-items li {
          border-bottom: 1px dashed #d1d5db;
          padding: 4px 0;
        }
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body {
            background: #fff !important;
          }
          .print-actions {
            display: none !important;
          }
          .print-page {
            padding: 0;
            background: #fff;
          }
          .print-receipt {
            width: 80mm;
            margin: 0;
            border: none;
            padding: 0;
          }
        }
      `}
      </style>

      <div className="print-actions">
        <button type="button" className="print-btn" onClick={() => window.print()}>
          طباعة
        </button>
      </div>

      <article className="print-receipt">
        <h2 style={{ margin: '0 0 6px', textAlign: 'center' }}>{order.restaurant_name || 'المطعم'}</h2>
        <div className="print-line"><span>رقم الطلب</span><strong>#{order.id}</strong></div>
        <div className="print-line"><span>الوقت</span><span>{order.created_at || '—'}</span></div>
        <div className="print-line"><span>النوع</span><span>{orderTypeLabel}</span></div>
        <div className="print-line"><span>{targetLabel}</span><span>{targetValue || '—'}</span></div>
        <div className="print-line"><span>الاسم</span><span>{order.customer_name_snapshot || '—'}</span></div>
        <div className="print-line"><span>الهاتف</span><span>{order.customer_phone_snapshot || '—'}</span></div>

        <hr style={{ border: 0, borderTop: '1px solid #d1d5db', margin: '8px 0' }} />

        <strong>الأصناف</strong>
        <ul className="print-items">
          {items.length === 0 ? (
            <li>لا توجد عناصر.</li>
          ) : (
            items.map((item) => (
              <li key={item.id ?? `${item.name}-${item.quantity}`}>
                {item.name} x{item.quantity}
              </li>
            ))
          )}
        </ul>

        <hr style={{ border: 0, borderTop: '1px solid #d1d5db', margin: '8px 0' }} />
        <div className="print-line">
          <span>ملاحظة</span>
          <span>{order.public_order_note || '—'}</span>
        </div>
      </article>
    </div>
  );
}