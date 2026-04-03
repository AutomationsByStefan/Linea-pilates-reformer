import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, CalendarDays, BookOpen, Check, X, AlertTriangle, DollarSign, Plus, Trash2, CheckCircle2, StickyNote, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

var API = process.env.REACT_APP_BACKEND_URL + '/api';

function formatDateBS(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

function StatCard({ icon, value, label, color }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 md:p-4">
      <div className={'w-8 h-8 rounded-xl flex items-center justify-center mb-2 ' + color}>{icon}</div>
      <p className="text-lg md:text-xl font-bold text-white">{value}</p>
      <p className="text-white/50 text-[10px] md:text-xs">{label}</p>
    </div>
  );
}

function ReminderItem({ reminder, onToggle, onDelete }) {
  var cls = reminder.zavrseno ? 'opacity-50' : '';
  var iconCls = reminder.zavrseno ? 'text-green-400' : 'text-white/20';
  var textCls = reminder.zavrseno ? 'text-xs text-white line-through' : 'text-xs text-white';
  return (
    <div className={'flex items-center gap-2 bg-white/5 rounded-lg p-2 ' + cls} data-testid="reminder-item">
      <button onClick={onToggle} className="flex-shrink-0" data-testid="toggle-reminder-btn">
        <CheckCircle2 className={'w-4 h-4 ' + iconCls} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={textCls}>{reminder.tekst}</p>
        {reminder.datum && <p className="text-[10px] text-white/30">{reminder.datum}</p>}
      </div>
      <button onClick={onDelete} className="text-red-400/50 hover:text-red-400" data-testid="delete-reminder-btn">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function PackageRequestCard({ req, onApprove, onReject, loading }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 md:p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="package-request-card">
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm">{req.user_name}</p>
        <p className="text-white/50 text-[10px] md:text-xs truncate">{req.user_phone} {req.user_email ? '| ' + req.user_email : ''}</p>
        <p className="text-[#C4A574] text-xs md:text-sm mt-1">{req.package_name} - {req.package_price} KM ({req.package_sessions} termina)</p>
        <p className="text-white/30 text-[10px] mt-1">{formatDateBS(req.created_at)}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onApprove} disabled={loading} className="h-8 md:h-9 bg-green-600 hover:bg-green-700 text-white text-xs" data-testid="approve-request-btn">
          <Check className="w-3 h-3 mr-1" /> Odobri
        </Button>
        <Button onClick={onReject} disabled={loading} variant="ghost" className="h-8 md:h-9 text-red-400 hover:bg-red-500/10 text-xs" data-testid="reject-request-btn">
          <X className="w-3 h-3 mr-1" /> Odbij
        </Button>
      </div>
    </div>
  );
}

function RevenueChart({ data }) {
  var values = data.map(function(m) { return m.revenue; });
  var maxVal = Math.max.apply(null, values.concat([1]));
  return (
    <div className="flex items-end gap-1 h-32 md:h-40 overflow-x-auto pb-1">
      {data.map(function(m) {
        var h = maxVal > 0 ? Math.max(4, (m.revenue / maxVal) * 100) : 4;
        var label = m.month ? m.month.split('-')[1] : '';
        return (
          <div key={m.month} className="flex flex-col items-center flex-1 min-w-[28px]" data-testid="revenue-bar">
            <p className="text-[8px] md:text-[10px] text-white/50 mb-1">{m.revenue > 0 ? m.revenue : ''}</p>
            <div className="w-full rounded-t bg-[#C4A574]/80 transition-all" style={{ height: h + '%' }} />
            <p className="text-[8px] md:text-[10px] text-white/30 mt-1">{label}</p>
          </div>
        );
      })}
    </div>
  );
}

