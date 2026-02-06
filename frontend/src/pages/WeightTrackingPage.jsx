import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WeightTrackingPage = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const response = await fetch(`${API}/weight`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error fetching weight entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight < 20 || weight > 300) {
      toast.error('Unesite validnu težinu (20-300 kg)');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`${API}/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weight })
      });

      if (response.ok) {
        toast.success('Težina je zabilježena');
        setNewWeight('');
        fetchEntries();
      } else {
        toast.error('Greška pri spremanju');
      }
    } catch (error) {
      toast.error('Greška pri spremanju');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (entryId) => {
    try {
      const response = await fetch(`${API}/weight/${entryId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Unos je obrisan');
        setEntries(prev => prev.filter(e => e.id !== entryId));
      }
    } catch (error) {
      toast.error('Greška pri brisanju');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
    return `${days[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}.`;
  };

  const formatShortDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getDate()}.${date.getMonth() + 1}`;
  };

  // Calculate trend
  const calculateTrend = (index) => {
    if (index >= entries.length - 1) return null;
    const current = entries[index].weight;
    const previous = entries[index + 1].weight;
    const diff = current - previous;
    if (Math.abs(diff) < 0.1) return { type: 'same', diff: 0 };
    return { type: diff > 0 ? 'up' : 'down', diff: Math.abs(diff).toFixed(1) };
  };

  // Chart data (last 10 entries, reversed for chronological order)
  const chartData = entries.slice(0, 10).reverse();
  const maxWeight = chartData.length > 0 ? Math.max(...chartData.map(e => e.weight)) : 100;
  const minWeight = chartData.length > 0 ? Math.min(...chartData.map(e => e.weight)) : 0;
  const range = (maxWeight - minWeight) || 5; // Default range if all same value
  const padding = range * 0.1; // Add 10% padding

  return (
    <div className="min-h-screen bg-background" data-testid="weight-tracking-page">
      {/* Header */}
      <header className="sticky top-0 bg-background/90 backdrop-blur-lg border-b border-border/40 px-6 py-4 z-10">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
            data-testid="weight-back-btn"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="font-heading text-xl text-foreground ml-3">
            Praćenje težine
          </h1>
        </div>
      </header>

      <div className="px-6 py-6">
        {/* Info Card */}
        <div className="card-linea mb-6 animate-fade-in">
          <p className="text-sm text-muted-foreground text-center">
            Ova funkcija je opcionalna. Pratite svoj napredak ako želite.
          </p>
        </div>

        {/* Add Entry */}
        <div className="card-linea mb-6 animate-slide-up delay-100">
          <h2 className="font-heading text-lg text-foreground mb-4">
            Dodaj unos
          </h2>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                type="number"
                step="0.1"
                placeholder="Težina"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="input-linea h-12 pr-12"
                data-testid="weight-input"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                kg
              </span>
            </div>
            <Button
              onClick={handleAddEntry}
              disabled={adding || !newWeight}
              className="btn-primary h-12 px-6"
              data-testid="add-weight-btn"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Line Chart */}
        {chartData.length > 1 && (
          <div className="card-linea mb-6 animate-slide-up delay-200">
            <h2 className="font-heading text-lg text-foreground mb-4">
              Napredak
            </h2>
            
            {/* SVG Line Chart */}
            <div className="relative h-48">
              <svg className="w-full h-full" viewBox="0 0 400 180" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line
                    key={y}
                    x1="40"
                    y1={20 + y * 1.4}
                    x2="390"
                    y2={20 + y * 1.4}
                    stroke="#E5D3B3"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                    opacity="0.5"
                  />
                ))}
                
                {/* Line path */}
                <polyline
                  fill="none"
                  stroke="#B8860B"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartData.map((entry, index) => {
                    const x = 50 + (index * (340 / Math.max(chartData.length - 1, 1)));
                    const normalizedY = ((entry.weight - (minWeight - padding)) / (range + 2 * padding));
                    const y = 160 - (normalizedY * 140);
                    return `${x},${y}`;
                  }).join(' ')}
                />
                
                {/* Data points */}
                {chartData.map((entry, index) => {
                  const x = 50 + (index * (340 / Math.max(chartData.length - 1, 1)));
                  const normalizedY = ((entry.weight - (minWeight - padding)) / (range + 2 * padding));
                  const y = 160 - (normalizedY * 140);
                  
                  return (
                    <g key={entry.id || index}>
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill="#B8860B"
                        stroke="white"
                        strokeWidth="2"
                      />
                      {/* Weight label on hover area */}
                      <text
                        x={x}
                        y={y - 12}
                        textAnchor="middle"
                        fill="#666"
                        fontSize="10"
                        fontWeight="500"
                      >
                        {entry.weight.toFixed(1)}
                      </text>
                    </g>
                  );
                })}
              </svg>
              
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-8">
                {chartData.filter((_, i) => i === 0 || i === chartData.length - 1 || chartData.length <= 5).map((entry, index) => (
                  <span key={entry.id || index} className="text-[10px] text-muted-foreground">
                    {formatShortDate(entry.date)}
                  </span>
                ))}
              </div>
            </div>

            {/* Min/Max labels */}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Min: {minWeight.toFixed(1)} kg</span>
              <span>Max: {maxWeight.toFixed(1)} kg</span>
            </div>

            {/* Trend summary */}
            {chartData.length >= 2 && (
              <div className="mt-4 p-3 bg-secondary/50 rounded-xl text-center">
                {(() => {
                  const firstWeight = chartData[0].weight;
                  const lastWeight = chartData[chartData.length - 1].weight;
                  const diff = lastWeight - firstWeight;
                  const isGain = diff > 0;
                  const isLoss = diff < 0;
                  
                  return (
                    <p className="text-sm">
                      {isLoss ? (
                        <span className="text-green-600 flex items-center justify-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          Smanjenje od {Math.abs(diff).toFixed(1)} kg
                        </span>
                      ) : isGain ? (
                        <span className="text-orange-500 flex items-center justify-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          Povećanje od {Math.abs(diff).toFixed(1)} kg
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex items-center justify-center gap-1">
                          <Minus className="w-4 h-4" />
                          Bez promjene
                        </span>
                      )}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="animate-slide-up delay-300">
          <h2 className="font-heading text-lg text-foreground mb-4">
            Historija
          </h2>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card-linea animate-pulse h-16" />
              ))}
            </div>
          ) : entries.length > 0 ? (
            <div className="space-y-3">
              {entries.slice(0, 20).map((entry, index) => {
                const trend = calculateTrend(index);
                return (
                  <div
                    key={entry.id}
                    className="card-linea flex items-center justify-between"
                    data-testid="weight-entry"
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(entry.date)}
                      </p>
                      <p className="text-xl font-heading text-foreground">
                        {entry.weight.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {trend && (
                        <div className={`flex items-center gap-1 text-sm ${
                          trend.type === 'down' ? 'text-green-600' : 
                          trend.type === 'up' ? 'text-orange-500' : 
                          'text-muted-foreground'
                        }`}>
                          {trend.type === 'down' && <TrendingDown className="w-4 h-4" />}
                          {trend.type === 'up' && <TrendingUp className="w-4 h-4" />}
                          {trend.type === 'same' && <Minus className="w-4 h-4" />}
                          {trend.diff > 0 && <span>{trend.diff}</span>}
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 hover:bg-destructive/10 rounded-full transition-colors"
                        data-testid="delete-weight-btn"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-linea text-center py-8">
              <p className="text-muted-foreground">Nema unosa</p>
              <p className="text-sm text-muted-foreground mt-2">
                Dodajte prvi unos iznad
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeightTrackingPage;
