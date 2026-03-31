import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, BookOpen, LogOut, Menu, X, Bell, DollarSign, AlertTriangle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminLayout = ({ children, user: passedUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState(passedUser || null);
  const [loading, setLoading] = useState(!passedUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (passedUser) {
      setAdmin(passedUser);
      setLoading(false);
    } else {
      const checkAdmin = async () => {
        try {
          // Try unified auth first
          const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.is_admin) { setAdmin(data); setLoading(false); return; }
          }
          // Fallback to old admin auth
          const token = localStorage.getItem('admin_token');
          if (token) {
            const res2 = await fetch(`${API}/admin/me`, {
              headers: { 'Authorization': `Bearer ${token}` },
              credentials: 'include'
            });
            if (res2.ok) { setAdmin(await res2.json()); setLoading(false); return; }
          }
          navigate('/login');
        } catch { navigate('/login'); }
        finally { setLoading(false); }
      };
      checkAdmin();
    }
  }, [navigate, passedUser]);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch(`${API}/admin/package-requests`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.filter(r => r.status === 'pending').length);
        }
      } catch {}
    };
    if (admin) { fetchPending(); const interval = setInterval(fetchPending, 30000); return () => clearInterval(interval); }
  }, [admin]);

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
      localStorage.removeItem('admin_token');
    } catch {}
    navigate('/login');
  };

  const navItems = [
    { path: '/admin', label: 'Kontrolna tabla', icon: LayoutDashboard },
    { path: '/admin/raspored', label: 'Raspored', icon: CalendarDays },
    { path: '/admin/rezervacije', label: 'Rezervacije', icon: BookOpen },
    { path: '/admin/korisnici', label: 'Korisnici', icon: Users },
  ];

  const isActive = (path) => location.pathname === path;

  if (loading) {
    return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <div className="animate-pulse text-white/50">Učitavanje...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex" data-testid="admin-layout">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1a1a2e] border-r border-white/10
        transform transition-transform lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">Linea Admin</h2>
              <p className="text-white/40 text-xs">{admin?.email || admin?.phone || ''}</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => { navigate(path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all relative ${
                isActive(path)
                  ? 'bg-[#C4A574]/20 text-[#C4A574]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
              data-testid={`admin-nav-${path.split('/').pop() || 'dashboard'}`}
            >
              <Icon className="w-5 h-5" />
              {label}
              {path === '/admin' && pendingCount > 0 && (
                <span className="absolute right-3 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-5 h-5" />
            Odjavi se
          </button>
        </div>
      </aside>

      <div className="flex-1 min-h-screen">
        <header className="lg:hidden sticky top-0 z-30 bg-[#1a1a2e] border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-white/70" data-testid="admin-menu-btn">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold">Linea Admin</h1>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-auto">{pendingCount} zahtjeva</span>
          )}
        </header>

        <main className="p-4 lg:p-8">
          {typeof children === 'function' ? children({ admin }) : children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
