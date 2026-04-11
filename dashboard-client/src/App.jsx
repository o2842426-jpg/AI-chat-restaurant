import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
import Stats from './pages/Stats';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Landing from './pages/Landing';
import OrderPage from './pages/OrderPage';
import { clearAuthToken, getAuthRole, getAuthToken } from './lib/authToken';

const API = '/api';

function Layout({ children }) {
  const location = useLocation();
  const token = getAuthToken();
  const role = getAuthRole();
  const isAdmin = role === 'admin';

  const logout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const isPublicOrderPath = location.pathname.startsWith('/order/');

  // لو ما في توكن وانت مش على صفحة تسجيل الدخول → رجّعك للـ login
  if (!token && !isPublicOrderPath && !['/login', '/landing'].includes(location.pathname)) {
    return <Navigate to="/landing" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      <aside
        style={{
          width: 240,
          background: '#111827',
          color: '#f9fafb',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2 style={{ marginBottom: '2rem', fontSize: '1.25rem' }}>Restaurant OS</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
          <Link style={navLink(location.pathname === '/')} to="/">Dashboard</Link>
          <Link style={navLink(location.pathname === '/orders')} to="/orders">الطلبات</Link>
          <Link style={navLink(location.pathname === '/menu')} to="/menu">المنيو</Link>
          <Link style={navLink(location.pathname === '/stats')} to="/stats">الإحصائيات</Link>
          {isAdmin && <Link style={navLink(location.pathname === '/admin')} to="/admin">الإدارة</Link>}
        </nav>
        {token && (
          <button
            onClick={logout}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 0.75rem',
              background: '#ef4444',
              borderRadius: 8,
              border: 'none',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            تسجيل الخروج
          </button>
        )}
      </aside>
      <main style={{ flex: 1, padding: '1.5rem 2rem' }}>
        {children}
      </main>
    </div>
  );
}

function navLink(active) {
  return {
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    color: active ? '#111827' : '#e5e7eb',
    background: active ? '#f9fafb' : 'transparent',
    textDecoration: 'none',
    fontSize: '0.95rem',
  };
}

function App() {
  const role = getAuthRole();
  return (
    <BrowserRouter>
      <Routes>
        {/* صفحة تسجيل الدخول */}
        <Route
          path="/landing"
          element={<Landing />}
        />
        <Route
          path="/login"
          element={
            <div
              style={{
                display: 'flex',
                minHeight: '100vh',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#111827',
              }}
            >
              <Login api={API} />
            </div>
          }
        />
        <Route path="/order/:restaurantId" element={<OrderPage api={API} />} />
        {/* بقية الصفحات داخل الـ Layout */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard api={API} />} />
                <Route path="/orders" element={<Orders api={API} />} />
                <Route path="/menu" element={<Menu api={API} />} />
                <Route path="/stats" element={<Stats api={API} />} />
                <Route
                  path="/admin"
                  element={
                    role === 'admin'
                      ? <Admin api={API} />
                      : <div className="card">غير مصرح لك بالدخول إلى صفحة الإدارة.</div>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;