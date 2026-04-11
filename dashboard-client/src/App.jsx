import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
import Stats from './pages/Stats';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Landing from './pages/Landing';
import OrderPage from './pages/OrderPage';
import TableQrPage from './pages/TableQrPage';
import { clearAuthToken, getAuthRole, getAuthToken } from './lib/authToken';
import { useMediaQuery } from './hooks/useMediaQuery';

const API = '/api';
const MOBILE_NAV_QUERY = '(max-width: 768px)';

function Layout({ children }) {
  const location = useLocation();
  const token = getAuthToken();
  const role = getAuthRole();
  const isAdmin = role === 'admin';
  const isMobileNav = useMediaQuery(MOBILE_NAV_QUERY);
  const [navOpen, setNavOpen] = useState(false);

  const logout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const isPublicOrderPath = location.pathname.startsWith('/order/');

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNav) setNavOpen(false);
  }, [isMobileNav]);

  useEffect(() => {
    if (!isMobileNav || !navOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileNav, navOpen]);

  useEffect(() => {
    if (!isMobileNav || !navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileNav, navOpen]);

  // لو ما في توكن وانت مش على صفحة تسجيل الدخول → رجّعك للـ login
  if (!token && !isPublicOrderPath && !['/login', '/landing'].includes(location.pathname)) {
    return <Navigate to="/landing" replace />;
  }

  const closeNav = () => setNavOpen(false);

  return (
    <div className="layout-root">
      {isMobileNav && navOpen && (
        <div className="sidebar-backdrop" role="presentation" onClick={closeNav} />
      )}
      <aside className={`app-sidebar ${isMobileNav && navOpen ? 'app-sidebar--open' : ''}`}>
        <div className="app-sidebar-brand">
          {isMobileNav && (
            <button type="button" className="app-sidebar-close" onClick={closeNav} aria-label="إغلاق">
              ×
            </button>
          )}
          <h2 className="app-sidebar-title">Restaurant OS</h2>
        </div>
        <nav className="app-sidebar-nav">
          <Link style={navLink(location.pathname === '/')} to="/" onClick={closeNav}>
            Dashboard
          </Link>
          <Link style={navLink(location.pathname === '/orders')} to="/orders" onClick={closeNav}>
            الطلبات
          </Link>
          <Link style={navLink(location.pathname === '/menu')} to="/menu" onClick={closeNav}>
            المنيو
          </Link>
          <Link style={navLink(location.pathname === '/stats')} to="/stats" onClick={closeNav}>
            الإحصائيات
          </Link>
          <Link style={navLink(location.pathname === '/qr-tables')} to="/qr-tables" onClick={closeNav}>
            QR الطاولات
          </Link>
          {isAdmin && (
            <Link style={navLink(location.pathname === '/admin')} to="/admin" onClick={closeNav}>
              الإدارة
            </Link>
          )}
        </nav>
        {token && (
          <button type="button" className="app-sidebar-logout" onClick={logout}>
            تسجيل الخروج
          </button>
        )}
      </aside>

      {isMobileNav && (
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-mobile-menu-btn"
            onClick={() => setNavOpen(true)}
            aria-label="فتح القائمة"
          >
            ☰
          </button>
          <span className="app-mobile-header-title">Restaurant OS</span>
          <span className="app-mobile-header-spacer" aria-hidden />
        </header>
      )}

      <main className="app-main">{children}</main>
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
                <Route path="/qr-tables" element={<TableQrPage />} />
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