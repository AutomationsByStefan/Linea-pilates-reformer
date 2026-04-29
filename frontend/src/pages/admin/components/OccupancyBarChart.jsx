import React from 'react';
import { Bar } from 'react-chartjs-2';
import { CHART_COLORS } from './chartConfig';

export function OccupancyBarChart({ items, labelKey, valueKey, color = CHART_COLORS.gold, horizontal = false }) {
  const labels = items.map((it) => it[labelKey]);
  const values = items.map((it) => it[valueKey]);

  const data = {
    labels,
    datasets: [
      {
        label: 'Rezervacije',
        data: values,
        backgroundColor: color,
        borderRadius: 6,
        borderSkipped: false,
        barThickness: horizontal ? 14 : 22,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a2e',
        borderColor: 'rgba(196,165,116,0.4)',
        borderWidth: 1,
        padding: 10,
        callbacks: { label: (ctx) => `${ctx.parsed[horizontal ? 'x' : 'y']} rezervacija` },
      },
    },
    scales: {
      x: {
        grid: { display: !horizontal, color: 'rgba(255,255,255,0.05)' },
        ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } },
        beginAtZero: true,
      },
      y: {
        grid: { display: horizontal, color: 'rgba(255,255,255,0.05)' },
        ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } },
        beginAtZero: true,
      },
    },
  };

  if (!items.length) {
    return <div className="text-white/30 text-xs text-center py-8">Nema podataka</div>;
  }

  return (
    <div className="h-56 md:h-64" data-testid="occupancy-bar-chart">
      <Bar data={data} options={options} />
    </div>
  );
}

export default OccupancyBarChart;
