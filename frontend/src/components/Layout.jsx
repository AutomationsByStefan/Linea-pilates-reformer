import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CalendarDays, CreditCard, User } from 'lucide-react';

const Layout = ({ children, user, hideNav = false }) => {
  const location = useLocation();
  const navigate = useNavigate();

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
