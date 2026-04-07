import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { XCircle, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [cancelDialog, setCancelDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const token = localStorage.getItem('admin_token');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (res.ok) setBookings(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchBookings(); }, []);

  const handleCancel = async () => {
    if (!cancelDialog) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API}/admin/bookings/${cancelDialog.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ razlog: cancelReason })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setCancelDialog(null);
        setCancelReason('');
        fetchBookings();
      } else {
        toast.error(data.detail);
      }
    } catch { toast.error('Greška pri otkazivanju'); }
    finally { setCancelling(false); }
  };

  const statusColors = {
    'predstojeći': 'bg-blue-500/20 text-blue-400',
    'završen': 'bg-green-500/20 text-green-400',
    'prethodni': 'bg-gray-500/20 text-gray-400',
    'otkazan': 'bg-red-500/20 text-red-400',
  };

  const statusLabels = {
    'predstojeći': 'Predstojeći',
    'završen': 'Završen',
    'prethodni': 'Prethodni',
    'otkazan': 'Otkazan',
  };

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.korisnik?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.korisnik?.email?.toLowerCase().includes(search.toLowerCase()) ||
      b.korisnik?.phone?.includes(search);
    const matchStatus = filterStatus === 'all' || b.tip === filterStatus;
    return matchSearch && matchStatus;
  });

  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()}`;
  };

  return (
    <div data-testid="admin-bookings-page">
      <h1 className="text-2xl font-bold text-white mb-6">Rezervacije</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Pretraži po imenu, email-u ili telefonu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm"
            data-testid="search-bookings-input"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-10 rounded-md bg-white/10 border border-white/20 text-white px-3 text-sm min-w-[160px]"
          data-testid="filter-status-select"
        >
          <option value="all" className="bg-[#1a1a2e]">Svi statusi</option>
          <option value="predstojeći" className="bg-[#1a1a2e]">Predstojeći</option>
          <option value="završen" className="bg-[#1a1a2e]">Završeni</option>
          <option value="otkazan" className="bg-[#1a1a2e]">Otkazani</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/40">Nema rezervacija</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden overflow-x-auto">
          {/* Desktop table header */}
          <div className="hidden lg:grid grid-cols-5 gap-4 px-5 py-3 bg-white/5 border-b border-white/10 text-white/50 text-xs font-medium uppercase tracking-wider">
            <span>Korisnik</span>
            <span>Datum</span>
            <span>Vrijeme</span>
            <span>Status</span>
            <span>Akcija</span>
          </div>

          <div className="divide-y divide-white/5">
            {filtered.map((b) => (
              <div key={b.id} className="px-5 py-3 hover:bg-white/5 transition-colors" data-testid="booking-row">
                {/* Mobile layout */}
                <div className="lg:hidden space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-sm font-medium">{b.korisnik?.name || 'Nepoznat'}</p>
                      <p className="text-white/40 text-xs">{b.korisnik?.email || b.korisnik?.phone || '-'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[b.tip] || 'bg-gray-500/20 text-gray-400'}`}>
                      {statusLabels[b.tip] || b.tip}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{formatDate(b.datum)} u {b.vrijeme}</span>
                  </div>
                  {b.tip === 'predstojeći' && (
                    <Button onClick={() => setCancelDialog(b)} variant="ghost" className="h-8 text-red-400 text-xs w-full" data-testid="cancel-booking-btn">
                      <XCircle className="w-3 h-3 mr-1" /> Otkaži
                    </Button>
                  )}
                </div>

                {/* Desktop layout */}
                <div className="hidden lg:grid grid-cols-5 gap-4 items-center">
                  <div>
                    <p className="text-white text-sm">{b.korisnik?.name || 'Nepoznat'}</p>
                    <p className="text-white/40 text-xs">{b.korisnik?.email || b.korisnik?.phone || '-'}</p>
                  </div>
                  <p className="text-white/70 text-sm">{formatDate(b.datum)}</p>
                  <p className="text-white/70 text-sm">{b.vrijeme}</p>
                  <span className={`text-xs px-2 py-1 rounded-full w-fit ${statusColors[b.tip] || 'bg-gray-500/20 text-gray-400'}`}>
                    {statusLabels[b.tip] || b.tip}
                  </span>
                  <div>
                    {b.tip === 'predstojeći' && (
                      <Button onClick={() => setCancelDialog(b)} variant="ghost" className="h-8 text-red-400 text-xs" data-testid="cancel-booking-btn">
                        <XCircle className="w-3 h-3 mr-1" /> Otkaži
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={() => { setCancelDialog(null); setCancelReason(''); }}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Otkaži rezervaciju</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {cancelDialog && (
              <div className="bg-white/5 rounded-xl p-3 text-sm">
                <p className="text-white">{cancelDialog.korisnik?.name}</p>
                <p className="text-white/50">{formatDate(cancelDialog.datum)} u {cancelDialog.vrijeme}</p>
              </div>
            )}
            <p className="text-amber-400/80 text-xs">
              Otkazivanje je moguće samo 12+ sati prije termina. Ako je manje od 12 sati, termin se računa kao iskorišten.
            </p>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Razlog otkazivanja (opcionalno)</label>
              <Input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Npr. Bolest instruktora..."
                className="h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                data-testid="cancel-reason-input"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setCancelDialog(null)} variant="ghost" className="flex-1 h-10 text-white/60">
                Zatvori
              </Button>
              <Button onClick={handleCancel} disabled={cancelling}
                className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white" data-testid="confirm-cancel-btn">
                {cancelling ? 'Otkazivanje...' : 'Potvrdi otkazivanje'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBookingsPage;
