import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SchedulePage = () => {
  const [schedule, setSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

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

  // Generate week dates
  const getWeekDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
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

  const handleBook = (slot) => {
    toast.success(`Termin u ${slot.vrijeme} je rezervisan!`);
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

      {/* Week Calendar Strip */}
      <div className="mb-6 animate-slide-up delay-100">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          {weekDates.map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            
            return (
              <button
                key={index}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center min-w-[4rem] h-20 rounded-2xl transition-all duration-200 ${
                  isSelected 
                    ? 'gradient-gold text-white shadow-soft' 
                    : 'bg-white border border-border hover:border-primary/30'
                }`}
                data-testid={`date-selector-${index}`}
              >
                <span className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                  {formatDay(date)}
                </span>
                <span className={`text-xl font-semibold mt-1 ${isSelected ? 'text-white' : 'text-foreground'}`}>
                  {formatDateNum(date)}
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
          {selectedDate.toLocaleDateString('bs-BA', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
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
                  disabled={slot.slobodna_mjesta === 0}
                  className={`h-10 px-4 rounded-full text-sm font-medium ${
                    slot.slobodna_mjesta > 0 
                      ? 'btn-primary' 
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                  data-testid="book-slot-btn"
                >
                  {slot.slobodna_mjesta > 0 ? 'Rezerviši' : 'Popunjeno'}
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
    </div>
  );
};

export default SchedulePage;
