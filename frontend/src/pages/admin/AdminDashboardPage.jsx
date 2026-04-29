import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CreditCard, CalendarDays, BookOpen, Check, X, AlertTriangle,
  DollarSign, Plus, Trash2, CheckCircle2, StickyNote, TrendingUp, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard } from './components/StatCard';
import { SectionCard } from './components/SectionCard';
import { RevenueLineChart } from './components/RevenueLineChart';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

function formatDateBS(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

function PendingRequest({ req, onApprove, onReject, loading }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="package-request-card">
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{req.user_name}</p>
        <p className="text-white/40 text-[11px] truncate">{req.user_phone}</p>
        <p className="text-[#C4A574] text-xs mt-1">{req.package_name} — {req.package_price} KM</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onApprove} disabled={loading} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3" data-testid="approve-request-btn">
          <Check className="w-3 h-3 mr-1" /> Odobri
        </Button>
        <Button onClick={onReject} disabled={loading} variant="ghost" className="h-8 text-rose-400 hover:bg-rose-500/10 text-xs px-3" data-testid="reject-request-btn">
          <X className="w-3 h-3 mr-1" /> Odbij
        </Button>
      </div>
    </div>
  );
}

function ReminderRow({ r, onToggle, onDelete }) {
  const done = r.zavrseno;
  return (
    <div className={'flex items-center gap-2 bg-white/5 rounded-lg p-2 ' + (done ? 'opacity-50' : '')} data-testid="reminder-item">
      <button onClick={onToggle} data-testid="toggle-reminder-btn">
        <CheckCircle2 className={'w-4 h-4 ' + (done ? 'text-emerald-400' : 'text-white/20')} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={'text-xs text-white ' + (done ? 'line-through' : '')}>{r.tekst}</p>
        {r.datum && <p className="text-[10px] text-white/30">{formatDateBS(r.datum)}</p>}
      </div>
      <button onClick={onDelete} className="text-rose-400/60 hover:text-rose-400" data-testid="delete-reminder-btn">
        <Trash2 className="w-3 h-3" />
      </button>
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
  const navigate = useNavigate();

  function fetchAll() {
    Promise.all([
      fetch(API + '/admin/dashboard', { credentials: 'include' }),
      fetch(API + '/admin/finance', { credentials: 'include' }),
      fetch(API + '/admin/alerts', { credentials: 'include' }),
      fetch(API + '/admin/reminders', { credentials: 'include' }),
    ])
      .then(async (results) => {
        if (results[0].ok) setStats(await results[0].json());
        if (results[1].ok) setFinancial(await results[1].json());
        if (results[2].ok) setAlerts(await results[2].json());
        if (results[3].ok) setReminders(await results[3].json());
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  function handleApprove(id) {
    setActionLoading(id);
    fetch(API + '/admin/package-requests/' + id + '/approve', { method: 'POST', credentials: 'include' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((r) => { if (r.ok) { toast.success(r.data.message); fetchAll(); } else toast.error(r.data.detail); })
      .catch(() => toast.error('Greška'))
      .finally(() => setActionLoading(null));
  }

  function handleReject(id) {
    setActionLoading(id);
    fetch(API + '/admin/package-requests/' + id + '/reject', { method: 'POST', credentials: 'include' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((r) => { if (r.ok) { toast.success(r.data.message); fetchAll(); } else toast.error(r.data.detail); })
      .catch(() => toast.error('Greška'))
      .finally(() => setActionLoading(null));
  }

  function handleAddIncome() {
    if (!incomeForm.iznos || !incomeForm.opis) { toast.error('Popunite sva polja'); return; }
    const body = { iznos: parseFloat(incomeForm.iznos), opis: incomeForm.opis, kategorija: incomeForm.kategorija };
    if (incomeForm.datum) body.datum = incomeForm.datum;
    fetch(API + '/admin/manual-income', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((r) => {
        if (r.ok) {
          toast.success(r.data.message);
          setShowIncomeDialog(false);
          setIncomeForm({ iznos: '', opis: '', kategorija: 'ostalo', datum: '' });
          fetchAll();
        } else toast.error(r.data.detail);
      })
      .catch(() => toast.error('Greška'));
  }

  function handleAddReminder() {
    if (!reminderForm.tekst) { toast.error('Unesite tekst podsjetnika'); return; }
    const body = { tekst: reminderForm.tekst };
    if (reminderForm.datum) body.datum = reminderForm.datum;
    fetch(API + '/admin/reminders', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((r) => {
        if (r.ok) {
          toast.success(r.data.message);
          setShowReminderDialog(false);
          setReminderForm({ tekst: '', datum: '' });
          fetchAll();
        } else toast.error(r.data.detail);
      })
      .catch(() => toast.error('Greška'));
  }

  function toggleReminder(id) {
    fetch(API + '/admin/reminders/' + id + '/toggle', { method: 'POST', credentials: 'include' }).then(fetchAll);
  }
  function deleteReminder(id) {
    fetch(API + '/admin/reminders/' + id, { method: 'DELETE', credentials: 'include' }).then(fetchAll);
  }

  if (loading) {
    return (
      <div data-testid="admin-dashboard">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Kontrolna tabla</h1>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const pendingRequests = stats ? (stats.posljednji_zahtjevi || []) : [];
  const expiringAlerts = alerts ? (alerts.isticu_uskoro || []) : [];
  const lowSessionAlerts = alerts ? (alerts.malo_termina || []) : [];
  const totalAlerts = expiringAlerts.length + lowSessionAlerts.length;
  const monthlyData = financial ? (financial.mjesecni_prihod || []) : [];
  const recentUsers = stats ? (stats.posljednji_korisnici || []) : [];
  const activeReminders = reminders.filter((r) => !r.zavrseno);

  const monthRevenue = financial ? financial.ovaj_mjesec_prihod : 0;
  const monthPkg = financial ? (financial.ovaj_mjesec_paketi || 0) : 0;
  const monthManual = financial ? (financial.ovaj_mjesec_rucni || 0) : 0;

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Kontrolna tabla</h1>
          <p className="text-white/40 text-xs md:text-sm mt-1">Pregled u realnom vremenu — Linea Pilates</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Activity className="w-4 h-4 text-emerald-400" />
          Uživo
        </div>
      </header>

      {/* Top stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard testId="stat-revenue" icon={DollarSign} accent="gold" label="Prihod (mjesec)" value={`${monthRevenue} KM`} />
          <StatCard testId="stat-active-memberships" icon={CreditCard} accent="emerald" label="Aktivne članarine" value={stats.aktivne_clanarine} />
          <StatCard testId="stat-today-trainings" icon={CalendarDays} accent="amber" label="Danas treninga" value={stats.danasnji_treninzi} />
          <StatCard testId="stat-users" icon={Users} accent="blue" label="Korisnici" value={stats.ukupno_korisnika} />
          <StatCard testId="stat-pending" icon={BookOpen} accent="purple" label="Zahtjevi" value={stats.zahtjevi_na_cekanju} />
        </div>
      )}

      {/* Revenue chart */}
      {financial && (
        <SectionCard
          testId="revenue-section"
          title="Prihod kroz mjesece"
          icon={TrendingUp}
          accent="gold"
          actions={
            <button
              onClick={() => navigate('/admin/finansije')}
              className="text-[#C4A574] text-xs hover:underline"
              data-testid="view-finance-btn"
            >
              Detaljan pregled →
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-[10px] uppercase">Ukupno</p>
              <p className="text-white font-bold text-base">{monthRevenue} KM</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
              <p className="text-emerald-400/70 text-[10px] uppercase">Paketi</p>
              <p className="text-white font-bold text-base">{monthPkg} KM</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
              <p className="text-blue-400/70 text-[10px] uppercase">Ručno</p>
              <p className="text-white font-bold text-base">{monthManual} KM</p>
            </div>
          </div>
          {monthlyData.length > 0 ? (
            <RevenueLineChart monthlyData={monthlyData} />
          ) : (
            <div className="text-white/30 text-xs text-center py-8">Nema podataka</div>
          )}
        </SectionCard>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <SectionCard
          testId="pending-requests-section"
          title={`Zahtjevi za pakete (${pendingRequests.length})`}
          icon={BookOpen}
          accent="rose"
        >
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <PendingRequest
                key={req.id}
                req={req}
                loading={actionLoading === req.id}
                onApprove={() => handleApprove(req.id)}
                onReject={() => handleReject(req.id)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Alerts */}
      {totalAlerts > 0 && (
        <SectionCard
          testId="alerts-section"
          title={`Upozorenja (${totalAlerts})`}
          icon={AlertTriangle}
          accent="amber"
        >
          <div className="space-y-2">
            {expiringAlerts.map((a) => (
              <div key={a.id} className="bg-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <div>
                  <p className="text-white text-xs">{a.korisnik?.name || 'Nepoznat'}</p>
                  <p className="text-amber-400/70 text-[10px]">Članarina ističe {formatDateBS(a.datum_isteka)}</p>
                </div>
                <p className="text-white/40 text-[10px]">{a.korisnik?.phone || ''}</p>
              </div>
            ))}
            {lowSessionAlerts.map((a) => (
              <div key={a.id} className="bg-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <div>
                  <p className="text-white text-xs">{a.korisnik?.name || 'Nepoznat'}</p>
                  <p className="text-orange-400/70 text-[10px]">Preostalo {a.preostali_termini} termina</p>
                </div>
                <p className="text-white/40 text-[10px]">{a.korisnik?.phone || ''}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Two columns: Reminders + Recent users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          testId="reminders-section"
          title={`Podsjetnici (${activeReminders.length})`}
          icon={StickyNote}
          accent="amber"
          actions={
            <Button
              onClick={() => setShowReminderDialog(true)}
              variant="ghost"
              className="h-7 text-amber-400 hover:bg-amber-500/10 text-xs px-2"
              data-testid="add-reminder-btn"
            >
              <Plus className="w-3 h-3 mr-1" /> Novi
            </Button>
          }
        >
          {reminders.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-3">Nema podsjetnika</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {reminders.map((r) => (
                <ReminderRow key={r.id} r={r} onToggle={() => toggleReminder(r.id)} onDelete={() => deleteReminder(r.id)} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          testId="recent-users-section"
          title="Posljednji korisnici"
          icon={Users}
          accent="blue"
          actions={
            <button
              onClick={() => navigate('/admin/korisnici')}
              className="text-[#C4A574] text-xs hover:underline"
            >
              Vidi sve →
            </button>
          }
        >
          {recentUsers.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-3">Nema korisnika</p>
          ) : (
            <div className="space-y-1">
              {recentUsers.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => navigate('/admin/korisnici/' + u.user_id)}
                  className="w-full flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg px-2 transition"
                >
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-white text-xs truncate">{u.name || 'Bez imena'}</p>
                    <p className="text-white/40 text-[10px] truncate">{u.email || u.phone || '-'}</p>
                  </div>
                  <p className="text-white/30 text-[10px] ml-2">{formatDateBS(u.created_at)}</p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Quick action: manual income (compact) */}
      <div className="flex justify-end">
        <Button
          onClick={() => setShowIncomeDialog(true)}
          variant="ghost"
          className="text-emerald-400 hover:bg-emerald-500/10 text-xs"
          data-testid="add-income-btn"
        >
          <Plus className="w-3 h-3 mr-1" /> Dodaj ručni prihod
        </Button>
      </div>

      {/* Income Dialog */}
      <Dialog open={showIncomeDialog} onOpenChange={setShowIncomeDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle>Dodaj ručni prihod</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-white/60 text-sm mb-1 block">Iznos (KM)</label>
              <Input type="number" value={incomeForm.iznos} onChange={(e) => setIncomeForm({ ...incomeForm, iznos: e.target.value })} placeholder="100" className="h-10 bg-white/10 border-white/20 text-white" data-testid="income-amount-input" />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Opis</label>
              <Input value={incomeForm.opis} onChange={(e) => setIncomeForm({ ...incomeForm, opis: e.target.value })} placeholder="Npr. Prodaja opreme" className="h-10 bg-white/10 border-white/20 text-white" data-testid="income-desc-input" />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Kategorija</label>
              <select value={incomeForm.kategorija} onChange={(e) => setIncomeForm({ ...incomeForm, kategorija: e.target.value })} className="w-full h-10 rounded-md bg-white/10 border border-white/20 text-white px-3 text-sm" data-testid="income-category-select">
                <option value="ostalo" className="bg-[#1a1a2e]">Ostalo</option>
                <option value="oprema" className="bg-[#1a1a2e]">Oprema</option>
                <option value="privatni_trening" className="bg-[#1a1a2e]">Privatni trening</option>
                <option value="poklon_bon" className="bg-[#1a1a2e]">Poklon bon</option>
              </select>
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Datum</label>
              <Input type="date" value={incomeForm.datum} onChange={(e) => setIncomeForm({ ...incomeForm, datum: e.target.value })} className="h-10 bg-white/10 border-white/20 text-white" />
            </div>
            <Button onClick={handleAddIncome} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="confirm-income-btn">Dodaj prihod</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle>Novi podsjetnik</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-white/60 text-sm mb-1 block">Tekst</label>
              <Input value={reminderForm.tekst} onChange={(e) => setReminderForm({ ...reminderForm, tekst: e.target.value })} placeholder="Npr. Nazvati klijenta X" className="h-10 bg-white/10 border-white/20 text-white" data-testid="reminder-text-input" />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Datum</label>
              <Input type="date" value={reminderForm.datum} onChange={(e) => setReminderForm({ ...reminderForm, datum: e.target.value })} className="h-10 bg-white/10 border-white/20 text-white" />
            </div>
            <Button onClick={handleAddReminder} className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white" data-testid="confirm-reminder-btn">Dodaj podsjetnik</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDashboardPage;
