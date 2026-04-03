import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

export function FreezeDialog({ open, user, freezeStart, freezeEnd, setFreezeStart, setFreezeEnd, onClose, onConfirm, loading }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
        <DialogHeader><DialogTitle>Zamrzni clanarinu</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-white/50 text-sm">Zamrzavanje za: {user ? user.name : ''}</p>
          <div>
            <label className="text-white/60 text-sm mb-1 block">Od datuma</label>
            <Input type="date" value={freezeStart} onChange={function(e) { setFreezeStart(e.target.value); }}
              className="h-10 bg-white/10 border-white/20 text-white" />
          </div>
          <div>
            <label className="text-white/60 text-sm mb-1 block">Do datuma</label>
            <Input type="date" value={freezeEnd} onChange={function(e) { setFreezeEnd(e.target.value); }}
              className="h-10 bg-white/10 border-white/20 text-white" />
          </div>
          <Button onClick={onConfirm} disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Zamrzavanje...' : 'Potvrdi zamrzavanje'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NotesDialog({ open, user, noteText, setNoteText, onClose, onSave, loading }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
        <DialogHeader><DialogTitle>Biljeska za {user ? user.name : ''}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <textarea value={noteText} onChange={function(e) { setNoteText(e.target.value); }} rows={4}
            className="w-full rounded-md bg-white/10 border border-white/20 text-white p-3 text-sm resize-none"
            placeholder="Upisite biljesku..." data-testid="notes-textarea" />
          <Button onClick={onSave} disabled={loading} className="w-full h-11 bg-[#C4A574] hover:bg-[#A68B5B] text-white">
            {loading ? 'Cuvanje...' : 'Sacuvaj biljesku'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PackageOption({ pkg }) {
  return <option value={pkg.id} className="bg-[#1a1a2e]">{pkg.naziv} - {pkg.cijena} KM ({pkg.termini} termina)</option>;
}

export function CustomMembershipDialog({ open, user, selectedPkg, setSelectedPkg, packages, customForm, setCustomForm, onClose, onConfirm, loading }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
        <DialogHeader><DialogTitle>Dodaj clanarinu za {user ? user.name : ''}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-white/60 text-sm mb-1 block">Odaberi postojeci paket</label>
            <select value={selectedPkg} onChange={function(e) { setSelectedPkg(e.target.value); }}
              className="w-full h-10 rounded-md bg-white/10 border border-white/20 text-white px-3 text-sm" data-testid="select-package-dropdown">
              <option value="" className="bg-[#1a1a2e]">-- Custom (rucno) --</option>
              {packages.map(function(p) { return <PackageOption key={p.id} pkg={p} />; })}
            </select>
          </div>

          {!selectedPkg && (
            <div className="space-y-3">
              <div>
                <label className="text-white/60 text-sm mb-1 block">Naziv</label>
                <Input value={customForm.naziv}
                  onChange={function(e) { setCustomForm(Object.assign({}, customForm, { naziv: e.target.value })); }}
                  placeholder="Npr. Custom paket" className="h-10 bg-white/10 border-white/20 text-white" data-testid="custom-pkg-name" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Cijena (KM)</label>
                  <Input type="number" value={customForm.cijena}
                    onChange={function(e) { setCustomForm(Object.assign({}, customForm, { cijena: e.target.value })); }}
                    placeholder="100" className="h-10 bg-white/10 border-white/20 text-white" data-testid="custom-pkg-price" />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Termini</label>
                  <Input type="number" value={customForm.termini}
                    onChange={function(e) { setCustomForm(Object.assign({}, customForm, { termini: e.target.value })); }}
                    placeholder="8" className="h-10 bg-white/10 border-white/20 text-white" data-testid="custom-pkg-sessions" />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Trajanje (dana)</label>
                  <Input type="number" value={customForm.trajanje_dana}
                    onChange={function(e) { setCustomForm(Object.assign({}, customForm, { trajanje_dana: e.target.value })); }}
                    placeholder="30" className="h-10 bg-white/10 border-white/20 text-white" />
                </div>
              </div>
            </div>
          )}

          <Button onClick={onConfirm} disabled={loading}
            className="w-full h-11 bg-[#C4A574] hover:bg-[#A68B5B] text-white" data-testid="confirm-custom-membership-btn">
            {loading ? 'Kreiranje...' : 'Kreiraj clanarinu'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MembershipHistoryItem({ item }) {
  var tipClass = 'bg-gray-500/20 text-gray-400';
  if (item.tip === 'aktivna') tipClass = 'bg-green-500/20 text-green-400';
  if (item.tip === 'zamrznuta') tipClass = 'bg-blue-500/20 text-blue-400';
  if (item.tip === 'istekla') tipClass = 'bg-red-500/20 text-red-400';
  return (
    <div className="bg-white/5 rounded-lg p-3" data-testid="history-membership-item">
      <div className="flex items-center justify-between mb-1">
        <span className="text-white text-sm font-medium">{item.naziv}</span>
        <span className={'text-[10px] px-2 py-0.5 rounded-full ' + tipClass}>{item.tip}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[10px] text-white/50">
        <span>Termini: {item.preostali_termini}/{item.ukupni_termini}</span>
        <span>Cijena: {item.cijena || '-'} KM</span>
        <span>Pocetak: {formatDate(item.datum_pocetka)}</span>
        <span>Istice: {formatDate(item.datum_isteka)}</span>
      </div>
    </div>
  );
}

function RequestHistoryItem({ item }) {
  var statusClass = 'bg-amber-500/20 text-amber-400';
  if (item.status === 'approved') statusClass = 'bg-green-500/20 text-green-400';
  if (item.status === 'rejected') statusClass = 'bg-red-500/20 text-red-400';
  var statusText = item.status === 'approved' ? 'Odobreno' : item.status === 'rejected' ? 'Odbijeno' : 'Na cekanju';
  return (
    <div className="bg-white/5 rounded-lg p-2 text-xs" data-testid="history-request-item">
      <div className="flex items-center justify-between">
        <span className="text-white">{item.package_name} - {item.package_price} KM</span>
        <span className={'text-[10px] px-2 py-0.5 rounded-full ' + statusClass}>{statusText}</span>
      </div>
      <div className="text-white/40 text-[10px] mt-1">
        {formatDate(item.created_at)}{item.approved_by ? ' | Odobrio: ' + item.approved_by : ''}
      </div>
    </div>
  );
}

function HistoryContent({ data }) {
  if (!data) {
    return <div className="text-center py-8 text-white/40 animate-pulse">Ucitavanje...</div>;
  }
  var memberships = data.memberships || [];
  var requests = data.requests || [];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Clanarine ({memberships.length})</h3>
        {memberships.length === 0 ? (
          <p className="text-white/30 text-xs">Nema historije</p>
        ) : (
          <div className="space-y-2">
            {memberships.map(function(m) { return <MembershipHistoryItem key={m.id} item={m} />; })}
          </div>
        )}
      </div>
      {requests.length > 0 && (
        <div>
          <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Zahtjevi ({requests.length})</h3>
          <div className="space-y-2">
            {requests.map(function(r) { return <RequestHistoryItem key={r.id} item={r} />; })}
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryDialog({ open, user, historyData, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Historija - {user ? user.name : ''}</DialogTitle></DialogHeader>
        <div className="py-4">
          <HistoryContent data={historyData} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
