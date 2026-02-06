import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EMOJIS = ['😔', '😐', '🙂', '😊', '🤩'];
const LABELS = {
  fizicko_stanje: 'Fizičko stanje',
  kvalitet_treninga: 'Kvalitet treninga',
  osjecaj_napretka: 'Osjećaj napretka'
};

const FeedbackModal = ({ training, onClose, onSuccess }) => {
  const [ratings, setRatings] = useState({
    fizicko_stanje: 0,
    kvalitet_treninga: 0,
    osjecaj_napretka: 0
  });
  const [submitting, setSubmitting] = useState(false);

  const handleRating = (category, value) => {
    setRatings(prev => ({ ...prev, [category]: value }));
  };

  const handleSubmit = async () => {
    if (Object.values(ratings).some(r => r === 0)) {
      toast.error('Molimo ocijenite sve kategorije');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          training_id: training.id,
          ...ratings
        })
      });

      if (response.ok) {
        toast.success('Hvala na povratnoj informaciji! 💪');
        onSuccess?.();
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Greška pri slanju');
      }
    } catch (error) {
      toast.error('Greška pri slanju');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
    const months = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
    return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="feedback-modal">
      <div className="bg-background rounded-3xl w-full max-w-md p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl text-foreground">
            Kako ti je prijao trening?
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Training info */}
        <div className="bg-secondary/50 rounded-2xl p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            {formatDate(training.datum)} u {training.vrijeme}
          </p>
          <p className="text-foreground font-medium">
            {training.instruktor}
          </p>
        </div>

        {/* Rating categories */}
        <div className="space-y-6 mb-8">
          {Object.entries(LABELS).map(([key, label]) => (
            <div key={key}>
              <p className="text-sm font-medium text-foreground mb-3">
                {label}
              </p>
              <div className="flex justify-between gap-2">
                {EMOJIS.map((emoji, index) => {
                  const value = index + 1;
                  const isSelected = ratings[key] === value;
                  return (
                    <button
                      key={value}
                      onClick={() => handleRating(key, value)}
                      className={`w-12 h-12 rounded-full text-2xl transition-all duration-200 ${
                        isSelected 
                          ? 'bg-primary/20 scale-110 ring-2 ring-primary' 
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                      data-testid={`feedback-${key}-${value}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary w-full h-12"
          data-testid="submit-feedback-btn"
        >
          {submitting ? 'Slanje...' : 'Pošalji'}
        </Button>
      </div>
    </div>
  );
};

export default FeedbackModal;
