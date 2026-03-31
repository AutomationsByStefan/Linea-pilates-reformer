import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, CalendarDays, BookOpen, Check, X, AlertTriangle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatDateBS(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchAll = async () => {
    try {
      const results = await Promise.all([
        fetch(`${API}/admin/dashboard`, { credentials: 'include' }),
        fetch(`${API}/admin/financial`, { credentials: 'include' }),
        fetch(`${API}/admin/alerts`, { credentials: 'include' })
      ]);
      if (results[0].ok) setStats(await results[0].json());
      if (results[1].ok) setFinancial(await results[1].json());
      if (results[2].ok) setAlerts(await results[2].json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleApprove = async (requestId) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`${API}/admin/package-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchAll();
      } else {
        toast.error(data.detail);
      }
    } catch (e) {
      toast.error('Greška');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`${API}/admin/package-requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchAll();
      } else {
        toast.error(data.detail);
      }
    } catch (e) {
      toast.error('Greška');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div data-testid="admin-dashboard">
        <h1 className="text-2xl font-bold text-white mb-6">Kontrolna tabla</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const pendingRequests = (stats && stats.posljednji_zahtjevi) || [];
  const expiringAlerts = (alerts && alerts.isticu_uskoro) || [];
  const lowSessionAlerts = (alerts && alerts.malo_termina) || [];
  const totalAlerts = expiringAlerts.length + lowSessionAlerts.length;
  const monthlyData = (financial && financial.mjesecni_prihod) || [];
  const revenueByPkg = (financial && financial.prihod_po_paketu) || [];
  const recentUsers = (stats && stats.posljednji_korisnici) || [];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-2xl font-bold text-white mb-6">Kontrolna tabla</h1>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-white">{stats.ukupno_korisnika}</p>
            <p className="text-white/50 text-xs">Korisnici</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center mb-2">
              <CreditCard className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-white">{stats.aktivne_clanarine}</p>
            <p className="text-white/50 text-xs">Aktivne članarine</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
              <CalendarDays className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-white">{stats.danasnji_treninzi}</p>
            <p className="text-white/50 text-xs">Današnji treninzi</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2">
              <BookOpen className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-white">{stats.zahtjevi_na_cekanju}</p>
            <p className="text-white/50 text-xs">Zahtjevi na čekanju</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
              <DollarSign className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-white">{financial ? financial.ovaj_mjesec_prihod : 0} KM</p>
            <p className="text-white/50 text-xs">Prihod (mjesec)</p>
          </div>
        </div>
      )}

      {/* Pending Package Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mb-6" data-testid="pending-requests-section">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-red-400" />
            Zahtjevi za pakete ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map(function(req) {
              return (
                <div key={req.id} className="bg-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="package-request-card">
                  <div className="flex-1">
                    <p className="text-white font-medium">{req.user_name}</p>
                    <p className="text-white/50 text-xs">{req.user_phone} {req.user_email ? '| ' + req.user_email : ''}</p>
                    <p className="text-[#C4A574] text-sm mt-1">{req.package_name} - {req.package_price} KM ({req.package_sessions} termina)</p>
                    <p className="text-white/30 text-xs mt-1">{formatDateBS(req.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={function() { handleApprove(req.id); }} disabled={actionLoading === req.id}
                      className="h-9 bg-green-600 hover:bg-green-700 text-white text-sm" data-testid="approve-request-btn">
                      <Check className="w-4 h-4 mr-1" /> Odobri
                    </Button>
                    <Button onClick={function() { handleReject(req.id); }} disabled={actionLoading === req.id}
                      variant="ghost" className="h-9 text-red-400 hover:bg-red-500/10 text-sm" data-testid="reject-request-btn">
                      <X className="w-4 h-4 mr-1" /> Odbij
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expiry Alerts */}
      {totalAlerts > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 mb-6" data-testid="alerts-section">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Upozorenja ({totalAlerts})
          </h2>
          <div className="space-y-2">
            {expiringAlerts.map(function(a) {
              return (
                <div key={a.id} className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-white text-sm">{a.korisnik ? a.korisnik.name : 'Nepoznat'}</p>
                    <p className="text-amber-400/70 text-xs">Članarina ističe {formatDateBS(a.datum_isteka)}</p>
                  </div>
                  <p className="text-white/40 text-xs">{a.korisnik ? a.korisnik.phone : ''}</p>
                </div>
              );
            })}
            {lowSessionAlerts.map(function(a) {
              return (
                <div key={a.id} className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-white text-sm">{a.korisnik ? a.korisnik.name : 'Nepoznat'}</p>
                    <p className="text-orange-400/70 text-xs">Preostalo samo {a.preostali_termini} termina</p>
                  </div>
                  <p className="text-white/40 text-xs">{a.korisnik ? a.korisnik.phone : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Summary */}
      {financial && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6" data-testid="financial-section">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Finansijski pregled
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/50 text-xs">Ovaj mjesec</p>
              <p className="text-white font-bold text-lg">{financial.ovaj_mjesec_prihod} KM</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/50 text-xs">Aktivni klijenti</p>
              <p className="text-white font-bold text-lg">{financial.aktivne_clanarine}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/50 text-xs">Novi klijenti</p>
              <p className="text-white font-bold text-lg">{financial.novi_klijenti_mjesec}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/50 text-xs">Najprodavaniji</p>
              <p className="text-white font-bold text-sm">{financial.najprodavaniji}</p>
            </div>
          </div>

          {/* Revenue by package */}
          {revenueByPkg.length > 0 && (
            <div className="mt-4">
              <p className="text-white/50 text-xs mb-2">Prihod po paketu</p>
              <div className="space-y-2">
                {revenueByPkg.map(function(p) {
                  return (
                    <div key={p.naziv} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                      <span className="text-white text-sm">{p.naziv}</span>
                      <div className="text-right">
                        <span className="text-white font-medium text-sm">{p.revenue} KM</span>
                        <span className="text-white/40 text-xs ml-2">({p.count}x)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent users */}
      {recentUsers.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold">Posljednji korisnici</h2>
            <button onClick={function() { navigate('/admin/korisnici'); }} className="text-[#C4A574] text-sm hover:underline">
              Vidi sve
            </button>
          </div>
          <div>
            {recentUsers.map(function(u) {
              return (
                <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm">{u.name || 'Bez imena'}</p>
                    <p className="text-white/40 text-xs">{u.email || u.phone || '-'}</p>
                  </div>
                  <p className="text-white/30 text-xs">{formatDateBS(u.created_at)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