function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ iznos: '', opis: '', kategorija: 'ostalo', datum: '' });
  const [reminderForm, setReminderForm] = useState({ tekst: '', datum: '' });
  var navigate = useNavigate();

  function fetchAll() {
    Promise.all([
      fetch(API + '/admin/dashboard', { credentials: 'include' }),
      fetch(API + '/admin/financial', { credentials: 'include' }),
      fetch(API + '/admin/alerts', { credentials: 'include' }),
      fetch(API + '/admin/reminders', { credentials: 'include' })
    ]).then(function(results) {
      if (results[0].ok) results[0].json().then(setStats);
      if (results[1].ok) results[1].json().then(setFinancial);
      if (results[2].ok) results[2].json().then(setAlerts);
      if (results[3].ok) results[3].json().then(setReminders);
    }).catch(function(err) { console.error(err); })
    .finally(function() { setLoading(false); });
  }

  useEffect(function() { fetchAll(); }, []);

  function handleApprove(requestId) {
    setActionLoading(requestId);
    fetch(API + '/admin/package-requests/' + requestId + '/approve', { method: 'POST', credentials: 'include' })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); fetchAll(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); })
      .finally(function() { setActionLoading(null); });
  }

  function handleReject(requestId) {
    setActionLoading(requestId);
    fetch(API + '/admin/package-requests/' + requestId + '/reject', { method: 'POST', credentials: 'include' })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); fetchAll(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); })
      .finally(function() { setActionLoading(null); });
  }

  function handleAddIncome() {
    if (!incomeForm.iznos || !incomeForm.opis) { toast.error('Popunite sva polja'); return; }
    var body = { iznos: parseFloat(incomeForm.iznos), opis: incomeForm.opis, kategorija: incomeForm.kategorija };
    if (incomeForm.datum) body.datum = incomeForm.datum;
    fetch(API + '/admin/manual-income', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); setShowIncomeDialog(false); setIncomeForm({ iznos: '', opis: '', kategorija: 'ostalo', datum: '' }); fetchAll(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); });
  }

  function handleAddReminder() {
    if (!reminderForm.tekst) { toast.error('Unesite tekst podsjetnika'); return; }
    var body = { tekst: reminderForm.tekst };
    if (reminderForm.datum) body.datum = reminderForm.datum;
    fetch(API + '/admin/reminders', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(r) { if (r.ok) { toast.success(r.data.message); setShowReminderDialog(false); setReminderForm({ tekst: '', datum: '' }); fetchAll(); } else toast.error(r.data.detail); })
      .catch(function() { toast.error('Greska'); });
  }

  function toggleReminder(id) {
    fetch(API + '/admin/reminders/' + id + '/toggle', { method: 'POST', credentials: 'include' })
      .then(function() { fetchAll(); });
  }

  function deleteReminder(id) {
    fetch(API + '/admin/reminders/' + id, { method: 'DELETE', credentials: 'include' })
      .then(function() { fetchAll(); });
  }

  if (loading) {
    return (
      <div data-testid="admin-dashboard">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-6">Kontrolna tabla</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(function(i) { return <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />; })}
        </div>
      </div>
    );
  }

  var pendingRequests = stats ? (stats.posljednji_zahtjevi || []) : [];
  var expiringAlerts = alerts ? (alerts.isticu_uskoro || []) : [];
  var lowSessionAlerts = alerts ? (alerts.malo_termina || []) : [];
  var totalAlerts = expiringAlerts.length + lowSessionAlerts.length;
  var monthlyData = financial ? (financial.mjesecni_prihod || []) : [];
  var revenueByPkg = financial ? (financial.prihod_po_paketu || []) : [];
  var recentUsers = stats ? (stats.posljednji_korisnici || []) : [];
  var activeReminders = reminders.filter(function(r) { return !r.zavrseno; });

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-6">Kontrolna tabla</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard icon={<Users className="w-4 h-4" />} value={stats.ukupno_korisnika} label="Korisnici" color="bg-blue-500/20 text-blue-400" />
          <StatCard icon={<CreditCard className="w-4 h-4" />} value={stats.aktivne_clanarine} label="Aktivne clanarine" color="bg-green-500/20 text-green-400" />
          <StatCard icon={<CalendarDays className="w-4 h-4" />} value={stats.danasnji_treninzi} label="Danasnji treninzi" color="bg-amber-500/20 text-amber-400" />
          <StatCard icon={<BookOpen className="w-4 h-4" />} value={stats.zahtjevi_na_cekanju} label="Zahtjevi na cekanju" color="bg-purple-500/20 text-purple-400" />
          <StatCard icon={<DollarSign className="w-4 h-4" />} value={(financial ? financial.ovaj_mjesec_prihod : 0) + ' KM'} label="Prihod (mjesec)" color="bg-emerald-500/20 text-emerald-400" />
        </div>
      )}

      {/* Reminders */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 mb-6" data-testid="reminders-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm md:text-base flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-400" /> Podsjetnici ({activeReminders.length})
          </h2>
          <Button onClick={function() { setShowReminderDialog(true); }} className="h-7 md:h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs" data-testid="add-reminder-btn">
            <Plus className="w-3 h-3 mr-1" /> Dodaj
          </Button>
        </div>
        {reminders.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-3">Nema podsjetnika</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {reminders.map(function(r) {
              return <ReminderItem key={r.id} reminder={r} onToggle={function() { toggleReminder(r.id); }} onDelete={function() { deleteReminder(r.id); }} />;
            })}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 md:p-5 mb-6" data-testid="pending-requests-section">
          <h2 className="text-white font-semibold mb-4 text-sm md:text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-red-400" /> Zahtjevi za pakete ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map(function(req) {
              return <PackageRequestCard key={req.id} req={req} loading={actionLoading === req.id}
                onApprove={function() { handleApprove(req.id); }} onReject={function() { handleReject(req.id); }} />;
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {totalAlerts > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 md:p-5 mb-6" data-testid="alerts-section">
          <h2 className="text-white font-semibold mb-4 text-sm md:text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Upozorenja ({totalAlerts})
          </h2>
          <div className="space-y-2">
            {expiringAlerts.map(function(a) {
              var name = a.korisnik ? a.korisnik.name : 'Nepoznat';
              var phone = a.korisnik ? a.korisnik.phone : '';
              return (
                <div key={a.id} className="bg-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <div><p className="text-white text-xs">{name}</p><p className="text-amber-400/70 text-[10px]">Clanarina istice {formatDateBS(a.datum_isteka)}</p></div>
                  <p className="text-white/40 text-[10px]">{phone}</p>
                </div>
              );
            })}
            {lowSessionAlerts.map(function(a) {
              var name = a.korisnik ? a.korisnik.name : 'Nepoznat';
              var phone = a.korisnik ? a.korisnik.phone : '';
              return (
                <div key={a.id} className="bg-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <div><p className="text-white text-xs">{name}</p><p className="text-orange-400/70 text-[10px]">Preostalo {a.preostali_termini} termina</p></div>
                  <p className="text-white/40 text-[10px]">{phone}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial */}
      {financial && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 mb-6" data-testid="financial-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <h2 className="text-white font-semibold text-sm md:text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" /> Finansijski pregled
            </h2>
            <Button onClick={function() { setShowIncomeDialog(true); }} className="h-7 md:h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" data-testid="add-income-btn">
              <Plus className="w-3 h-3 mr-1" /> Rucni prihod
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-white/5 rounded-xl p-2"><p className="text-white/50 text-[10px]">Ukupno</p><p className="text-white font-bold text-sm">{financial.ovaj_mjesec_prihod} KM</p></div>
            <div className="bg-white/5 rounded-xl p-2"><p className="text-white/50 text-[10px]">Paketi</p><p className="text-white font-bold text-sm">{financial.ovaj_mjesec_paketi || 0} KM</p></div>
            <div className="bg-white/5 rounded-xl p-2"><p className="text-white/50 text-[10px]">Rucni</p><p className="text-white font-bold text-sm">{financial.ovaj_mjesec_rucni || 0} KM</p></div>
            <div className="bg-white/5 rounded-xl p-2"><p className="text-white/50 text-[10px]">Top paket</p><p className="text-white font-bold text-xs truncate">{financial.najprodavaniji}</p></div>
          </div>
          {monthlyData.length > 0 && (
            <div className="mt-4">
              <p className="text-white/50 text-[10px] mb-2">Mjesecni prihod (12 mjeseci)</p>
              <RevenueChart data={monthlyData} />
            </div>
          )}
          {revenueByPkg.length > 0 && (
            <div className="mt-4">
              <p className="text-white/50 text-[10px] mb-2">Po paketu</p>
              <div className="space-y-1">
                {revenueByPkg.map(function(p) {
                  return (
                    <div key={p.naziv} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                      <span className="text-white text-xs">{p.naziv}</span>
                      <span className="text-white text-xs">{p.revenue} KM <span className="text-white/40">({p.count}x)</span></span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Users */}
      {recentUsers.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold text-sm">Posljednji korisnici</h2>
            <button onClick={function() { navigate('/admin/korisnici'); }} className="text-[#C4A574] text-xs hover:underline">Vidi sve</button>
          </div>
          {recentUsers.map(function(u) {
            return (
              <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="min-w-0 flex-1"><p className="text-white text-xs truncate">{u.name || 'Bez imena'}</p><p className="text-white/40 text-[10px] truncate">{u.email || u.phone || '-'}</p></div>
                <p className="text-white/30 text-[10px] ml-2">{formatDateBS(u.created_at)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Income Dialog */}
      <Dialog open={showIncomeDialog} onOpenChange={setShowIncomeDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle>Dodaj rucni prihod</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><label className="text-white/60 text-sm mb-1 block">Iznos (KM)</label>
            <Input type="number" value={incomeForm.iznos} onChange={function(e) { setIncomeForm(Object.assign({}, incomeForm, { iznos: e.target.value })); }} placeholder="100" className="h-10 bg-white/10 border-white/20 text-white" data-testid="income-amount-input" /></div>
            <div><label className="text-white/60 text-sm mb-1 block">Opis</label>
            <Input value={incomeForm.opis} onChange={function(e) { setIncomeForm(Object.assign({}, incomeForm, { opis: e.target.value })); }} placeholder="Npr. Prodaja opreme" className="h-10 bg-white/10 border-white/20 text-white" data-testid="income-desc-input" /></div>
            <div><label className="text-white/60 text-sm mb-1 block">Kategorija</label>
            <select value={incomeForm.kategorija} onChange={function(e) { setIncomeForm(Object.assign({}, incomeForm, { kategorija: e.target.value })); }} className="w-full h-10 rounded-md bg-white/10 border border-white/20 text-white px-3 text-sm" data-testid="income-category-select">
              <option value="ostalo" className="bg-[#1a1a2e]">Ostalo</option><option value="oprema" className="bg-[#1a1a2e]">Oprema</option><option value="privatni_trening" className="bg-[#1a1a2e]">Privatni trening</option><option value="poklon_bon" className="bg-[#1a1a2e]">Poklon bon</option>
            </select></div>
            <div><label className="text-white/60 text-sm mb-1 block">Datum</label>
            <Input type="date" value={incomeForm.datum} onChange={function(e) { setIncomeForm(Object.assign({}, incomeForm, { datum: e.target.value })); }} className="h-10 bg-white/10 border-white/20 text-white" /></div>
            <Button onClick={handleAddIncome} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="confirm-income-btn">Dodaj prihod</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle>Novi podsjetnik</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><label className="text-white/60 text-sm mb-1 block">Tekst</label>
            <Input value={reminderForm.tekst} onChange={function(e) { setReminderForm(Object.assign({}, reminderForm, { tekst: e.target.value })); }} placeholder="Npr. Nazvati klijenta X" className="h-10 bg-white/10 border-white/20 text-white" data-testid="reminder-text-input" /></div>
            <div><label className="text-white/60 text-sm mb-1 block">Datum</label>
            <Input type="date" value={reminderForm.datum} onChange={function(e) { setReminderForm(Object.assign({}, reminderForm, { datum: e.target.value })); }} className="h-10 bg-white/10 border-white/20 text-white" /></div>
            <Button onClick={handleAddReminder} className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white" data-testid="confirm-reminder-btn">Dodaj podsjetnik</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDashboardPage;
