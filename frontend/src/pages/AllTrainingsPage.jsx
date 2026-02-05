import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AllTrainingsPage = () => {
  const navigate = useNavigate();
  const [upcomingTrainings, setUpcomingTrainings] = useState([]);
  const [pastTrainings, setPastTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        const [upcomingRes, pastRes] = await Promise.all([
          fetch(`${API}/trainings/upcoming`, { credentials: 'include' }),
          fetch(`${API}/trainings/past`, { credentials: 'include' })
        ]);

        if (upcomingRes.ok) {
          const data = await upcomingRes.json();
          setUpcomingTrainings(data);
        }

        if (pastRes.ok) {
          const data = await pastRes.json();
          setPastTrainings(data);
        }
      } catch (error) {
        console.error('Error fetching trainings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainings();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('bs-BA', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const TrainingCard = ({ training, isPast = false }) => (
    <div 
      className={`card-linea ${isPast ? 'opacity-70' : ''}`}
      data-testid={isPast ? 'past-training-card' : 'upcoming-training-card'}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isPast ? 'bg-muted' : 'gradient-gold'}`}>
          <Calendar className={`w-6 h-6 ${isPast ? 'text-muted-foreground' : 'text-white'}`} />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground mb-1">
            {formatDate(training.datum)}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {training.vrijeme}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {training.instruktor}
            </span>
          </div>
          {!isPast && (
            <div className="mt-2 text-xs text-primary font-medium">
              Trajanje: {training.trajanje} minuta
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="all-trainings-page">
      {/* Header */}
      <header className="sticky top-0 bg-background/90 backdrop-blur-lg border-b border-border/40 px-6 py-4 z-10">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
            data-testid="trainings-back-btn"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="font-heading text-xl text-foreground ml-3">
            Tvoji treninzi
          </h1>
        </div>
      </header>

      {/* Content with Tabs */}
      <div className="px-6 py-6">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 p-1 rounded-full h-12">
            <TabsTrigger 
              value="upcoming" 
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
              data-testid="upcoming-tab"
            >
              Predstojeći
            </TabsTrigger>
            <TabsTrigger 
              value="past"
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
              data-testid="past-tab"
            >
              Prethodni
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card-linea animate-pulse h-24" />
                ))}
              </>
            ) : upcomingTrainings.length > 0 ? (
              upcomingTrainings.map((training) => (
                <TrainingCard key={training.id} training={training} />
              ))
            ) : (
              <div className="card-linea text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nemate zakazanih treninga</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card-linea animate-pulse h-24" />
                ))}
              </>
            ) : pastTrainings.length > 0 ? (
              pastTrainings.map((training) => (
                <TrainingCard key={training.id} training={training} isPast />
              ))
            ) : (
              <div className="card-linea text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nemate prethodnih treninga</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AllTrainingsPage;
