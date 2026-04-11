export default function Landing() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem 1rem',
        background: '#111827',
        color: '#f9fafb',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 760,
          background: '#1f2937',
          borderRadius: 16,
          padding: '2rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Restaurant OS</h1>
        <p style={{ marginTop: 0, marginBottom: '1rem', color: '#d1d5db' }}>
          منصة بسيطة لتشغيل الطلبات اليومية للمطعم عبر تيليجرام ولوحة تحكم واحدة.
        </p>
        <ul style={{ marginTop: 0, marginBottom: '1.25rem', lineHeight: 1.8 }}>
          <li>إدارة الطلبات من الاستلام حتى التسليم</li>
          <li>لوحة منيو وتحديثات فورية</li>
          <li>إحصائيات تشغيل يومية وأسبوعية</li>
          <li>تشغيل سريع لكل مطعم بشكل مستقل</li>
        </ul>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <a href="/login" style={primaryCta}>
            Start
          </a>
          <a
            href="mailto:sales@restaurant-os.local?subject=Request%20Demo%20-%20Restaurant%20OS"
            style={secondaryCta}
          >
            Request Demo
          </a>
        </div>
      </div>
    </div>
  );
}

const primaryCta = {
  display: 'inline-block',
  padding: '0.65rem 1rem',
  borderRadius: 999,
  background: '#2563eb',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 700,
};

const secondaryCta = {
  display: 'inline-block',
  padding: '0.65rem 1rem',
  borderRadius: 999,
  border: '1px solid #6b7280',
  color: '#f9fafb',
  textDecoration: 'none',
  fontWeight: 700,
};
