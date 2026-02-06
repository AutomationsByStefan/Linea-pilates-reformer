import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, User, Users, Share2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SchedulePage = () => {
  const [schedule, setSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [bookedTrainingId, setBookedTrainingId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch(`${API}/schedule`);
        if (response.ok) {
          const data = await response.json();
          setSchedule(data);
        }
      } catch (error) {
        console.error('Error fetching schedule:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, []);

  // Generate 14 days of dates for horizontal scroll
  const getWeekDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const formatDay = (date) => {
    const days = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
    return days[date.getDay()];
  };

  const formatMonth = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    return months[date.getMonth()];
  };

  const formatDateNum = (date) => {
    return date.getDate();
  };

  const isSameDay = (date1, date2) => {
    return date1.toDateString() === date2.toDateString();
  };

  const filteredSchedule = schedule.filter(slot => {
    const slotDate = new Date(slot.datum);
    return isSameDay(slotDate, selectedDate);
  });

  const handleBook = async (slot) => {
    setBookingSlot(slot.id);
    try {
      const response = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slot_id: slot.id,
          datum: slot.datum,
          vrijeme: slot.vrijeme,
          instruktor: slot.instruktor
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Termin je uspješno rezervisan! 💪');
        setBookedTrainingId(data.training_id);
        setShowShareDialog(true);
        
        // Update schedule to reflect booking
        setSchedule(prev => prev.map(s => 
          s.id === slot.id 
            ? { ...s, slobodna_mjesta: Math.max(0, s.slobodna_mjesta - 1) }
            : s
        ));
      } else {
        toast.error(data.detail || 'Greška pri rezervaciji');
      }
    } catch (error) {
      toast.error('Greška pri rezervaciji');
    } finally {
      setBookingSlot(null);
    }
  };

  const handleShare = async (method) => {
    if (!bookedTrainingId) return;

    try {
      const response = await fetch(`${API}/trainings/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          training_id: bookedTrainingId,
          generate_link: method === 'link'
        })
      });

      const data = await response.json();

      if (response.ok && method === 'link') {
        // Copy share link to clipboard
        const shareUrl = `${window.location.origin}${data.share_link}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link kopiran! Podijelite ga s prijateljicom.');
      }
    } catch (error) {
      toast.error('Greška pri dijeljenju');
    }

    setShowShareDialog(false);
  };

  return (
    <div className="px-6 pt-6 pb-4" data-testid="schedule-page">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="font-heading text-2xl text-foreground mb-2">
          Termini
        </h1>
        <p className="text-muted-foreground">
          Odaberite datum i rezervišite trening
        </p>
      </div>

      {/* Horizontal Scrollable Calendar Strip */}
      <div className="mb-6 animate-slide-up delay-100">
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-6 px-6"
        >
          {weekDates.map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            
            return (
              <button
                key={index}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center min-w-[4.5rem] h-24 rounded-2xl transition-all duration-200 flex-shrink-0 ${
                  isSelected 
                    ? 'gradient-gold text-white shadow-soft' 
                    : 'bg-white border border-border hover:border-primary/30'
                }`}
                data-testid={`date-selector-${index}`}
              >
                <span className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                  {formatDay(date)}
                </span>
                <span className={`text-2xl font-semibold mt-1 ${isSelected ? 'text-white' : 'text-foreground'}`}>
                  {formatDateNum(date)}
                </span>
                <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {formatMonth(date)}
                </span>
                {isToday && !isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Header */}
      <div className="flex items-center gap-2 mb-4 animate-slide-up delay-200">
        <Calendar className="w-5 h-5 text-primary" />
        <span className="font-medium text-foreground">
          {(() => {
            const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
            const months = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
            return `${days[selectedDate.getDay()]}, ${selectedDate.getDate()}. ${months[selectedDate.getMonth()]}`;
          })()}
        </span>
      </div>

      {/* Schedule List */}
      <div className="space-y-3 animate-slide-up delay-300">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-linea animate-pulse h-24" />
            ))}
          </>
        ) : filteredSchedule.length > 0 ? (
          filteredSchedule.map((slot) => (
            <div
              key={slot.id}
              className="card-linea"
              data-testid="schedule-slot-card"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex flex-col items-center justify-center">
                    <Clock className="w-5 h-5 text-primary mb-0.5" />
                    <span className="text-xs font-semibold text-foreground">{slot.vrijeme}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      Reformer Pilates
                    </p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {slot.instruktor}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {slot.slobodna_mjesta}/{slot.ukupno_mjesta}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handleBook(slot)}
                  disabled={slot.slobodna_mjesta === 0 || bookingSlot === slot.id}
                  className={`h-10 px-4 rounded-full text-sm font-medium ${
                    slot.slobodna_mjesta > 0 
                      ? 'btn-primary' 
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                  data-testid="book-slot-btn"
                >
                  {bookingSlot === slot.id ? '...' : slot.slobodna_mjesta > 0 ? 'Rezerviši' : 'Popunjeno'}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="card-linea text-center py-12" data-testid="no-schedule">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nema dostupnih termina za ovaj datum
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-secondary/50 rounded-2xl animate-slide-up delay-400">
        <p className="text-sm text-muted-foreground text-center">
          Trajanje treninga: <span className="text-foreground font-medium">50 minuta</span>
        </p>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-[90%] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">
              Termin rezervisan! 🎉
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-center text-muted-foreground">
              Želite li podijeliti ovaj termin s prijateljicom?
            </p>
            <Button
              onClick={() => handleShare('link')}
              className="w-full h-12 rounded-full btn-primary"
              data-testid="share-link-btn"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Podijeli termin s prijateljicom
            </Button>
            <Button
              onClick={() => setShowShareDialog(false)}
              variant="ghost"
              className="w-full h-10"
            >
              Preskoči
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulePage;
