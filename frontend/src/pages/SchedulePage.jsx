import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [bookedTrainingId, setBookedTrainingId] = useState(null);

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

  // Calendar helpers
  const months = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 
                  'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
  const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    
    const days = [];
    
    // Add empty slots for days before the first day of month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const isPast = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const hasSlots = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return schedule.some(s => s.datum === dateStr);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const calendarDays = getDaysInMonth(currentMonth);

  // Get slots for selected date
  const getSelectedDateSlots = () => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    return schedule.filter(s => s.datum === dateStr);
  };

  const selectedSlots = getSelectedDateSlots();
  
  // Separate morning and afternoon slots
  const morningSlots = selectedSlots.filter(s => {
    const hour = parseInt(s.vrijeme.split(':')[0]);
    return hour < 14;
  });
  
  const afternoonSlots = selectedSlots.filter(s => {
    const hour = parseInt(s.vrijeme.split(':')[0]);
    return hour >= 14;
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
        const shareUrl = `${window.location.origin}${data.share_link}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link kopiran! Podijelite ga s prijateljicom.');
      }
    } catch (error) {
      toast.error('Greška pri dijeljenju');
    }

    setShowShareDialog(false);
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const daysLong = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
    return `${daysLong[selectedDate.getDay()]}, ${selectedDate.getDate()}. ${months[selectedDate.getMonth()].toLowerCase()}`;
  };

  return (
    <div className="px-4 pt-4 pb-4" data-testid="schedule-page">
      {/* Header */}
      <div className="mb-4 animate-fade-in">
        <h1 className="font-heading text-2xl text-foreground mb-1">
          Termini
        </h1>
        <p className="text-muted-foreground text-sm">
          Odaberite datum za prikaz termina
        </p>
      </div>

      {/* Calendar */}
      <div className="card-linea mb-4 animate-slide-up delay-100">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
            data-testid="prev-month-btn"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="font-heading text-lg text-foreground">
            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
            data-testid="next-month-btn"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {days.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => (
            <button
              key={index}
              onClick={() => date && !isPast(date) && setSelectedDate(date)}
              disabled={!date || isPast(date)}
              className={`
                aspect-square flex items-center justify-center text-sm rounded-xl transition-all duration-200
                ${!date ? 'invisible' : ''}
                ${isPast(date) ? 'text-muted-foreground/40 cursor-not-allowed' : ''}
                ${isSelected(date) ? 'gradient-gold text-white font-semibold' : ''}
                ${isToday(date) && !isSelected(date) ? 'ring-2 ring-primary ring-inset font-semibold' : ''}
                ${!isPast(date) && !isSelected(date) && hasSlots(date) ? 'hover:bg-secondary cursor-pointer' : ''}
                ${!isPast(date) && !isSelected(date) ? 'text-foreground' : ''}
              `}
              data-testid={date ? `calendar-day-${date.getDate()}` : undefined}
            >
              {date?.getDate()}
            </button>
          ))}
        </div>
      </div>

      {/* Time slots for selected date */}
      {selectedDate && (
        <div className="animate-fade-in">
          <div className="text-center mb-3">
            <p className="text-sm font-medium text-primary">
              {formatSelectedDate()}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-20 bg-secondary/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : selectedSlots.length > 0 ? (
            <div className="space-y-3">
              {/* Morning slots */}
              {morningSlots.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 text-center">Prijepodne</p>
                  <div className="grid grid-cols-4 gap-2">
                    {morningSlots.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        onBook={handleBook}
                        isBooking={bookingSlot === slot.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Afternoon slots */}
              {afternoonSlots.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 text-center">Poslijepodne</p>
                  <div className="grid grid-cols-4 gap-2">
                    {afternoonSlots.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        onBook={handleBook}
                        isBooking={bookingSlot === slot.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-secondary/30 rounded-2xl">
              <p className="text-muted-foreground text-sm">
                Nema dostupnih termina
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hint when no date selected */}
      {!selectedDate && (
        <div className="text-center py-8 bg-secondary/30 rounded-2xl animate-slide-up delay-200">
          <p className="text-muted-foreground text-sm">
            Kliknite na datum za prikaz termina
          </p>
        </div>
      )}

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

// Compact Slot Card Component
const SlotCard = ({ slot, onBook, isBooking }) => {
  const isFull = slot.slobodna_mjesta === 0;
  
  return (
    <div 
      className={`
        rounded-xl p-2 flex flex-col items-center justify-between
        ${isFull ? 'bg-muted/50' : 'bg-white border border-border'}
      `}
      data-testid="schedule-slot-card"
    >
      {/* Time */}
      <p className={`text-base font-semibold ${isFull ? 'text-muted-foreground' : 'text-foreground'}`}>
        {slot.vrijeme}
      </p>
      
      {/* Available spots */}
      <p className={`text-xs ${isFull ? 'text-muted-foreground' : 'text-primary'}`}>
        {slot.slobodna_mjesta}/{slot.ukupno_mjesta}
      </p>
      
      {/* Book button */}
      <button
        onClick={() => !isFull && onBook(slot)}
        disabled={isFull || isBooking}
        className={`
          mt-1 w-full py-1.5 rounded-lg text-xs font-medium transition-all
          ${isFull 
            ? 'bg-muted text-muted-foreground cursor-not-allowed' 
            : 'gradient-gold text-white active:scale-95'
          }
        `}
        data-testid="book-slot-btn"
      >
        {isBooking ? '...' : isFull ? 'Puno' : 'Rezerviši'}
      </button>
    </div>
  );
};

export default SchedulePage;
