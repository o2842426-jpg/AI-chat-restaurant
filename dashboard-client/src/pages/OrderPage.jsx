import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const MAX_QTY = 5;
const TRACK_POLL_MS = 5000;

const STATUS_TEXT_AR = {
  confirmed: 'تم استلام الطلب',
  preparing: 'جاري التحضير',
  ready: 'طلبك جاهز',
  delivered: 'تم التسليم',
};

function normalizeTrackStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'confirmed' || s === 'preparing' || s === 'ready' || s === 'delivered') {
    return s;
  }
  return 'confirmed';
}

function supportsNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function playStatusBeep(type) {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = type === 'ready' ? 920 : 740;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc.start(now);
    osc.stop(now + 0.28);
    setTimeout(() => {
      void ctx.close();
    }, 350);
  } catch {
    // Best-effort only; browsers may block autoplay.
  }
}

function statusNotificationText(status) {
  if (status === 'preparing') return 'تم البدء بتحضير طلبك';
  if (status === 'ready') return 'طلبك جاهز الآن';
  return '';
}

function parseQrDineInParams(searchParams) {
  const mode = (searchParams.get('mode') || '').trim().toLowerCase();
  const table = (searchParams.get('table') || '').trim();
  if (mode === 'dine_in' && table) {
    return { locked: true, table };
  }
  return { locked: false, table: '' };
}
restartOrdering
export default function OrderPage({ api = '/api' }) {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const rid = Number(restaurantId);

  const qrDineIn = useMemo(() => parseQrDineInParams(searchParams), [searchParams]);

  const [menuData, setMenuData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const [quantities, setQuantities] = useState(() => ({}));
  /** @type {'dine_in' | 'delivery' | 'car'} */
  const [orderType, setOrderType] = useState('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [carIdentifier, setCarIdentifier] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [trackingStatus, setTrackingStatus] = useState(null);
  const [trackingError, setTrackingError] = useState(null);
  const [estimatedPrepMinutes, setEstimatedPrepMinutes] = useState(null);
  const prevTrackingStatusRef = useRef(null);

  const [serviceWaiterSent, setServiceWaiterSent] = useState(false);
  const [serviceBillSent, setServiceBillSent] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(null);
  const [serviceErr, setServiceErr] = useState(null);
  const [serviceMsg, setServiceMsg] = useState(null);

  const dineInTableForService = useMemo(() => {
    if (qrDineIn.locked) return String(qrDineIn.table || '').trim();
    if (orderType === 'dine_in') return String(tableNumber || '').trim();
    return '';
  }, [qrDineIn.locked, qrDineIn.table, orderType, tableNumber]);

  const loadMenu = useCallback(async () => {
    if (!Number.isFinite(rid) || rid <= 0) {
      setLoadError('رقم المطعم غير صالح');
      setLoadingMenu(false);
      return;
    }
    setLoadingMenu(true);
    setLoadError(null);
    try {
      const res = await fetch(`${api}/public/menu/${rid}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تحميل المنيو');
      }
      setMenuData(data);
    } catch (e) {
      setLoadError(e.message || 'تعذر تحميل المنيو');
    } finally {
      setLoadingMenu(false);
    }
  }, [api, rid]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (trackingOrderId == null || trackingStatus === 'delivered') return undefined;

    let cancelled = false;
    let timer = null;

    const pull = async () => {
      try {
        const res = await fetch(`${api}/public/orders/${trackingOrderId}/status`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'تعذر تحديث حالة الطلب');
        }
        const next = normalizeTrackStatus(data.status);
        if (cancelled) return;
        setTrackingStatus(next);
        setEstimatedPrepMinutes(
          data.estimated_prep_minutes == null ? null : Number(data.estimated_prep_minutes)
        );
        setTrackingError(null);
        if (next !== 'delivered') {
          timer = setTimeout(pull, TRACK_POLL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setTrackingError(err.message || 'تعذر تحديث حالة الطلب');
        timer = setTimeout(pull, TRACK_POLL_MS);
      }
    };

    timer = setTimeout(pull, TRACK_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [api, trackingOrderId, trackingStatus]);

  useEffect(() => {
    if (!trackingStatus) return;

    const prev = prevTrackingStatusRef.current;
    if (!prev) {
      prevTrackingStatusRef.current = trackingStatus;
      return;
    }
    if (prev === trackingStatus) return;
    prevTrackingStatusRef.current = trackingStatus;

    if (trackingStatus === 'preparing' || trackingStatus === 'ready') {
      void playStatusBeep(trackingStatus);
      if (supportsNotifications() && Notification.permission === 'granted') {
        const text = statusNotificationText(trackingStatus);
        if (text) {
          try {
            new Notification(text, { body: `رقم الطلب #${trackingOrderId}` });
          } catch {
            // Ignore notification errors.
          }
        }
      }
    }
  }, [trackingOrderId, trackingStatus]);

  useEffect(() => {
    if (trackingOrderId == null || !supportsNotifications()) return;
    if (Notification.permission !== 'default') return;
    Notification.requestPermission().catch(() => {});
  }, [trackingOrderId]);

  const itemById = useMemo(() => {
    const map = new Map();
    if (!menuData?.categories) return map;
    for (const items of Object.values(menuData.categories)) {
      for (const it of items) {
        map.set(it.id, it);
      }
    }
    return map;
  }, [menuData]);

  const cartLines = useMemo(() => {
    const lines = [];
    for (const [idStr, q] of Object.entries(quantities)) {
      const id = Number(idStr);
      const qty = Number(q);
      if (!qty || qty < 1) continue;
      const item = itemById.get(id);
      if (!item) continue;
      lines.push({ id, name: item.name, price: item.price, quantity: qty });
    }
    return lines;
  }, [quantities, itemById]);

  const cartTotal = useMemo(
    () => cartLines.reduce((s, l) => s + l.price * l.quantity, 0),
    [cartLines]
  );

  const setQty = (menuItemId, value) => {
    const v = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(value) || 0)));
    setQuantities((prev) => {
      const next = { ...prev };
      if (v <= 0) delete next[menuItemId];
      else next[menuItemId] = v;
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setTrackingError(null);

    if (cartLines.length === 0) {
      setSubmitError('اختر صنفاً واحداً على الأقل');
      return;
    }

    const submitOrderType = qrDineIn.locked ? 'dine_in' : orderType;
    const submitTable = qrDineIn.locked ? qrDineIn.table : tableNumber.trim();
    const submitCarIdentifier = carIdentifier.trim();

    if (submitOrderType === 'dine_in') {
      if (!submitTable) {
        setSubmitError('يرجى إدخال رقم الطاولة');
        return;
      }
    } else if (submitOrderType === 'car') {
      if (!submitCarIdentifier) {
        setSubmitError('يرجى إدخال تعريف السيارة');
        return;
      }
    } else {
      if (!name.trim() || !phone.trim() || !address.trim()) {
        setSubmitError('يرجى تعبئة الاسم والهاتف والعنوان');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        restaurant_id: rid,
        order_type: submitOrderType,
        items: cartLines.map((l) => ({ menu_item_id: l.id, quantity: l.quantity })),
        note: note.trim() || undefined,
      };
      if (submitOrderType === 'dine_in') {
        payload.table_number = submitTable;
      } else if (submitOrderType === 'car') {
        payload.car_identifier = submitCarIdentifier;
      } else {
        payload.customer_name = name.trim();
        payload.customer_phone = phone.trim();
        payload.customer_address = address.trim();
      }

      const res = await fetch(`${api}/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إرسال الطلب');
      }
      const newOrderId = Number(data.order_id);
      const nextStatus = normalizeTrackStatus(data.status);
      setTrackingOrderId(Number.isFinite(newOrderId) ? newOrderId : null);
      setTrackingStatus(nextStatus);
      setEstimatedPrepMinutes(
        data.estimated_prep_minutes == null ? null : Number(data.estimated_prep_minutes)
      );
      prevTrackingStatusRef.current = nextStatus;
      setQuantities({});
      setNote('');
    } catch (err) {
      setSubmitError(err.message || 'تعذر إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const restartOrdering = () => {
    setTrackingOrderId(null);
    setTrackingStatus(null);
    setTrackingError(null);
    setEstimatedPrepMinutes(null);
    prevTrackingStatusRef.current = null;
    setServiceWaiterSent(false);
    setServiceBillSent(false);
    setServiceErr(null);
    setServiceMsg(null);
    setCarIdentifier('');
  };

  const sendServiceRequest = async (requestType) => {
    if (!dineInTableForService) return;
    setServiceErr(null);
    setServiceMsg(null);
    setServiceLoading(requestType);
    try {
      const res = await fetch(`${api}/public/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: rid,
          table_number: dineInTableForService,
          request_type: requestType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setServiceErr(data.message || 'يوجد طلب معلّق من نفس النوع لهذه الطاولة.');
        return;
      }
      if (!res.ok) {
        throw new Error(data.message || data.error || 'تعذر إرسال طلب الخدمة');
      }
      if (requestType === 'call_waiter') setServiceWaiterSent(true);
      if (requestType === 'request_bill') setServiceBillSent(true);
      setServiceMsg('تم إرسال الطلب إلى الطاقم.');
    } catch (err) {
      setServiceErr(err.message || 'تعذر الإرسال');
    } finally {
      setServiceLoading(null);
    }
  };
submit
  const showTracking = trackingOrderId != null;

  if (!Number.isFinite(rid) || rid <= 0) {
    return (
      <div dir="rtl" style={pageWrap}>
        <p>رابط الطلب غير صالح.</p>
      </div>
    );
  }

  // قبل return
let customerFields = null;

if (qrDineIn.locked) {
  customerFields = null;
} else if (orderType === 'dine_in') {
  customerFields = ( <div style={field}>
                <label htmlFor="table-num">رقم الطاولة</label>
                <input
                  id="table-num"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="مثال: 12"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>);
} else if (orderType === 'car') {
  customerFields = (<div style={field}>
  <label htmlFor="car-identifier">تعريف السيارة</label>
  <input
    id="car-identifier"
    value={carIdentifier}
    onChange={(e) => setCarIdentifier(e.target.value)}
    placeholder="رقم اللوحة أو وصف السيارة"
    style={inputStyle}
  />
</div>);
} else {
  customerFields = (<>
  <div style={field}>
    <label htmlFor="cust-name">الاسم</label>
    <input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
  </div>

  <div style={field}>
    <label htmlFor="cust-phone">الهاتف</label>
    <input id="cust-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
  </div>

  <div style={field}>
    <label htmlFor="cust-addr">العنوان</label>
    <textarea
      id="cust-addr"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      rows={3}
      style={{ ...inputStyle, resize: 'vertical' }}
    />
  </div>
</>);
}

  return (
    <div dir="rtl" lang="ar" style={pageWrap}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>طلب عبر الويب</h1>
        <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
          اختر الأصناف، ثم أرسل الطلب — لا حاجة لتسجيل الدخول.
        </p>
        <p style={{ margin: '0.35rem 0 0', color: '#2563eb', fontSize: '0.88rem' }}>
          هذا الطلب يُسجَّل لمطعم رقم <strong>{rid}</strong> — يجب أن يطابق رقم مطعمك في لوحة التحكم حتى يظهر الطلب هناك.
        </p>
      </header>
      <p
        style={{
          margin: '0 0 1rem',
          padding: '0.65rem 0.85rem',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 10,
          color: '#1e3a5f',
          fontSize: '0.92rem',
          lineHeight: 1.55,
        }}
      >
        إذا أردت استدعاء نادلًا أو طلب الحساب، تحتاج <strong>رقم الطاولة</strong>: إما من رابط الـ QR
        (يُعرَف تلقائيًا)، أو اختر <strong>داخل المطعم</strong> واملأ الحقل أدناه، ثم استخدم قسم «طلب
        خدمة».
      </p>
      {loadingMenu && <p>جاري تحميل المنيو…</p>}
      {loadError && (
        <div style={errorBox}>
          {loadError}
          <button type="button" onClick={loadMenu} style={retryBtn}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {menuData && !loadError && (
        <>
          {showTracking ? (
        <section style={{ ...card, ...trackingCard }}>
          <h2 style={{ ...h2, marginBottom: '0.5rem' }}>متابعة الطلب</h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
            اترك هذه الصفحة مفتوحة لمتابعة الطلب.
          </p>
          <p style={{ margin: '0.65rem 0 0', fontSize: '0.95rem' }}>
            رقم الطلب: <strong>#{trackingOrderId}</strong>
          </p>
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.92rem', color: '#374151' }}>
            {estimatedPrepMinutes != null && Number.isFinite(estimatedPrepMinutes) && estimatedPrepMinutes >= 1
              ? `الوقت المتوقع لتجهيز الطلب: ${Math.floor(estimatedPrepMinutes)} دقيقة`
              : 'سيتم تحديد وقت التجهيز قريبًا'}
          </p>
          <div style={trackingStatusBox(trackingStatus)}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
              {STATUS_TEXT_AR[trackingStatus] || 'يتم تحديث الحالة...'}
            </div>
            {trackingStatus !== 'delivered' && (
              <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: '0.35rem' }}>
                سيتم تحديث الحالة تلقائياً كل 5 ثوانٍ
              </div>
            )}
          </div>
          {supportsNotifications() ? (
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#6b7280' }}>
              إشعارات المتصفح: <strong>{Notification.permission === 'granted' ? 'مفعّلة' : Notification.permission === 'denied' ? 'مرفوضة' : 'بانتظار الإذن'}</strong>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#6b7280' }}>
              المتصفح الحالي لا يدعم إشعارات النظام.
            </p>
          )}
          {trackingError && <div style={errorBox}>{trackingError}</div>}
          {trackingStatus === 'delivered' && (
            <div style={{ ...errorBox, background: '#ecfdf5', borderColor: '#6ee7b7', color: '#065f46' }}>
              تم إنهاء الطلب. شكراً لك.
            </div>
          )}
          <button type="button" onClick={restartOrdering} style={newOrderBtn}>
            إنشاء طلب جديد
          </button>
        </section>
          ) : (
        <form onSubmit={submit}>
          {qrDineIn.locked ? (
            <section style={{ ...card, ...qrTableBanner }}>
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#065f46' }}>
                الطلب لهذه الطاولة: {qrDineIn.table}
              </p>
              <p style={{ margin: '0.5rem 0 0', color: '#047857', fontSize: '0.9rem' }}>
                طلب داخل المطعم — لا حاجة لإدخال الهاتف أو العنوان.
              </p>
            </section>
          ) : (
            <section style={card}>
              <h2 style={h2}>نوع الطلب</h2>
              <p style={{ margin: '0 0 0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>
                اختر داخل المطعم أو توصيل قبل إكمال الطلب.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setOrderType('dine_in')}
                  style={orderType === 'dine_in' ? typeBtnActive : typeBtnIdle}
                >
                  🍽️ داخل المطعم
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  style={orderType === 'delivery' ? typeBtnActive : typeBtnIdle}
                >
                  🚚 توصيل
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('car')}
                  style={orderType === 'car' ? typeBtnActive : typeBtnIdle}
                >
                   سيارة
                </button>

              </div>
            </section>
          )}

          <section style={card}>
            <h2 style={h2}>المنيو</h2>
            {Object.entries(menuData.categories || {}).map(([category, items]) => (
              <div key={category} style={{ marginBottom: '1.25rem' }}>
                <h3 style={h3}>{category}</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map((it) => {
                    const isAvailable = it.is_active == null ? true: Boolean(it.is_active)
                    return (
                    <li
                      key={it.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.65rem 0',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <div>
                      <div style={{ fontWeight: 600, color: isAvailable ? '#111827' : '#9ca3af' }}>
                            {it.name}{!isAvailable ? ' (غير متوفر)' : ''}
                          </div>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{it.price.toFixed(2)}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
                        الكمية
                        <select
                          value={quantities[it.id] ?? 0}
                          onChange={(ev) => setQty(it.id, ev.target.value)}
                          style={selectStyle}
                          disabled={!isAvailable}
                        >
                          <option value={0}>0</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                    )
                      })}
                </ul>
              </div>
            ))}
          </section>

          <section style={card}>
            <h2 style={h2}>السلة</h2>
            {cartLines.length === 0 ? (
              <p style={{ color: '#6b7280' }}>لا توجد أصناف بعد.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {cartLines.map((l) => (
                  <li
                    key={l.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span>
                      {l.name} × {l.quantity}
                    </span>
                    <span>{(l.price * l.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div
              style={{
                marginTop: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>الإجمالي</span>
              <span>{cartTotal.toFixed(2)}</span>
            </div>
          </section>

          <section style={card}>
            {customerFields}
            <div style={field}>
              <label htmlFor="cust-note">ملاحظة (اختياري)</label>
              <input id="cust-note" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
            </div>
          </section>

          {submitError && <div style={errorBox}>{submitError}</div>}

          <button
            type="submit"
            disabled={submitting || cartLines.length === 0}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.85rem 1rem',
              background: submitting || cartLines.length === 0 ? '#9ca3af' : '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: submitting || cartLines.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'جاري الإرسال…' : 'إرسال الطلب'}
          </button>
        </form>
          )}

          {dineInTableForService ? (
            <section style={card}>
              <h2 style={h2}>طلب خدمة</h2>
              <p style={{ margin: '0 0 0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>
                للطاولة <strong>{dineInTableForService}</strong> — يصل الطلب إلى لوحة التحكم تحت «طلبات الخدمة».
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => sendServiceRequest('call_waiter')}
                  disabled={Boolean(serviceLoading) || serviceWaiterSent}
                  style={{
                    ...typeBtnIdle,
                    opacity: serviceLoading || serviceWaiterSent ? 0.65 : 1,
                    cursor: serviceLoading || serviceWaiterSent ? 'not-allowed' : 'pointer',
                  }}
                >
                  {serviceLoading === 'call_waiter'
                    ? 'جاري الإرسال…'
                    : serviceWaiterSent
                      ? 'تم طلب النادل'
                      : 'استدعاء النادل'}
                </button>
                <button
                  type="button"
                  onClick={() => sendServiceRequest('request_bill')}
                  disabled={Boolean(serviceLoading) || serviceBillSent}
                  style={{
                    ...typeBtnIdle,
                    opacity: serviceLoading || serviceBillSent ? 0.65 : 1,
                    cursor: serviceLoading || serviceBillSent ? 'not-allowed' : 'pointer',
                  }}
                >
                  {serviceLoading === 'request_bill'
                    ? 'جاري الإرسال…'
                    : serviceBillSent
                      ? 'تم طلب الحساب'
                      : 'طلب الحساب'}
                </button>
              </div>
              {serviceMsg && (
                <p style={{ margin: '0.75rem 0 0', color: '#065f46', fontSize: '0.9rem' }}>{serviceMsg}</p>
              )}
              {serviceErr && <div style={{ ...errorBox, marginTop: '0.75rem' }}>{serviceErr}</div>}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

const pageWrap = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '1.5rem 1rem 3rem',
  minHeight: '100vh',
  background: '#f9fafb',
  boxSizing: 'border-box',
};

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: '1.25rem',
  marginBottom: '1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const h2 = { margin: '0 0 1rem', fontSize: '1.15rem', color: '#111827' };
const h3 = { margin: '0 0 0.5rem', fontSize: '1rem', color: '#374151' };

const field = { marginBottom: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' };

const inputStyle = {
  padding: '0.55rem 0.65rem',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: '1rem',
};

const selectStyle = {
  padding: '0.35rem 0.5rem',
  borderRadius: 8,
  border: '1px solid #d1d5db',
};

const errorBox = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  padding: '0.75rem 1rem',
  borderRadius: 8,
  marginBottom: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const retryBtn = {
  alignSelf: 'flex-start',
  padding: '0.35rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #991b1b',
  background: '#fff',
  cursor: 'pointer',
};

const typeBtnBase = {
  flex: '1 1 140px',
  padding: '0.65rem 0.85rem',
  borderRadius: 10,
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: '2px solid transparent',
};

const typeBtnActive = {
  ...typeBtnBase,
  background: '#059669',
  color: '#fff',
  borderColor: '#047857',
};

const typeBtnIdle = {
  ...typeBtnBase,
  background: '#fff',
  color: '#374151',
  borderColor: '#d1d5db',
};

const qrTableBanner = {
  background: '#ecfdf5',
  border: '1px solid #6ee7b7',
};

function trackingStatusBox(status) {
  const done = status === 'delivered';
  return {
    marginTop: '0.9rem',
    marginBottom: '0.9rem',
    borderRadius: 10,
    padding: '0.85rem 0.95rem',
    background: done ? '#ecfdf5' : '#eff6ff',
    border: `1px solid ${done ? '#6ee7b7' : '#bfdbfe'}`,
    color: done ? '#065f46' : '#1e3a8a',
  };
}

const trackingCard = {
  border: '1px solid #e5e7eb',
};

const newOrderBtn = {
  marginTop: '0.25rem',
  width: '100%',
  padding: '0.75rem 1rem',
  background: '#111827',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};
