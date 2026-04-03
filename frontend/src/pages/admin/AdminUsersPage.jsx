import React, { useState, useEffect } from 'react';
import { Search, MinusCircle, Snowflake, Sun, FileText, ChevronDown, ChevronUp, Plus, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FreezeDialog, NotesDialog, CustomMembershipDialog, HistoryDialog } from './AdminUserDialogs';

var API = process.env.REACT_APP_BACKEND_URL + '/api';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

var STATUS_MAP = {
  'active': { label: 'Aktivan', color: 'bg-green-500/20 text-green-400' },
  'pending': { label: 'Na cekanju', color: 'bg-amber-500/20 text-amber-400' },
  'frozen': { label: 'Zamrznut', color: 'bg-blue-500/20 text-blue-400' },
  'expired': { label: 'Istekao', color: 'bg-red-500/20 text-red-400' },
};

function UserActions({ u, actionLoading, onDeduct, onFreeze, onUnfreeze, onCustom, onHistory, onNotes }) {
  return (
    <div className="flex flex-wrap gap-2">
      {u.membership_status === 'aktivna' && u.preostali_termini > 0 && (
        <Button onClick={onDeduct} disabled={actionLoading} className="h-7 md:h-8 bg-amber-600 hover:bg-amber-700 text-white text-[10px] md:text-xs" data-testid="deduct-session-btn">
          <MinusCircle className="w-3 h-3 mr-1" /> Oduzmi termin
        </Button>
      )}
      {u.membership_status === 'aktivna' && (
        <Button onClick={onFreeze} className="h-7 md:h-8 bg-blue-600 hover:bg-blue-700 text-white text-[10px] md:text-xs" data-testid="freeze-btn">
          <Snowflake className="w-3 h-3 mr-1" /> Zamrzni
        </Button>
      )}
      {u.membership_status === 'zamrznuta' && (
        <Button onClick={onUnfreeze} disabled={actionLoading} className="h-7 md:h-8 bg-green-600 hover:bg-green-700 text-white text-[10px] md:text-xs" data-testid="unfreeze-btn">
          <Sun className="w-3 h-3 mr-1" /> Odmrzni
        </Button>
      )}
      <Button onClick={onCustom} className="h-7 md:h-8 bg-[#C4A574] hover:bg-[#A68B5B] text-white text-[10px] md:text-xs" data-testid="custom-membership-btn">
        <Plus className="w-3 h-3 mr-1" /> Dodaj clanarinu
      </Button>
      <Button onClick={onHistory} variant="ghost" className="h-7 md:h-8 text-white/50 text-[10px] md:text-xs" data-testid="history-btn">
        <History className="w-3 h-3 mr-1" /> Historija
      </Button>
      <Button onClick={onNotes} variant="ghost" className="h-7 md:h-8 text-white/50 text-[10px] md:text-xs" data-testid="notes-btn">
        <FileText className="w-3 h-3 mr-1" /> Biljeska
      </Button>
    </div>
  );
}

