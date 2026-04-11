import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { getAuthRole, getRestaurantId } from '../lib/authToken';
import { buildDineInTableOrderUrl } from '../lib/tableQrOrderUrl';

function QrTile({ fullUrl, tableNum, onCopy, copied }) {
  const [dataUrl, setDataUrl] = useState('');
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(fullUrl, {
      margin: 1,
      width: 192,
      color: { dark: '#111827ff', light: '#ffffffff' },
    })
      .then((u) => {
        if (alive) setDataUrl(u);
      })
      .catch((e) => {
        if (alive) setQrError(e?.message || 'تعذر إنشاء الرمز');
      });
    return () => {
      alive = false;
    };
  }, [fullUrl]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: '1rem',
        boxShadow: '0 4px 20px rgba(15,23,42,0.08)',
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.65rem',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>طاولة {tableNum}</div>
      {dataUrl ? (
        <img src={dataUrl} alt={`QR طاولة ${tableNum}`} style={{ width: 192, height: 192, display: 'block' }} />
      ) : qrError ? (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>{qrError}</p>
      ) : (
        <div style={{ width: 192, height: 192, background: '#f3f4f6', borderRadius: 8 }} />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '0.4rem 0.75rem',
            background: '#059669',
            color: '#fff',
            borderRadius: 8,
            fontSize: '0.85rem',
            textDecoration: 'none',
          }}
        >
          فتح الصفحة
        </a>
        <button
          type="button"
          onClick={() => onCopy(fullUrl, tableNum)}
          style={{
            padding: '0.4rem 0.75rem',
            background: copied ? '#111827' : '#e5e7eb',
            color: copied ? '#fff' : '#111827',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          {copied ? 'تم النسخ' : 'نسخ الرابط'}
        </button>
      </div>
      <code
        style={{
          fontSize: '0.65rem',
          wordBreak: 'break-all',
          color: '#6b7280',
          textAlign: 'center',
          maxWidth: '100%',
          lineHeight: 1.4,
        }}
      >
        {fullUrl}
      </code>
    </div>
  );
}

export default function TableQrPage() {
  const jwtRid = getRestaurantId();
  const role = getAuthRole();
  const isAdmin = role === 'admin';

  const [overrideRid, setOverrideRid] = useState('');
  const [startTable, setStartTable] = useState(1);
  const [tableCount, setTableCount] = useState(8);
  const [copiedKey, setCopiedKey] = useState(null);

  const effectiveRid = useMemo(() => {
    if (jwtRid != null && Number.isFinite(jwtRid) && jwtRid > 0) return jwtRid;
    const n = Number(String(overrideRid).trim());
    if (Number.isFinite(n) && n > 0) return n;
    return null;
  }, [jwtRid, overrideRid]);

  const tableNumbers = useMemo(() => {
    const start = Math.max(1, Math.floor(Number(startTable) || 1));
    const count = Math.min(40, Math.max(1, Math.floor(Number(tableCount) || 1)));
    return Array.from({ length: count }, (_, i) => start + i);
  }, [startTable, tableCount]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const onCopy = async (url, tableNum) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(tableNum);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      window.prompt('انسخ الرابط يدوياً:', url);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1 style={{ margin: '0 0 0.5rem', fontSize: 'clamp(1.15rem, 4vw, 1.35rem)' }}>اختبار QR للطاولات</h1>
        <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.6 }}>
          يُنشئ روابط الصفحة العامة <code style={{ background: '#f3f4f6', padding: '0.1rem 0.35rem', borderRadius: 4 }}>/order/…?mode=dine_in&amp;table=…</code> مع رمز QR لكل طاولة.
          افتح الرابط من الجوال أو امسح الرمز للتأكد أن الطلب يُسجَّل للطاولة الصحيحة.
        </p>

        {isAdmin && jwtRid == null && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              رقم المطعم (لحساب المشرف)
            </label>
            <input
              type="number"
              min={1}
              value={overrideRid}
              onChange={(e) => setOverrideRid(e.target.value)}
              placeholder="مثال: 4"
              style={{
                width: '100%',
                maxWidth: 280,
                padding: '0.5rem 0.65rem',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: '1rem',
              }}
            />
          </div>
        )}

        {!isAdmin && jwtRid != null && (
          <p style={{ margin: '0 0 1rem', padding: '0.65rem 0.85rem', background: '#ecfdf5', borderRadius: 8, color: '#065f46' }}>
            المطعم الحالي: <strong>#{jwtRid}</strong>
          </p>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'flex-end',
            marginBottom: '1.25rem',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
            أول رقم طاولة
            <input
              type="number"
              min={1}
              value={startTable}
              onChange={(e) => setStartTable(e.target.value)}
              style={{ padding: '0.45rem 0.55rem', borderRadius: 8, border: '1px solid #d1d5db', width: 100 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
            عدد الطاولات (حتى 40)
            <input
              type="number"
              min={1}
              max={40}
              value={tableCount}
              onChange={(e) => setTableCount(e.target.value)}
              style={{ padding: '0.45rem 0.55rem', borderRadius: 8, border: '1px solid #d1d5db', width: 100 }}
            />
          </label>
        </div>

        {effectiveRid == null ? (
          <p style={{ color: '#b45309' }}>
            {isAdmin
              ? 'أدخل رقم المطعم أعلاه لعرض الرموز.'
              : 'تعذر تحديد المطعم. سجّل الدخول كمستخدم مطعم.'}
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {tableNumbers.map((t) => {
              const fullUrl = buildDineInTableOrderUrl(origin, effectiveRid, t);
              return <QrTile key={t} fullUrl={fullUrl} tableNum={t} onCopy={onCopy} copied={copiedKey === t} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
