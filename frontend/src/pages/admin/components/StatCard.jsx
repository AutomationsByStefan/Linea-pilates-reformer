import React from 'react';

export function StatCard({ icon: Icon, value, label, accent, testId }) {
  const accentMap = {
    gold: 'from-[#C4A574]/20 to-[#C4A574]/5 text-[#C4A574] border-[#C4A574]/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/20',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20',
  };
  const cls = accentMap[accent] || accentMap.gold;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${cls} p-4 md:p-5 transition-transform hover:-translate-y-0.5`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white/60 text-[11px] uppercase tracking-wider mb-2 truncate">{label}</p>
          <p className="text-white text-2xl md:text-3xl font-bold leading-none">{value}</p>
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
