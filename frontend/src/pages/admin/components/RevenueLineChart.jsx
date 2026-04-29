import React from 'react';
import { Line } from 'react-chartjs-2';
import { CHART_COLORS } from './chartConfig';

const MONTH_NAMES_BS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

function formatMonth(m) {
  if (!m) return '';
  const parts = m.split('-');
  if (parts.length < 2) return m;
  const idx = parseInt(parts[1], 10) - 1;
  return MONTH_NAMES_BS[idx] || m;
}

export function RevenueLineChart({ monthlyData }) {
  const labels = monthlyData.map((m) => formatMonth(m.month));
  const totals = monthlyData.map((m) => m.revenue || 0);
  const pkg = monthlyData.map((m) => m.pkg_revenue || 0);
  const manual = monthlyData.map((m) => m.manual_revenue || 0);

  const data = {
    labels,
    datasets: [
      {
        label: 'Ukupan prihod',
        data: totals,
        borderColor: CHART_COLORS.gold,
        backgroundColor: CHART_COLORS.goldSoft,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: CHART_COLORS.gold,
        pointBorderColor: '#1a1a2e',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Paketi',
        data: pkg,
        borderColor: CHART_COLORS.emerald,
        backgroundColor: 'transparent',
        tension: 0.35,
        borderDash: [5, 4],
        pointRadius: 0,
      },
      {
        label: 'Ručno',
        data: manual,
        borderColor: CHART_COLORS.blue,
        backgroundColor: 'transparent',
        tension: 0.35,
        borderDash: [5, 4],
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { color: 'rgba(255,255,255,0.7)', boxWidth: 12, padding: 14, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: '#1a1a2e',
        borderColor: 'rgba(196,165,116,0.4)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.8)',
        padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} KM`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } } },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, callback: (v) => v + ' KM' },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="h-64 md:h-72" data-testid="revenue-line-chart">
      <Line data={data} options={options} />
    </div>
  );
}

export default RevenueLineChart;
