import React from 'react';
import { CreditCard } from 'lucide-react';
import { SectionCard } from './SectionCard';

function formatDateBS(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

export function ClientMembershipDetail({ user }) {
  return (
    <SectionCard title="Detalji članarine" icon={CreditCard} accent="gold" testId="membership-detail-section">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-white/40 text-[10px] uppercase">Aktivacija</p>
          <p className="text-white text-xs mt-0.5">{formatDateBS(user.datum_aktivacije)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-white/40 text-[10px] uppercase">Ističe</p>
          <p className="text-white text-xs mt-0.5">{formatDateBS(user.datum_isteka)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-white/40 text-[10px] uppercase">Predstojeći</p>
          <p className="text-white text-xs mt-0.5">{user['predstojeći_treninzi']} termina</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-white/40 text-[10px] uppercase">Status</p>
          <p className="text-white text-xs mt-0.5">{user.membership_status}</p>
        </div>
      </div>

      {user.notes && (
        <div className="mt-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <p className="text-amber-400/70 text-[10px] uppercase mb-1">Bilješka</p>
          <p className="text-white/80 text-xs whitespace-pre-wrap">{user.notes}</p>
        </div>
      )}

      {user.freeze_start && (
        <div className="mt-3 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
          <p className="text-blue-400 text-xs">
            Zamrznuto: {user.freeze_start} → {user.freeze_end}
          </p>
          {user.freeze_reason && <p className="text-white/50 text-[10px] mt-1">{user.freeze_reason}</p>}
        </div>
      )}

      {user.pending_request && (
        <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs">
          <p className="text-amber-400">
            Zahtjev na čekanju: {user.pending_request.package_name} ({user.pending_request.package_price} KM)
          </p>
        </div>
      )}
    </SectionCard>
  );
}

export default ClientMembershipDetail;
