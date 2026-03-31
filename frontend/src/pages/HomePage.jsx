import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MapPin, ChevronRight, Calendar, Clock, User as UserIcon, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FeedbackModal from '@/components/FeedbackModal';
import InAppNotification, { useNotifications } from '@/components/InAppNotification';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HomePage = ({ user }) => {
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [studioInfo, setStudioInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingFeedback, setPendingFeedback] = useState([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedTrainingForFeedback, setSelectedTrainingForFeedback] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activityStatus, setActivityStatus] = useState(null);
  const [showInactivityReminder, setShowInactivityReminder] = useState(false);
  const [pendingPackage, setPendingPackage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membershipsRes, trainingsRes, studioRes, feedbackRes, notifRes, activityRes, myRequestsRes] = await Promise.all([
          fetch(`${API}/memberships/active`, { credentials: 'include' }),
          fetch(`${API}/trainings/upcoming`, { credentials: 'include' }),
          fetch(`${API}/studio-info`),
          fetch(`${API}/feedback/pending`, { credentials: 'include' }),
          fetch(`${API}/notifications/unread`, { credentials: 'include' }),
          fetch(`${API}/user/activity-status`, { credentials: 'include' }),
          fetch(`${API}/packages/my-requests`, { credentials: 'include' })
        ]);

        if (membershipsRes.ok) {
          const data = await membershipsRes.json();
          setMemberships(data);
        }

        if (trainingsRes.ok) {
          const data = await trainingsRes.json();
          setTrainings(data);
        }

        if (studioRes.ok) {
          const data = await studioRes.json();
          setStudioInfo(data);
        }

        if (feedbackRes.ok) {
          const data = await feedbackRes.json();
          setPendingFeedback(data);
          // Show feedback modal for first pending training after a delay
          if (data.length > 0) {
            setTimeout(() => {
              setSelectedTrainingForFeedback(data[0]);
              setShowFeedbackModal(true);
            }, 2000);
          }
        }

        if (notifRes.ok) {
          const data = await notifRes.json();
          setUnreadNotifications(data.length);
        }

        if (activityRes.ok) {
          const data = await activityRes.json();
          setActivityStatus(data);
          // Show inactivity reminder if needed
          if (data.should_show_reminder && pendingFeedback.length === 0) {
            setTimeout(() => setShowInactivityReminder(true), 3000);
          }
        }

        if (myRequestsRes.ok) {
          const requests = await myRequestsRes.json();
          const pending = requests.find(r => r.status === 'pending');
          if (pending) setPendingPackage(pending.package_name);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Korisnik';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
    const months = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
    return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
  };

  const handleFeedbackSuccess = () => {
    setPendingFeedback(prev => prev.filter(t => t.id !== selectedTrainingForFeedback?.id));
    setSelectedTrainingForFeedback(null);
  };

  return (
    <div className="px-6 pt-6 pb-4" data-testid="home-page">
      {/* Inactivity Reminder */}
      {showInactivityReminder && activityStatus?.should_show_reminder && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-slide-up" data-testid="inactivity-reminder">
          <div className="bg-white rounded-2xl shadow-hover p-4 border border-border/50">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground whitespace-pre-line">
                  {activityStatus.reminder_message}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => {
                      setShowInactivityReminder(false);
                      navigate('/termini');
                    }}
                    className="btn-primary h-9 text-sm"
                  >
                    Rezerviši termin
                  </Button>
                  <Button
                    onClick={() => setShowInactivityReminder(false)}
                    variant="ghost"
                    className="h-9 text-sm"
                  >
                    Kasnije
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Welcome Card */}
      <section className="mb-6 animate-fade-in">
        <div className="card-hero" data-testid="welcome-card">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <h1 className="font-heading text-2xl">
                Zdravo, {firstName}
              </h1>
              {unreadNotifications > 0 && (
                <button
                  onClick={() => navigate('/obavjestenja')}
                  className="relative bg-white/20 p-2 rounded-full"
                  data-testid="notifications-badge"
                >
                  <Bell className="w-5 h-5 text-white" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-primary text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                </button>
              )}
            </div>
            <p className="text-white/90 mb-4">
              Vrijeme je da rezervišeš naredni trening?
            </p>
            <Button
              onClick={() => navigate('/termini')}
              className="bg-white text-primary hover:bg-white/90 h-12 px-6 rounded-full font-medium"
              data-testid="reserve-btn"
            >
              Rezerviši termin
            </Button>
          </div>
        </div>
      </section>

      {/* Section 2: Aktivne članarine */}
      <section className="mb-6 animate-slide-up delay-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-heading text-xl text-foreground">
            Aktivne članarine
          </h2>
          {memberships.length > 0 && (
            <button
              onClick={() => navigate('/clanarine')}
              className="text-primary text-sm font-medium hover:underline flex items-center"
              data-testid="view-all-memberships-btn"
            >
              Vidi sve
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="card-linea animate-pulse h-24" />
        ) : memberships.length > 0 ? (
          <div className="space-y-3">
            {memberships.slice(0, 1).map((membership) => (
              <div
                key={membership.id}
                className="card-linea card-linea-interactive"
                onClick={() => navigate('/clanarine')}
                data-testid="membership-card"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-foreground mb-1">
                      {membership.naziv}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Preostalo termina: <span className="text-primary font-semibold">{membership.preostali_termini}/{membership.ukupni_termini}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Ističe</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(membership.datum_isteka).toLocaleDateString('bs-BA')}
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full gradient-gold rounded-full transition-all duration-500"
                    style={{ width: `${(membership.preostali_termini / (membership.ukupni_termini || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-linea text-center py-8" data-testid="no-memberships">
            {pendingPackage ? (
              <>
                <p className="text-foreground font-medium">Vaš paket čeka aktivaciju nakon uplate</p>
                <p className="text-muted-foreground text-sm mt-1">Paket: {pendingPackage}</p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">Trenutno nemate aktivnih članarina</p>
                <Button
                  onClick={() => navigate('/paketi')}
                  className="btn-primary mt-4"
                >
                  Pogledaj pakete
                </Button>
              </>
            )}
          </div>
        )}
      </section>

      {/* Section 3: Predstojeći trening */}
      <section className="mb-6 animate-slide-up delay-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-heading text-xl text-foreground">
            Predstojeći trening
          </h2>
          <button
            onClick={() => navigate('/treninzi')}
            className="text-primary text-sm font-medium hover:underline flex items-center"
            data-testid="view-all-trainings-btn"
          >
            Vidi sve
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        {loading ? (
          <div className="card-linea animate-pulse h-24" />
        ) : trainings.length > 0 ? (
          <div
            className="card-linea card-linea-interactive"
            onClick={() => navigate('/treninzi')}
            data-testid="upcoming-training-card"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl gradient-gold flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground mb-1">
                  {formatDate(trainings[0].datum)}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {trainings[0].vrijeme}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-linea text-center py-8" data-testid="no-trainings">
            <p className="text-muted-foreground">Trenutno nemate izabranih termina</p>
            <Button
              onClick={() => navigate('/termini')}
              className="btn-primary mt-4"
            >
              Zakaži trening
            </Button>
          </div>
        )}
      </section>

      {/* Section 4: Kontakt informacije */}
      <section className="animate-slide-up delay-300">
        <h2 className="font-heading text-xl text-foreground mb-4">
          Kontakt informacije
        </h2>

        {studioInfo && (
          <div className="space-y-3">
            {/* Telefon */}
            <a
              href={`tel:${studioInfo.telefon}`}
              className="card-linea card-linea-interactive flex items-center gap-4"
              data-testid="contact-phone-card"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Kontakt telefon
                </p>
                <p className="font-medium text-foreground">{studioInfo.telefon}</p>
              </div>
            </a>

            {/* Instagram */}
            <a
              href={studioInfo.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="card-linea card-linea-interactive flex items-center gap-4"
              data-testid="contact-instagram-card"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Instagram
                </p>
                <p className="font-medium text-foreground">{studioInfo.instagram_handle}</p>
              </div>
            </a>

            {/* Adresa */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studioInfo.adresa)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card-linea card-linea-interactive block"
              data-testid="contact-address-card"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Adresa
                  </p>
                  <p className="font-medium text-foreground">{studioInfo.adresa}</p>
                </div>
              </div>
              {/* Google Maps Embed */}
              <div className="rounded-2xl overflow-hidden h-40 bg-muted relative pointer-events-none">
                <iframe
                  title="Lokacija studija"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(studioInfo.adresa)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </a>
          </div>
        )}
      </section>

      {/* Feedback Modal */}
      {showFeedbackModal && selectedTrainingForFeedback && (
        <FeedbackModal
          training={selectedTrainingForFeedback}
          onClose={() => {
            setShowFeedbackModal(false);
            setSelectedTrainingForFeedback(null);
          }}
          onSuccess={handleFeedbackSuccess}
        />
      )}
    </div>
  );
};

export default HomePage;
