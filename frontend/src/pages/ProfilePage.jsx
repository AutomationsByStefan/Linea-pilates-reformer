import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Calendar, Settings, Bell, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfilePage = ({ user }) => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      toast.success('Uspješno ste se odjavili');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error('Greška pri odjavi');
    } finally {
      setLoggingOut(false);
    }
  };

  const menuItems = [
    {
      icon: User,
      label: 'Uredi profil',
      action: () => toast.info('Uskoro dostupno')
    },
    {
      icon: Bell,
      label: 'Obavještenja',
      action: () => toast.info('Uskoro dostupno')
    },
    {
      icon: Settings,
      label: 'Postavke',
      action: () => toast.info('Uskoro dostupno')
    }
  ];

  return (
    <div className="px-6 pt-6 pb-4" data-testid="profile-page">
      {/* Profile Header */}
      <div className="flex flex-col items-center mb-8 animate-fade-in">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-4 overflow-hidden">
          {user?.picture ? (
            <img 
              src={user.picture} 
              alt={user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        
        {/* Name */}
        <h1 className="font-heading text-2xl text-foreground mb-1">
          {user?.name || 'Korisnik'}
        </h1>
        
        {/* Email/Phone */}
        <p className="text-muted-foreground text-sm">
          {user?.email || user?.phone || ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 animate-slide-up delay-100">
        <div className="card-linea text-center">
          <p className="font-heading text-3xl text-primary mb-1">12</p>
          <p className="text-sm text-muted-foreground">Treninga</p>
        </div>
        <div className="card-linea text-center">
          <p className="font-heading text-3xl text-primary mb-1">3</p>
          <p className="text-sm text-muted-foreground">Sedmica</p>
        </div>
      </div>

      {/* User Info */}
      <div className="card-linea mb-6 animate-slide-up delay-200">
        <h2 className="font-heading text-lg text-foreground mb-4">
          Informacije
        </h2>
        <div className="space-y-4">
          {user?.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-foreground">{user.email}</p>
              </div>
            </div>
          )}
          {user?.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Telefon</p>
                <p className="text-foreground">{user.phone}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Član od</p>
              <p className="text-foreground">
                {user?.created_at 
                  ? (() => {
                      const date = new Date(user.created_at);
                      const months = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
                      return `${months[date.getMonth()]} ${date.getFullYear()}.`;
                    })()
                  : 'januar 2026.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-2 mb-8 animate-slide-up delay-300">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={item.action}
              className="w-full card-linea card-linea-interactive flex items-center justify-between py-4"
              data-testid={`menu-item-${index}`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Logout Button */}
      <Button
        onClick={handleLogout}
        disabled={loggingOut}
        variant="outline"
        className="w-full h-12 rounded-full border-destructive text-destructive hover:bg-destructive/5 font-medium animate-slide-up delay-400"
        data-testid="logout-btn"
      >
        <LogOut className="w-5 h-5 mr-2" />
        {loggingOut ? 'Odjava...' : 'Odjavi se'}
      </Button>

      {/* App version */}
      <p className="text-center text-xs text-muted-foreground mt-8 animate-slide-up delay-500">
        Linea Reformer Pilates v1.0.0
      </p>
    </div>
  );
};

export default ProfilePage;
