import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, PieChart, BarChart3, Trash2, Plus, Calendar, Users, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard } from './components/StatCard';
import { SectionCard } from './components/SectionCard';
import { RevenueLineChart } from './components/RevenueLineChart';
import { PackageDoughnut } from './components/PackageDoughnut';
import { OccupancyBarChart } from './components/OccupancyBarChart';
import { CHART_COLORS } from './components/chartConfig';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

function formatDateBS(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

const KATEGORIJE = {
  ostalo: 'Ostalo',
  oprema: 'Oprema',
  privatni_trening: 'Privatni trening',
  poklon_bon: 'Poklon bon',
};

function AdminFinancePage() {
  const [finance, setFinance] = useState(null);
  const [slotsAnalytics, setSlotsAnalytics] = useState(null);
  const [manualIncome, setManualIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ iznos: '', opis: '', kategorija: 'ostalo', datum: '' });
  const [actionLoading, setActionLoading] = useState(false);

  function fetchAll() {
    Promise.all([
      fetch(API + '/admin/finance', { credentials: 'include' }),
      fetch(API + '/admin/analytics/slots', { credentials: 'include' }),
      fetch(API + '/admin/manual-income', { credentials: 'include' }),
    ])
      .then(async (results) => {
        if (results[0].ok) setFinance(await results[0].json());
        if (results[1].ok) setSlotsAnalytics(await results[1].json());
        if (results[2].ok) setManualIncome(await results[2].json());
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  function handleAddIncome() {
    if (!incomeForm.iznos || !incomeForm.opis) { toast.error('Popunite sva polja'); return; }
    setActionLoading(true);
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
      .catch(() => toast.error('Greška'))
      .finally(() => setActionLoading(false));
  }

  function handleDeleteIncome(id) {
    if (!window.confirm('Obrisati ovaj unos?')) return;
    fetch(API + '/admin/manual-income/' + id, { method: 'DELETE', credentials: 'include' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((r) => { if (r.ok) { toast.success(r.data.message); fetchAll(); } else toast.error(r.data.detail); })
      .catch(() => toast.error('Greška'));
  }

  if (loading) {
    return (
      <div data-testid="admin-finance-page">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Finansije</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const monthRevenue = finance ? finance.ovaj_mjesec_prihod : 0;
  const monthPkg = finance ? (finance.ovaj_mjesec_paketi || 0) : 0;
  const monthManual = finance ? (finance.ovaj_mjesec_rucni || 0) : 0;
  const monthlyData = finance ? (finance.mjesecni_prihod || []) : [];
  const byPackage = finance ? (finance.prihod_po_paketu || []) : [];
  const totalLifetimeRevenue = monthlyData.reduce((sum, m) => sum + (m.revenue || 0), 0);
  const najprodavaniji = finance ? finance.najprodavaniji : '-';
  const noviKlijenti = finance ? (finance.novi_klijenti_mjesec || 0) : 0;
  const aktivneClanarine = finance ? (finance.aktivne_clanarine || 0) : 0;

  const popularDays = slotsAnalytics ? (slotsAnalytics.popular_days || []) : [];
  const popularTimes = slotsAnalytics ? (slotsAnalytics.popular_times || []) : [];
  const avgOccupancy = slotsAnalytics ? (slotsAnalytics.average_occupancy_percent || 0) : 0;
  const totalBookings = slotsAnalytics ? (slotsAnalytics.total_bookings || 0) : 0;

  return (
    <div className="space-y-6" data-testid="admin-finance-page">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Finansije</h1>
          <p className="text-white/40 text-xs md:text-sm mt-1">Detaljan finansijski pregled i analitika</p>
        </div>
        <Button
          onClick={() => setShowIncomeDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="add-income-btn"
        >
          <Plus className="w-4 h-4 mr-2" /> Dodaj ručni prihod
        </Button>
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard testId="stat-month-revenue" icon={DollarSign} accent="gold" label="Prihod ovaj mjesec" value={`${monthRevenue} KM`} />
        <StatCard testId="stat-lifetime-revenue" icon={TrendingUp} accent="emerald" label="Ukupno (12 mjeseci)" value={`${totalLifetimeRevenue} KM`} />
        <StatCard testId="stat-active-memberships" icon={Activity} accent="blue" label="Aktivne članarine" value={aktivneClanarine} />
        <StatCard testId="stat-new-clients" icon={Users} accent="purple" label="Novi klijenti (mjesec)" value={noviKlijenti} />
      </div>

      {/* Revenue breakdown current month */}
      <SectionCard title="Razrada prihoda — ovaj mjesec" icon={BarChart3} accent="emerald" testId="revenue-breakdown">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-[#C4A574]/15 to-[#C4A574]/5 border border-[#C4A574]/20 rounded-xl p-4">
            <p className="text-[#C4A574] text-[11px] uppercase tracking-wider mb-1">Ukupno</p>
            <p className="text-white text-2xl font-bold">{monthRevenue} KM</p>
            <div className="h-1 bg-[#C4A574] rounded-full mt-3" />
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-emerald-400 text-[11px] uppercase tracking-wider mb-1">Paketi</p>
            <p className="text-white text-2xl font-bold">{monthPkg} KM</p>
            <div
              className="h-1 bg-emerald-400 rounded-full mt-3"
              style={{ width: monthRevenue > 0 ? `${(monthPkg / monthRevenue) * 100}%` : '0%' }}
            />
            <p className="text-white/40 text-[10px] mt-2">
              {monthRevenue > 0 ? Math.round((monthPkg / monthRevenue) * 100) : 0}% od ukupnog
            </p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-[11px] uppercase tracking-wider mb-1">Ručni prihod</p>
            <p className="text-white text-2xl font-bold">{monthManual} KM</p>
            <div
              className="h-1 bg-blue-400 rounded-full mt-3"
              style={{ width: monthRevenue > 0 ? `${(monthManual / monthRevenue) * 100}%` : '0%' }}
            />
            <p className="text-white/40 text-[10px] mt-2">
              {monthRevenue > 0 ? Math.round((monthManual / monthRevenue) * 100) : 0}% od ukupnog
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Monthly line chart */}
      <SectionCard title="Mjesečni prihod (12 mjeseci)" icon={TrendingUp} accent="gold" testId="monthly-chart-section">
        {monthlyData.length > 0 ? (
          <RevenueLineChart monthlyData={monthlyData} />
        ) : (
          <div className="text-white/30 text-xs text-center py-8">Nema podataka</div>
        )}
      </SectionCard>

      {/* Two columns: Doughnut + Top package */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Prihod po paketu" icon={PieChart} accent="purple" testId="package-revenue-section">
          <PackageDoughnut packageData={byPackage} />
        </SectionCard>

        <SectionCard title="Top paketi" icon={DollarSign} accent="gold" testId="top-packages-section">
          <div className="space-y-2">
            <div className="bg-[#C4A574]/10 border border-[#C4A574]/20 rounded-xl p-3 mb-3">
              <p className="text-[#C4A574] text-[10px] uppercase tracking-wider">Najprodavaniji</p>
              <p className="text-white text-lg font-bold mt-1">{najprodavaniji}</p>
            </div>
            {byPackage.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-3">Nema podataka</p>
            ) : (
              [...byPackage].sort((a, b) => b.revenue - a.revenue).map((p, i) => (
                <div key={p.naziv} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs truncate">{p.naziv}</p>
                    <p className="text-white/40 text-[10px]">{p.count} prodato</p>
                  </div>
                  <p className="text-[#C4A574] text-sm font-bold flex-shrink-0">{p.revenue} KM</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* Slots analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard testId="stat-occupancy" icon={Activity} accent="emerald" label="Prosječna popunjenost" value={`${avgOccupancy}%`} />
        <StatCard testId="stat-bookings" icon={Calendar} accent="amber" label="Ukupno rezervacija" value={totalBookings} />
        <StatCard testId="stat-top-day" icon={TrendingUp} accent="blue" label="Najpopularniji dan" value={popularDays[0]?.dan || '-'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Popularni dani" icon={Calendar} accent="emerald" testId="popular-days-section">
          <OccupancyBarChart items={popularDays} labelKey="dan" valueKey="rezervacija" color={CHART_COLORS.emerald} />
        </SectionCard>
        <SectionCard title="Popularni termini" icon={Calendar} accent="amber" testId="popular-times-section">
          <OccupancyBarChart items={popularTimes} labelKey="vrijeme" valueKey="rezervacija" color={CHART_COLORS.amber} horizontal />
        </SectionCard>
      </div>

      {/* Manual income list */}
      <SectionCard title={`Ručni prihodi (${manualIncome.length})`} icon={DollarSign} accent="blue" testId="manual-income-section">
        {manualIncome.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-3">Nema unosa</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {manualIncome.map((m) => (
              <div key={m.id} className="bg-white/5 rounded-lg p-3 flex items-center gap-3" data-testid="manual-income-item">
                <div className="w-9 h-9 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs truncate">{m.opis}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/40 text-[10px]">{formatDateBS(m.datum)}</span>
                    <span className="text-white/30 text-[10px]">•</span>
                    <span className="text-white/40 text-[10px]">{KATEGORIJE[m.kategorija] || m.kategorija}</span>
                  </div>
                </div>
                <p className="text-emerald-400 font-bold text-sm flex-shrink-0">{m.iznos} KM</p>
                <button
                  onClick={() => handleDeleteIncome(m.id)}
                  className="text-rose-400/60 hover:text-rose-400 flex-shrink-0"
                  data-testid="delete-income-btn"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

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
                {Object.entries(KATEGORIJE).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#1a1a2e]">{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Datum</label>
              <Input type="date" value={incomeForm.datum} onChange={(e) => setIncomeForm({ ...incomeForm, datum: e.target.value })} className="h-10 bg-white/10 border-white/20 text-white" />
            </div>
            <Button onClick={handleAddIncome} disabled={actionLoading} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="confirm-income-btn">Dodaj prihod</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminFinancePage;
