import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const MAX_QTY = 5;

export default function OrderPage({ api = '/api' }) {
  const { restaurantId } = useParams();
  const rid = Number(restaurantId);

  const [menuData, setMenuData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const [quantities, setQuantities] = useState(() => ({}));
  /** @type {'dine_in' | 'delivery'} */
  const [orderType, setOrderType] = useState('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);

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
    setSuccess(false);

    if (cartLines.length === 0) {
      setSubmitError('اختر صنفاً واحداً على الأقل');
      return;
    }
    if (orderType === 'dine_in') {
      if (!tableNumber.trim()) {
        setSubmitError('يرجى إدخال رقم الطاولة');
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
        order_type: orderType,
        items: cartLines.map((l) => ({ menu_item_id: l.id, quantity: l.quantity })),
        note: note.trim() || undefined,
      };
      if (orderType === 'dine_in') {
        payload.table_number = tableNumber.trim();
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
      setSuccess(true);
      setQuantities({});
      setNote('');
    } catch (err) {
      setSubmitError(err.message || 'تعذر إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  if (!Number.isFinite(rid) || rid <= 0) {
    return (
      <div dir="rtl" style={pageWrap}>
        <p>رابط الطلب غير صالح.</p>
      </div>
    );
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
        <form onSubmit={submit}>
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
            </div>
          </section>

          <section style={card}>
            <h2 style={h2}>المنيو</h2>
            {Object.entries(menuData.categories || {}).map(([category, items]) => (
              <div key={category} style={{ marginBottom: '1.25rem' }}>
                <h3 style={h3}>{category}</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map((it) => (
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
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{it.price.toFixed(2)}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
                        الكمية
                        <select
                          value={quantities[it.id] ?? 0}
                          onChange={(ev) => setQty(it.id, ev.target.value)}
                          style={selectStyle}
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
                  ))}
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
            <h2 style={h2}>بياناتك</h2>
            {orderType === 'dine_in' ? (
              <div style={field}>
                <label htmlFor="table-num">رقم الطاولة</label>
                <input
                  id="table-num"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="مثال: 12"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>
            ) : (
              <>
                <div style={field}>
                  <label htmlFor="cust-name">الاسم</label>
                  <input
                    id="cust-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={field}>
                  <label htmlFor="cust-phone">الهاتف</label>
                  <input
                    id="cust-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={inputStyle}
                  />
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
              </>
            )}
            <div style={field}>
              <label htmlFor="cust-note">ملاحظة (اختياري)</label>
              <input id="cust-note" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
            </div>
          </section>

          {submitError && <div style={errorBox}>{submitError}</div>}
          {success && (
            <div
              style={{
                ...errorBox,
                background: '#ecfdf5',
                borderColor: '#6ee7b7',
                color: '#065f46',
              }}
            >
              تم إرسال الطلب بنجاح
            </div>
          )}

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
