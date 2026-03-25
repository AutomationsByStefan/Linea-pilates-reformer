import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, BookOpen, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) { navigate('/admin/login'); return; }
      try {
        const res = await fetch(`${API}/admin/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (res.ok) {
          setAdmin(await res.json());
        } else {
          localStorage.removeItem('admin_token');
          navigate('/admin/login');
        }
      } catch {
        navigate('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, [navigate]);

  const handleLogout = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`${API}/admin/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
    } catch {}
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
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
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1a1a2e] border-r border-white/10
        transform transition-transform lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">Linea Admin</h2>
              <p className="text-white/40 text-xs">{admin?.email}</p>
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                isActive(path)
                  ? 'bg-[#C4A574]/20 text-[#C4A574]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
              data-testid={`admin-nav-${path.split('/').pop() || 'dashboard'}`}
            >
              <Icon className="w-5 h-5" />
              {label}
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

      {/* Main content */}
      <div className="flex-1 min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#1a1a2e] border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-white/70" data-testid="admin-menu-btn">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold">Linea Admin</h1>
        </header>

        <main className="p-4 lg:p-8">
          {typeof children === 'function' ? children({ admin }) : children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
