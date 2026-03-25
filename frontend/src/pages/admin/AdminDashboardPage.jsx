import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, CalendarDays, BookOpen } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API}/admin/dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  if (loading) {
    return (
      <div data-testid="admin-dashboard">
        <h1 className="text-2xl font-bold text-white mb-6">Kontrolna tabla</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-28 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-28 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-28 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div data-testid="admin-dashboard">
        <h1 className="text-2xl font-bold text-white mb-6">Kontrolna tabla</h1>
        <p className="text-white/50">Greška pri učitavanju podataka</p>
      </div>
    );
  }

  const recentUsers = stats.posljednji_korisnici || [];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-2xl font-bold text-white mb-6">Kontrolna tabla</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5" data-testid="stat-card-users">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.ukupno_korisnika}</p>
          <p className="text-white/50 text-sm mt-1">Ukupno korisnika</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5" data-testid="stat-card-memberships">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.aktivne_clanarine}</p>
          <p className="text-white/50 text-sm mt-1">Aktivne članarine</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5" data-testid="stat-card-today">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <CalendarDays className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.danasnji_treninzi}</p>
          <p className="text-white/50 text-sm mt-1">Današnji treninzi</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5" data-testid="stat-card-bookings">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.ukupno_rezervacija}</p>
          <p className="text-white/50 text-sm mt-1">Ukupno rezervacija</p>
        </div>
      </div>

      {recentUsers.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold">Posljednji korisnici</h2>
            <button onClick={() => navigate('/admin/korisnici')} className="text-[#C4A574] text-sm hover:underline">
              Vidi sve
            </button>
          </div>
          <div className="space-y-0">
            {recentUsers.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-white text-sm">{u.name || 'Bez imena'}</p>
                  <p className="text-white/40 text-xs">{u.email || u.phone || '-'}</p>
                </div>
                <p className="text-white/30 text-xs">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('bs-BA') : '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
