import React from 'react';
import { History } from 'lucide-react';
import { SectionCard } from './SectionCard';

function formatDateBS(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

function MembershipHistoryItem({ m }) {
  const isActive = m.tip === 'aktivna';
  const isFrozen = m.tip === 'zamrznuta';
  const cls = isActive
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : isFrozen
    ? 'border-blue-500/30 bg-blue-500/5'
    : 'border-white/10 bg-white/5';
  const badgeCls = isActive
    ? 'bg-emerald-500/20 text-emerald-400'
    : isFrozen
    ? 'bg-blue-500/20 text-blue-400'
    : 'bg-white/10 text-white/50';
  const total = m.ukupno_termina || m.ukupni_termini || 0;

  return (
    <div className={'rounded-xl border p-3 ' + cls} data-testid="history-membership-item">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium truncate">{m.naziv || 'Paket'}</p>
          <p className="text-white/40 text-[11px] mt-0.5">
            {formatDateBS(m.datum_pocetka)} → {formatDateBS(m.datum_isteka)}
          </p>
        </div>
        <span className={'text-[10px] px-2 py-0.5 rounded-full ' + badgeCls}>{m.tip}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
        <div>
          <p className="text-white/40 uppercase">Termini</p>
          <p className="text-white">{m.preostali_termini}/{total}</p>
        </div>
        <div>
          <p className="text-white/40 uppercase">Cijena</p>
          <p className="text-white">{m.cijena || 0} KM</p>
        </div>
        <div>
          <p className="text-white/40 uppercase">Trajanje</p>
          <p className="text-white">{m.trajanje_dana || 30} dana</p>
        </div>
      </div>
    </div>
  );
}

function RequestHistoryItem({ r }) {
  const colorMap = {
    approved: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    rejected: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
    pending: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  };
  const cls = colorMap[r.status] || 'border-white/10 bg-white/5 text-white/50';
  return (
    <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between gap-3" data-testid="history-request-item">
      <div className="min-w-0 flex-1">
        <p className="text-white text-xs truncate">{r.package_name}</p>
        <p className="text-white/40 text-[10px]">{formatDateBS(r.created_at)}</p>
      </div>
      <span className={'text-[10px] px-2 py-0.5 rounded-full border ' + cls + ' flex-shrink-0'}>{r.status}</span>
      <p className="text-white/70 text-xs flex-shrink-0">{r.package_price} KM</p>
    </div>
  );
}

export function ClientHistoryLists({ memberships, requests }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SectionCard
        title={'Historija članarina (' + memberships.length + ')'}
        icon={History}
        accent="purple"
        testId="history-memberships-section"
      >
        {memberships.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-3">Nema historije</p>
        ) : (
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {memberships.map((m, i) => (
              <MembershipHistoryItem key={m.id || m._id || i} m={m} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={'Historija zahtjeva (' + requests.length + ')'}
        icon={History}
        accent="blue"
        testId="history-requests-section"
      >
        {requests.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-3">Nema historije</p>
        ) : (
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {requests.map((r, i) => (
              <RequestHistoryItem key={r.id || i} r={r} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default ClientHistoryLists;
