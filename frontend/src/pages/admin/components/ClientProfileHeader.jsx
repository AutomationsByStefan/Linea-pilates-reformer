import React from 'react';
import { Phone, Mail, Calendar } from 'lucide-react';

function formatDateBS(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('bs-BA');
}

const STATUS_LABEL = {
  active: { label: 'Aktivan', cls: 'bg-emerald-500/20 text-emerald-400' },
  pending: { label: 'Na čekanju', cls: 'bg-amber-500/20 text-amber-400' },
  frozen: { label: 'Zamrznut', cls: 'bg-blue-500/20 text-blue-400' },
  expired: { label: 'Istekao', cls: 'bg-rose-500/20 text-rose-400' },
  archived: { label: 'Arhiviran', cls: 'bg-white/10 text-white/40' },
};

export function ClientProfileHeader({ user }) {
  const status = STATUS_LABEL[user.korisnik_status] || STATUS_LABEL.pending;
  const initial = (user.name || '?').charAt(0).toUpperCase();

  return (
    <div className="bg-gradient-to-br from-[#C4A574]/15 via-white/[0.03] to-transparent border border-white/10 rounded-2xl p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[#C4A574]/20 border border-[#C4A574]/30 flex items-center justify-center text-2xl md:text-3xl font-bold text-[#C4A574] flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl md:text-2xl font-bold text-white truncate">{user.name || 'Bez imena'}</h1>
            <span className={'text-[10px] px-2 py-0.5 rounded-full ' + status.cls}>{status.label}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-white/60">
            {user.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {user.phone}
              </span>
            )}
            {user.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> {user.email}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Reg. {formatDateBS(user.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClientProfileHeader;
