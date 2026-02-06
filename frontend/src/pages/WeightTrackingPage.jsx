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
    return `${days[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}.`;
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

  // Simple chart data
  const chartData = entries.slice(0, 14).reverse();
  const maxWeight = chartData.length > 0 ? Math.max(...chartData.map(e => e.weight)) : 100;
  const minWeight = chartData.length > 0 ? Math.min(...chartData.map(e => e.weight)) : 0;
  const range = maxWeight - minWeight || 1;

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

        {/* Simple Chart */}
        {chartData.length > 1 && (
          <div className="card-linea mb-6 animate-slide-up delay-200">
            <h2 className="font-heading text-lg text-foreground mb-4">
              Napredak
            </h2>
            <div className="h-40 flex items-end gap-1">
              {chartData.map((entry, index) => {
                const height = ((entry.weight - minWeight) / range) * 100;
                return (
                  <div
                    key={entry.id || index}
                    className="flex-1 flex flex-col items-center justify-end"
                  >
                    <div 
                      className="w-full gradient-gold rounded-t-lg min-h-[4px] transition-all duration-500"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    {index % 3 === 0 && (
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {entry.date?.slice(5, 10)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{minWeight.toFixed(1)} kg</span>
              <span>{maxWeight.toFixed(1)} kg</span>
            </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeightTrackingPage;
