import React, { useState, useEffect } from 'react';
import { Search, MinusCircle, Snowflake, Sun, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [freezeDialog, setFreezeDialog] = useState(null);
  const [notesDialog, setNotesDialog] = useState(null);
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeEnd, setFreezeEnd] = useState('');
  const [noteText, setNoteText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/admin/users`, { credentials: 'include' });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDeduct = async (userId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/admin/users/${userId}/deduct-session`, {
        method: 'POST', credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); fetchUsers(); }
      else toast.error(data.detail);
    } catch { toast.error('Greška'); }
    finally { setActionLoading(false); }
  };

  const handleFreeze = async () => {
    if (!freezeDialog || !freezeStart || !freezeEnd) { toast.error('Popunite datume'); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/admin/users/${freezeDialog.user_id}/freeze`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: freezeStart, end_date: freezeEnd })
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); setFreezeDialog(null); fetchUsers(); }
      else toast.error(data.detail);
    } catch { toast.error('Greška'); }
    finally { setActionLoading(false); }
  };

  const handleUnfreeze = async (userId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/admin/users/${userId}/unfreeze`, {
        method: 'POST', credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); fetchUsers(); }
      else toast.error(data.detail);
    } catch { toast.error('Greška'); }
    finally { setActionLoading(false); }
  };

  const handleSaveNotes = async () => {
    if (!notesDialog) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/admin/users/${notesDialog.user_id}/notes`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteText })
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); setNotesDialog(null); fetchUsers(); }
      else toast.error(data.detail);
    } catch { toast.error('Greška'); }
    finally { setActionLoading(false); }
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q);
  });

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('bs-BA') : '-';

  const statusLabels = {
    'active': { label: 'Aktivan', color: 'bg-green-500/20 text-green-400' },
    'pending': { label: 'Na čekanju', color: 'bg-amber-500/20 text-amber-400' },
    'frozen': { label: 'Zamrznut', color: 'bg-blue-500/20 text-blue-400' },
    'expired': { label: 'Istekao', color: 'bg-red-500/20 text-red-400' },
  };

  return (
    <div data-testid="admin-users-page">
      <h1 className="text-2xl font-bold text-white mb-6">Korisnici</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input placeholder="Pretraži korisnike..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-10 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm" data-testid="search-users-input" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/40">Nema korisnika</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const isExpanded = expandedUser === u.user_id;
            const st = statusLabels[u.korisnik_status] || statusLabels['pending'];
            return (
              <div key={u.user_id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden" data-testid="user-row">
                <button onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-sm font-medium">{u.name || 'Bez imena'}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      {u.country_code && (
                        <span className="text-[10px] text-white/30">{u.country_code}</span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs">{u.phone || '-'} {u.email ? `| ${u.email}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-white/70 text-xs">{u.naziv_paketa || '-'}</p>
                      <p className="text-white/40 text-[10px]">{u.preostali_termini}/{u.ukupni_termini} termina</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                    {/* Details */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-white/40">Registracija</p>
                        <p className="text-white">{formatDate(u.created_at)}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-white/40">Aktivacija</p>
                        <p className="text-white">{formatDate(u.datum_aktivacije)}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-white/40">Ističe</p>
                        <p className="text-white">{formatDate(u.datum_isteka)}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-white/40">Zakazani</p>
                        <p className="text-white">{u['predstojeći_treninzi']} termina</p>
                      </div>
                    </div>

                    {/* Notes */}
                    {u.notes && (
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2">
                        <p className="text-amber-400/70 text-[10px] uppercase mb-1">Bilješka</p>
                        <p className="text-white/70 text-xs">{u.notes}</p>
                      </div>
                    )}

                    {/* Freeze info */}
                    {u.freeze_start && (
                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2">
                        <p className="text-blue-400/70 text-xs">Zamrznuto: {u.freeze_start} do {u.freeze_end}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {u.membership_status === 'aktivna' && u.preostali_termini > 0 && (
                        <Button onClick={() => handleDeduct(u.user_id)} disabled={actionLoading}
                          className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs" data-testid="deduct-session-btn">
                          <MinusCircle className="w-3 h-3 mr-1" /> Oduzmi termin
                        </Button>
                      )}
                      {u.membership_status === 'aktivna' && (
                        <Button onClick={() => { setFreezeDialog(u); setFreezeStart(''); setFreezeEnd(''); }}
                          className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs" data-testid="freeze-btn">
                          <Snowflake className="w-3 h-3 mr-1" /> Zamrzni
                        </Button>
                      )}
                      {u.membership_status === 'zamrznuta' && (
                        <Button onClick={() => handleUnfreeze(u.user_id)} disabled={actionLoading}
                          className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs" data-testid="unfreeze-btn">
                          <Sun className="w-3 h-3 mr-1" /> Odmrzni
                        </Button>
                      )}
                      <Button onClick={() => { setNotesDialog(u); setNoteText(u.notes || ''); }}
                        variant="ghost" className="h-8 text-white/50 text-xs" data-testid="notes-btn">
                        <FileText className="w-3 h-3 mr-1" /> Bilješka
                      </Button>
                    </div>

                    {/* Pending request */}
                    {u.pending_request && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs">
                        <p className="text-amber-400">Zahtjev za paket: {u.pending_request.package_name} ({u.pending_request.package_price} KM)</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-white/30 text-xs mt-4">Ukupno: {filtered.length} korisnika</p>

      {/* Freeze Dialog */}
      <Dialog open={!!freezeDialog} onOpenChange={() => setFreezeDialog(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Zamrzni članarinu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-white/50 text-sm">Zamrzavanje za: {freezeDialog?.name}</p>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Od datuma</label>
              <Input type="date" value={freezeStart} onChange={e => setFreezeStart(e.target.value)}
                className="h-10 bg-white/10 border-white/20 text-white" />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Do datuma</label>
              <Input type="date" value={freezeEnd} onChange={e => setFreezeEnd(e.target.value)}
                className="h-10 bg-white/10 border-white/20 text-white" />
            </div>
            <Button onClick={handleFreeze} disabled={actionLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
              {actionLoading ? 'Zamrzavanje...' : 'Potvrdi zamrzavanje'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={!!notesDialog} onOpenChange={() => setNotesDialog(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Bilješka za {notesDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-white/50 text-xs">Zdravstvena ograničenja, preference, napomene o plaćanju...</p>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4}
              className="w-full rounded-md bg-white/10 border border-white/20 text-white p-3 text-sm resize-none"
              placeholder="Upišite bilješku..." data-testid="notes-textarea" />
            <Button onClick={handleSaveNotes} disabled={actionLoading}
              className="w-full h-11 bg-[#C4A574] hover:bg-[#A68B5B] text-white">
              {actionLoading ? 'Čuvanje...' : 'Sačuvaj bilješku'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;
