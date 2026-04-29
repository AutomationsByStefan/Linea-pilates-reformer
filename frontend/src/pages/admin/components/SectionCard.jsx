import React from 'react';

export function SectionCard({ title, icon: Icon, accent = 'gold', actions, children, testId }) {
  const accentMap = {
    gold: 'text-[#C4A574]',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    rose: 'text-rose-400',
  };
  const iconCls = accentMap[accent] || accentMap.gold;

  return (
    <section
      className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 md:p-6 backdrop-blur-sm"
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-white font-semibold text-sm md:text-base flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${iconCls}`} />}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default SectionCard;
