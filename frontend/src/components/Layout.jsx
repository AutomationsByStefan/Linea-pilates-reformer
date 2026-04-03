import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CalendarDays, CreditCard, User, Settings } from 'lucide-react';

const Layout = ({ children, user, hideNav = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user && user.is_admin;

  const navItems = [
    { path: '/', label: 'Početna', icon: Home },
    { path: '/termini', label: 'Termini', icon: CalendarDays },
    { path: '/paketi', label: 'Paketi', icon: CreditCard },
    { path: '/profil', label: 'Profil', icon: User },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="mobile-container" data-testid="app-layout">
      {/* Admin Panel Button */}
      {isAdmin && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#C4A574] text-white text-sm font-semibold shadow-xl hover:bg-[#A68B5B] transition-colors border-2 border-white/30"
            data-testid="admin-panel-btn"
          >
            <Settings className="w-4 h-4" />
            Admin Panel
          </button>
        </div>
      )}

      {/* Main content */}
      <main className={`min-h-screen ${!hideNav ? 'safe-bottom' : 'pb-6'}`}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideNav && (
        <nav className="bottom-nav" data-testid="bottom-navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`nav-item ${active ? 'active' : ''}`}
                data-testid={`nav-${item.label.toLowerCase()}-tab`}
              >
                <Icon strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default Layout;
