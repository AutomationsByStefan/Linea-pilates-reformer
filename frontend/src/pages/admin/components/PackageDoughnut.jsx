import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { PALETTE } from './chartConfig';

export function PackageDoughnut({ packageData }) {
  const labels = packageData.map((p) => p.naziv);
  const values = packageData.map((p) => p.revenue || 0);
  const counts = packageData.map((p) => p.count || 0);
  const colors = packageData.map((_, i) => PALETTE[i % PALETTE.length]);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: '#0f0f1a',
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          color: 'rgba(255,255,255,0.7)',
          boxWidth: 10,
          padding: 10,
          font: { size: 11 },
          generateLabels: (chart) => {
            const ds = chart.data.datasets[0];
            return chart.data.labels.map((l, i) => ({
              text: `${l} (${counts[i]}x)`,
              fillStyle: ds.backgroundColor[i],
              strokeStyle: ds.backgroundColor[i],
              lineWidth: 0,
              index: i,
            }));
          },
        },
      },
      tooltip: {
        backgroundColor: '#1a1a2e',
        borderColor: 'rgba(196,165,116,0.4)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed} KM (${counts[ctx.dataIndex]}x)`,
        },
      },
    },
  };

  if (!packageData.length) {
    return <div className="text-white/30 text-xs text-center py-8">Nema podataka</div>;
  }

  return (
    <div className="h-64 md:h-72" data-testid="package-doughnut-chart">
      <Doughnut data={data} options={options} />
    </div>
  );
}

export default PackageDoughnut;
