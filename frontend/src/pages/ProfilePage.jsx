import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Calendar, Settings, Bell, LogOut, ChevronRight, Scale, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfilePage = ({ user }) => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API}/user/stats`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}.`;
  };

  const menuItems = [
    {
      icon: Scale,
      label: 'Praćenje težine',
      action: () => navigate('/tezina')
    },
    {
      icon: Bell,
      label: 'Obavještenja',
      action: () => navigate('/obavjestenja')
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
      <div className="flex flex-col items-center mb-6 animate-fade-in">
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

      {/* Membership Status Card */}
      {!loadingStats && stats && (
        <div className="card-linea mb-6 animate-slide-up delay-100" data-testid="membership-status-card">
          <h2 className="font-heading text-lg text-foreground mb-4">
            Status članarine
          </h2>
          
          {/* Remaining slots */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preostalo termina</p>
                <p className="text-xl font-heading text-primary">
                  {stats.preostali_termini}/{stats.ukupni_termini}
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-4">
            <div 
              className="h-full gradient-gold rounded-full transition-all duration-500"
              style={{ width: `${stats.ukupni_termini > 0 ? (stats.preostali_termini / stats.ukupni_termini) * 100 : 0}%` }}
            />
          </div>

          {/* Validity info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Termini važe {stats.trajanje_dana} dana</span>
            </div>
            {stats.datum_isteka && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Važe do: <span className="text-foreground font-medium">{formatDate(stats.datum_isteka)}</span>
                </span>
              </div>
            )}
            {stats.datum_pocetka && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Početak: <span className="text-foreground font-medium">{formatDate(stats.datum_pocetka)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 animate-slide-up delay-200">
        <div className="card-linea text-center">
          <p className="font-heading text-3xl text-primary mb-1">
            {loadingStats ? '-' : stats?.zavrseni_treninzi || 0}
          </p>
          <p className="text-sm text-muted-foreground">Treninga</p>
        </div>
        <div className="card-linea text-center">
          <p className="font-heading text-3xl text-primary mb-1">
            {loadingStats ? '-' : stats?.sedmice_aktivnosti || 0}
          </p>
          <p className="text-sm text-muted-foreground">Sedmica</p>
        </div>
      </div>

      {/* User Info */}
      <div className="card-linea mb-6 animate-slide-up delay-300">
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
                {user?.created_at ? formatDate(user.created_at) : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-2 mb-8 animate-slide-up delay-400">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={item.action}
              className="w-full card-linea card-linea-interactive flex items-center justify-between py-4"
              data-testid={`menu-item-${item.label.toLowerCase().replace(/\s/g, '-')}`}
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
        className="w-full h-12 rounded-full border-destructive text-destructive hover:bg-destructive/5 font-medium animate-slide-up delay-500"
        data-testid="logout-btn"
      >
        <LogOut className="w-5 h-5 mr-2" />
        {loggingOut ? 'Odjava...' : 'Odjavi se'}
      </Button>

      {/* App version */}
      <p className="text-center text-xs text-muted-foreground mt-8 animate-slide-up delay-500">
        Linea Reformer Pilates v1.1.0
      </p>
    </div>
  );
};

export default ProfilePage;
