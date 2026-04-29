import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.color = 'rgba(255,255,255,0.6)';
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.08)';
ChartJS.defaults.font.family = 'inherit';

export const CHART_COLORS = {
  gold: '#C4A574',
  goldSoft: 'rgba(196, 165, 116, 0.25)',
  emerald: '#34d399',
  blue: '#60a5fa',
  amber: '#fbbf24',
  purple: '#a78bfa',
  rose: '#fb7185',
  cyan: '#22d3ee',
};

export const PALETTE = [
  '#C4A574',
  '#34d399',
  '#60a5fa',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#f97316',
];

export default ChartJS;