function UserDetails({ u }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-white/5 rounded-lg p-2"><p className="text-white/40 text-[10px]">Registracija</p><p className="text-white text-xs">{formatDate(u.created_at)}</p></div>
        <div className="bg-white/5 rounded-lg p-2"><p className="text-white/40 text-[10px]">Aktivacija</p><p className="text-white text-xs">{formatDate(u.datum_aktivacije)}</p></div>
        <div className="bg-white/5 rounded-lg p-2"><p className="text-white/40 text-[10px]">Istice</p><p className="text-white text-xs">{formatDate(u.datum_isteka)}</p></div>
        <div className="bg-white/5 rounded-lg p-2"><p className="text-white/40 text-[10px]">Zakazani</p><p className="text-white text-xs">{u['predstojeći_treninzi']} termina</p></div>
      </div>
      {u.notes && <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2"><p className="text-amber-400/70 text-[10px] uppercase mb-1">Biljeska</p><p className="text-white/70 text-xs">{u.notes}</p></div>}
      {u.freeze_start && <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2"><p className="text-blue-400/70 text-xs">Zamrznuto: {u.freeze_start} do {u.freeze_end}</p></div>}
    </div>
  );
}

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [freezeDialog, setFreezeDialog] = useState(null);
  const [notesDialog, setNotesDialog] = useState(null);
  const [customDialog, setCustomDialog] = useState(null);
  const [historyDialog, setHistoryDialog] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeEnd, setFreezeEnd] = useState('');
  const [noteText, setNoteText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState('');
  const [customForm, setCustomForm] = useState({ naziv: '', cijena: '', termini: '', trajanje_dana: '30' });

  function fetchUsers() {
    Promise.all([
      fetch(API + '/admin/users', { credentials: 'include' }),
      fetch(API + '/admin/packages', { credentials: 'include' })
    ]).then(function(results) {
      if (results[0].ok) results[0].json().then(setUsers);
      if (results[1].ok) results[1].json().then(setPackages);
    }).catch(function(err) { console.error(err); })
    .finally(function() { setLoading(false); });
  }

  useEffect(function() { fetchUsers(); }, []);

  function handleDeduct(userId) {
    setActionLoading(true);
    fetch(API + '/admin/users/' + userId + '/deduct-session', { method: 'POST', credentials: 'include' })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); fetchUsers(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); })
      .finally(function() { setActionLoading(false); });
  }

  function handleFreeze() {
    if (!freezeDialog || !freezeStart || !freezeEnd) { toast.error('Popunite datume'); return; }
    setActionLoading(true);
    fetch(API + '/admin/users/' + freezeDialog.user_id + '/freeze', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: freezeStart, end_date: freezeEnd })
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); setFreezeDialog(null); fetchUsers(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); })
      .finally(function() { setActionLoading(false); });
  }

  function handleUnfreeze(userId) {
    setActionLoading(true);
    fetch(API + '/admin/users/' + userId + '/unfreeze', { method: 'POST', credentials: 'include' })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); fetchUsers(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); })
      .finally(function() { setActionLoading(false); });
  }

  function handleSaveNotes() {
    if (!notesDialog) return;
    setActionLoading(true);
    fetch(API + '/admin/users/' + notesDialog.user_id + '/notes', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: noteText })
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); setNotesDialog(null); fetchUsers(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); })
      .finally(function() { setActionLoading(false); });
  }

  function handleCreateCustom() {
    if (!customDialog) return;
    var userId = customDialog.user_id;
    var body;
    if (selectedPkg) {
      var pkg = packages.find(function(p) { return p.id === selectedPkg; });
      if (!pkg) { toast.error('Paket nije pronadjen'); return; }
      body = { user_id: userId, package_id: pkg.id, naziv: pkg.naziv, cijena: pkg.cijena, termini: pkg.termini, trajanje_dana: pkg.trajanje_dana || 30 };
    } else {
      if (!customForm.naziv || !customForm.cijena || !customForm.termini) { toast.error('Popunite sva polja'); return; }
      body = { user_id: userId, package_id: 'custom', naziv: customForm.naziv, cijena: parseFloat(customForm.cijena), termini: parseInt(customForm.termini), trajanje_dana: parseInt(customForm.trajanje_dana) || 30 };
    }
    setActionLoading(true);
    fetch(API + '/admin/users/' + userId + '/custom-membership', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) {
        if (r.ok) { toast.success(r.data.message); setCustomDialog(null); setSelectedPkg(''); setCustomForm({ naziv: '', cijena: '', termini: '', trajanje_dana: '30' }); fetchUsers(); }
        else toast.error(r.data.detail);
      })
      .catch(function() { toast.error('Greska'); })
      .finally(function() { setActionLoading(false); });
  }

  function handleShowHistory(user) {
    setHistoryDialog(user);
    setHistoryData(null);
    fetch(API + '/admin/users/' + user.user_id + '/membership-history', { credentials: 'include' })
      .then(function(r) { if (r.ok) return r.json(); return null; })
      .then(function(d) { if (d) setHistoryData(d); });
  }

  var filtered = users.filter(function(u) {
    if (!search) return true;
    var q = search.toLowerCase();
    return (u.name && u.name.toLowerCase().indexOf(q) >= 0) || (u.email && u.email.toLowerCase().indexOf(q) >= 0) || (u.phone && u.phone.indexOf(q) >= 0);
  });

  var activePackages = packages.filter(function(p) { return p.active !== false; });

  return (
    <div data-testid="admin-users-page">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-6">Korisnici</h1>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input placeholder="Pretrazi korisnike..." value={search} onChange={function(e) { setSearch(e.target.value); }}
          className="pl-10 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm" data-testid="search-users-input" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(function(i) { return <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />; })}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/40">Nema korisnika</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(function(u) {
            var isExp = expandedUser === u.user_id;
            var st = STATUS_MAP[u.korisnik_status] || STATUS_MAP['pending'];
            return (
              <div key={u.user_id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden" data-testid="user-row">
                <button onClick={function() { setExpandedUser(isExp ? null : u.user_id); }} className="w-full px-3 md:px-4 py-3 flex items-center justify-between text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-white text-xs md:text-sm font-medium truncate">{u.name || 'Bez imena'}</p>
                      <span className={'text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ' + st.color}>{st.label}</span>
                    </div>
                    <p className="text-white/40 text-[10px] md:text-xs truncate">{u.phone || '-'} {u.email ? '| ' + u.email : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-white/70 text-[10px] md:text-xs">{u.naziv_paketa || '-'}</p>
                      <p className="text-white/40 text-[10px]">{u.preostali_termini}/{u.ukupni_termini}</p>
                    </div>
                    {isExp ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </div>
                </button>
                {isExp && (
                  <div className="px-3 md:px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                    <UserDetails u={u} />
                    <UserActions u={u} actionLoading={actionLoading}
                      onDeduct={function() { handleDeduct(u.user_id); }}
                      onFreeze={function() { setFreezeDialog(u); setFreezeStart(''); setFreezeEnd(''); }}
                      onUnfreeze={function() { handleUnfreeze(u.user_id); }}
                      onCustom={function() { setCustomDialog(u); setSelectedPkg(''); setCustomForm({ naziv: '', cijena: '', termini: '', trajanje_dana: '30' }); }}
                      onHistory={function() { handleShowHistory(u); }}
                      onNotes={function() { setNotesDialog(u); setNoteText(u.notes || ''); }}
                    />
                    {u.pending_request && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs">
                        <p className="text-amber-400">Zahtjev: {u.pending_request.package_name} ({u.pending_request.package_price} KM)</p>
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

      <FreezeDialog open={!!freezeDialog} user={freezeDialog} freezeStart={freezeStart} freezeEnd={freezeEnd}
        setFreezeStart={setFreezeStart} setFreezeEnd={setFreezeEnd} onClose={function() { setFreezeDialog(null); }}
        onConfirm={handleFreeze} loading={actionLoading} />
      <NotesDialog open={!!notesDialog} user={notesDialog} noteText={noteText} setNoteText={setNoteText}
        onClose={function() { setNotesDialog(null); }} onSave={handleSaveNotes} loading={actionLoading} />
      <CustomMembershipDialog open={!!customDialog} user={customDialog} selectedPkg={selectedPkg}
        setSelectedPkg={setSelectedPkg} packages={activePackages} customForm={customForm} setCustomForm={setCustomForm}
        onClose={function() { setCustomDialog(null); }} onConfirm={handleCreateCustom} loading={actionLoading} />
      <HistoryDialog open={!!historyDialog} user={historyDialog} historyData={historyData}
        onClose={function() { setHistoryDialog(null); setHistoryData(null); }} />
    </div>
  );
}

export default AdminUsersPage;
