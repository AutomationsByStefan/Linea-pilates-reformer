import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Share2, RefreshCw } from 'lucide-react';
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

// Timezone-safe date formatting (avoids UTC shift from toISOString)
const toDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const SchedulePage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [bookedTrainingId, setBookedTrainingId] = useState(null);
  const [confirmSlot, setConfirmSlot] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleTraining, setRescheduleTraining] = useState(null);

  useEffect(() => {
    fetchSchedule();
    fetchMyBookings();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch(`${API}/schedule`);
      if (response.ok) setSchedule(await response.json());
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await fetch(`${API}/trainings/upcoming`, { credentials: 'include' });
      if (response.ok) setMyBookings(await response.json());
    } catch {}
  };

  // Calendar helpers
  const months = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
                  'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
  const dayNames = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
  const dayNamesLong = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const result = [];
    for (let i = 0; i < startDay; i++) result.push(null);
    for (let i = 1; i <= daysInMonth; i++) result.push(new Date(year, month, i));
    return result;
  };

  const isToday = (date) => date && date.toDateString() === new Date().toDateString();
  const isSelected = (date) => date && selectedDate && date.toDateString() === selectedDate.toDateString();

  const isPast = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today; // Today is NOT past
  };

  const hasSlots = (date) => {
    if (!date) return false;
    const dateStr = toDateStr(date);
    return schedule.some(s => s.datum === dateStr);
  };

  const prevMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); setSelectedDate(null); };
  const nextMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); setSelectedDate(null); };

  const calendarDays = getDaysInMonth(currentMonth);

  // Get slots for selected date, filter past times if today
  const getSelectedDateSlots = () => {
    if (!selectedDate) return [];
    const dateStr = toDateStr(selectedDate);
    let slots = schedule.filter(s => s.datum === dateStr);
    // If today, filter out past time slots
    if (isToday(selectedDate)) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      slots = slots.filter(s => {
        const parts = s.vrijeme.split(':');
        const slotHour = parseInt(parts[0]);
        const slotMin = parseInt(parts[1] || '0');
        return slotHour > currentHour || (slotHour === currentHour && slotMin > currentMin);
      });
    }
    return slots;
  };

  const selectedSlots = getSelectedDateSlots();
  const morningSlots = selectedSlots.filter(s => parseInt(s.vrijeme.split(':')[0]) < 14);
  const afternoonSlots = selectedSlots.filter(s => parseInt(s.vrijeme.split(':')[0]) >= 14);

  // Check if user has a booking for selected date
  const getBookingForDate = (dateStr) => {
    return myBookings.find(b => {
      const bDate = b.datum?.includes('T') ? b.datum.split('T')[0] : b.datum;
      return bDate === dateStr;
    });
  };

  const selectedDateStr = selectedDate ? toDateStr(selectedDate) : '';
  const existingBookingForDay = getBookingForDate(selectedDateStr);

  // Check if booking is within 30 min for reschedule
  const canReschedule = (booking) => {
    if (!booking?.created_at) return false;
    const created = new Date(booking.created_at);
    const now = new Date();
    return (now - created) / 60000 <= 30;
  };

  // Open confirmation dialog
  const handleSlotClick = (slot) => {
    if (existingBookingForDay && !rescheduleTraining) {
      if (canReschedule(existingBookingForDay)) {
        toast.error('Već imate termin za ovaj dan. Koristite opciju "Promijeni termin".');
      } else {
        toast.error('Već imate zakazan termin za ovaj dan.');
      }
      return;
    }
    setConfirmSlot(slot);
  };

  const handleConfirmBooking = async () => {
    if (!confirmSlot) return;

    // If this is a reschedule
    if (rescheduleTraining) {
      setBookingSlot(confirmSlot.id);
      try {
        const response = await fetch(`${API}/bookings/${rescheduleTraining.id}/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            new_slot_id: confirmSlot.id,
            new_datum: confirmSlot.datum,
            new_vrijeme: confirmSlot.vrijeme,
            new_instruktor: confirmSlot.instruktor
          })
        });
        const data = await response.json();
        if (response.ok) {
          toast.success('Termin je uspješno promijenjen!');
          setRescheduleTraining(null);
          setShowRescheduleDialog(false);
          fetchSchedule();
          fetchMyBookings();
        } else {
          toast.error(data.detail || 'Greška pri promjeni termina');
        }
      } catch {
        toast.error('Greška pri promjeni termina');
      } finally {
        setBookingSlot(null);
        setConfirmSlot(null);
      }
      return;
    }

    // Normal booking
    setBookingSlot(confirmSlot.id);
    try {
      const response = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slot_id: confirmSlot.id,
          datum: confirmSlot.datum,
          vrijeme: confirmSlot.vrijeme,
          instruktor: confirmSlot.instruktor
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Termin je uspješno rezervisan!');
        setBookedTrainingId(data.training_id);
        setShowShareDialog(true);
        setSchedule(prev => prev.map(s =>
          s.id === confirmSlot.id ? { ...s, slobodna_mjesta: Math.max(0, s.slobodna_mjesta - 1) } : s
        ));
        fetchMyBookings();
      } else {
        toast.error(data.detail || 'Greška pri rezervaciji');
      }
    } catch {
      toast.error('Greška pri rezervaciji');
    } finally {
      setBookingSlot(null);
      setConfirmSlot(null);
    }
  };

  const handleShare = async (method) => {
    if (!bookedTrainingId) return;
    try {
      const response = await fetch(`${API}/trainings/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ training_id: bookedTrainingId, generate_link: method === 'link' })
      });
      const data = await response.json();
      if (response.ok && method === 'link') {
        const shareUrl = `${window.location.origin}${data.share_link}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link kopiran! Podijelite ga s prijateljicom.');
      }
    } catch {
      toast.error('Greška pri dijeljenju');
    }
    setShowShareDialog(false);
  };

  const handleStartReschedule = () => {
    if (!existingBookingForDay) return;
    setRescheduleTraining(existingBookingForDay);
    setShowRescheduleDialog(false);
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    return `${dayNamesLong[selectedDate.getDay()]}, ${selectedDate.getDate()}. ${months[selectedDate.getMonth()].toLowerCase()}`;
  };

  const formatConfirmDate = () => {
    if (!confirmSlot) return '';
    const d = new Date(confirmSlot.datum + 'T00:00:00');
    return `${dayNamesLong[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()].toLowerCase()}`;
  };

  return (
    <div className="px-4 pt-4 pb-4" data-testid="schedule-page">
      {/* Header */}
      <div className="mb-4 animate-fade-in">
        <h1 className="font-heading text-2xl text-foreground mb-1">Termini</h1>
        <p className="text-muted-foreground text-sm">
          {rescheduleTraining ? 'Odaberite novi termin za preraspodjelu' : 'Odaberite datum za prikaz termina'}
        </p>
      </div>

      {/* Reschedule banner */}
      {rescheduleTraining && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 mb-3 flex items-center justify-between" data-testid="reschedule-banner">
          <div>
            <p className="text-sm font-medium text-foreground">Preraspodjela termina</p>
            <p className="text-xs text-muted-foreground">Trenutni: {rescheduleTraining.datum?.split('T')[0]} u {rescheduleTraining.vrijeme}</p>
          </div>
          <Button onClick={() => setRescheduleTraining(null)} variant="ghost" className="h-8 text-xs text-muted-foreground">
            Otkaži
          </Button>
        </div>
      )}

      {/* Calendar */}
      <div className="card-linea mb-3 p-4 animate-slide-up delay-100">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1.5 hover:bg-secondary rounded-full transition-colors" data-testid="prev-month-btn">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="font-heading text-base text-foreground">
            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="p-1.5 hover:bg-secondary rounded-full transition-colors" data-testid="next-month-btn">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((date, index) => (
            <button
              key={index}
              onClick={() => date && !isPast(date) && setSelectedDate(date)}
              disabled={!date || isPast(date)}
              className={`
                aspect-square flex items-center justify-center text-xs rounded-lg transition-all duration-200
                ${!date ? 'invisible' : ''}
                ${isPast(date) ? 'text-muted-foreground/40 cursor-not-allowed' : ''}
                ${isSelected(date) ? 'gradient-gold text-white font-semibold' : ''}
                ${isToday(date) && !isSelected(date) ? 'ring-1.5 ring-primary ring-inset font-semibold' : ''}
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

      {/* Existing booking info for selected day */}
      {selectedDate && existingBookingForDay && !rescheduleTraining && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3 animate-fade-in" data-testid="existing-booking-info">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Vaš termin za ovaj dan</p>
              <p className="text-xs text-muted-foreground">{existingBookingForDay.vrijeme} - {existingBookingForDay.instruktor}</p>
            </div>
            {canReschedule(existingBookingForDay) && (
              <Button onClick={() => setShowRescheduleDialog(true)} variant="outline" className="h-8 text-xs border-primary text-primary" data-testid="reschedule-btn">
                <RefreshCw className="w-3 h-3 mr-1" /> Promijeni
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Time slots */}
      {selectedDate && (
        <div className="animate-fade-in">
          <div className="text-center mb-2">
            <p className="text-xs font-medium text-primary">{formatSelectedDate()}</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />)}
            </div>
          ) : selectedSlots.length > 0 ? (
            <div className="space-y-2">
              {morningSlots.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 text-center uppercase tracking-wider">Prijepodne</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {morningSlots.map((slot) => (
                      <SlotCard key={slot.id} slot={slot} onBook={handleSlotClick} isBooking={bookingSlot === slot.id}
                        disabled={!!existingBookingForDay && !rescheduleTraining} />
                    ))}
                  </div>
                </div>
              )}
              {afternoonSlots.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 text-center uppercase tracking-wider">Poslijepodne</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {afternoonSlots.map((slot) => (
                      <SlotCard key={slot.id} slot={slot} onBook={handleSlotClick} isBooking={bookingSlot === slot.id}
                        disabled={!!existingBookingForDay && !rescheduleTraining} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-secondary/30 rounded-2xl">
              <p className="text-muted-foreground text-sm">
                {isToday(selectedDate) ? 'Nema više dostupnih termina za danas' : 'Nema dostupnih termina'}
              </p>
            </div>
          )}
        </div>
      )}

      {!selectedDate && (
        <div className="text-center py-6 bg-secondary/30 rounded-2xl animate-slide-up delay-200">
          <p className="text-muted-foreground text-sm">Kliknite na datum za prikaz termina</p>
        </div>
      )}

      {/* Booking Confirmation Dialog */}
      <Dialog open={!!confirmSlot} onOpenChange={() => setConfirmSlot(null)}>
        <DialogContent className="max-w-[90%] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">
              {rescheduleTraining ? 'Potvrda preraspodjele' : 'Potvrda termina'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-center">
              <p className="text-foreground text-base">
                {rescheduleTraining ? 'Želite li premjestiti trening na:' : 'Zakazali ste trening u'}
              </p>
              <p className="text-xl font-heading font-semibold text-foreground mt-2">
                {formatConfirmDate()}
              </p>
              <p className="text-lg font-semibold text-primary mt-1">
                {confirmSlot?.vrijeme}
              </p>
            </div>
            <p className="text-center text-muted-foreground text-sm">
              Da li potvrđujete dolazak u ovom terminu?
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setConfirmSlot(null)} variant="outline" className="flex-1 h-12 rounded-full text-base" data-testid="confirm-no-btn">
                Ne
              </Button>
              <Button onClick={handleConfirmBooking} disabled={!!bookingSlot}
                className="flex-1 h-12 rounded-full btn-primary text-base" data-testid="confirm-yes-btn">
                {bookingSlot ? 'Učitavanje...' : 'Da'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-[90%] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">Termin rezervisan!</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-center text-muted-foreground">Želite li podijeliti ovaj termin s prijateljicom?</p>
            <Button onClick={() => handleShare('link')} className="w-full h-12 rounded-full btn-primary" data-testid="share-link-btn">
              <Share2 className="w-5 h-5 mr-2" /> Podijeli termin s prijateljicom
            </Button>
            <Button onClick={() => setShowShareDialog(false)} variant="ghost" className="w-full h-10">Preskoči</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="max-w-[90%] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">Promjena termina</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-sm text-muted-foreground">Trenutni termin</p>
              <p className="font-semibold text-foreground">{existingBookingForDay?.vrijeme} - {existingBookingForDay?.instruktor}</p>
            </div>
            <p className="text-center text-muted-foreground text-sm">
              Imate 30 minuta od trenutka rezervacije da promijenite termin. Odaberite novi termin iz rasporeda.
            </p>
            <Button onClick={handleStartReschedule} className="w-full h-12 rounded-full btn-primary" data-testid="start-reschedule-btn">
              Odaberi novi termin
            </Button>
            <Button onClick={() => setShowRescheduleDialog(false)} variant="ghost" className="w-full h-10">Zatvori</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SlotCard = ({ slot, onBook, isBooking, disabled }) => {
  const isFull = slot.slobodna_mjesta === 0;
  const isDisabled = isFull || disabled;

  return (
    <div
      className={`rounded-xl p-1.5 flex flex-col items-center justify-between
        ${isFull ? 'bg-muted/50' : 'bg-white border border-border'}`}
      data-testid="schedule-slot-card"
    >
      <p className={`text-sm font-semibold ${isFull ? 'text-muted-foreground' : 'text-foreground'}`}>
        {slot.vrijeme}
      </p>
      <p className={`text-[10px] ${isFull ? 'text-muted-foreground' : 'text-primary'}`}>
        {slot.slobodna_mjesta}/{slot.ukupno_mjesta}
      </p>
      <button
        onClick={() => !isDisabled && onBook(slot)}
        disabled={isDisabled || isBooking}
        className={`mt-0.5 w-full py-1 rounded-md text-[10px] font-medium transition-all
          ${isDisabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'gradient-gold text-white active:scale-95'
          }`}
        data-testid="book-slot-btn"
      >
        {isBooking ? '...' : isFull ? 'Puno' : 'Rezerviši'}
      </button>
    </div>
  );
};

export default SchedulePage;
