import React, { useState, useEffect } from 'react';
import { X, Bell, Calendar, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Notification types and their messages
const NOTIFICATION_TEMPLATES = {
  dayBefore: (time) => ({
    title: 'Sutra te očekuje trening',
    message: `Sutra te očekuje tvoj Pilates Reformer trening 💪\nVidimo se u ${time}. Radujemo se zajedničkom treningu.`
  }),
  sameDay: (time) => ({
    title: 'Još malo do treninga',
    message: `Još malo do tvog treninga 🧘‍♀️\nPočetak u ${time}. Vrijeme za pokret i dobar osjećaj.`
  }),
  feedbackRequest: {
    title: 'Kako ti je prijao trening?',
    message: 'Odvoji trenutak za sebe 😊\nKako ti je prijao današnji Pilates Reformer trening?'
  },
  inactivityReminder: {
    title: 'Nedostaješ nam',
    message: 'Nedostaješ nam u studiju 😊\nVrijeme je da rezervišeš novi Pilates Reformer trening.'
  },
  trainingInvite: (senderName, datum, vrijeme) => ({
    title: 'Poziv na trening',
    message: `Tvoja prijateljica te poziva na zajednički Pilates Reformer trening 💪\nTermin: ${datum} u ${vrijeme}`
  })
};

const InAppNotification = ({ notification, onClose, onAction }) => {
  if (!notification) return null;

  return (
    <div 
      className="fixed top-4 left-4 right-4 z-[100] animate-slide-up"
      data-testid="in-app-notification"
    >
      <div className="bg-white rounded-2xl shadow-hover p-4 border border-border/50">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-foreground">
                {notification.title}
              </h3>
              <button
                onClick={onClose}
                className="p-1 -mr-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
              {notification.message}
            </p>
            {notification.action && (
              <Button
                onClick={() => onAction?.(notification.action)}
                className="btn-primary mt-3 h-9 text-sm"
              >
                {notification.actionLabel || 'Pogledaj'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for managing notifications
export const useNotifications = () => {
  const [currentNotification, setCurrentNotification] = useState(null);
  const [pendingFeedback, setPendingFeedback] = useState([]);
  const [activityStatus, setActivityStatus] = useState(null);
  const navigate = useNavigate();

  // Check for pending feedback on mount
  useEffect(() => {
    const checkPendingFeedback = async () => {
      try {
        const response = await fetch(`${API}/feedback/pending`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setPendingFeedback(data);
          
          // Show feedback notification if there's pending feedback
          if (data.length > 0) {
            setTimeout(() => {
              setCurrentNotification({
                ...NOTIFICATION_TEMPLATES.feedbackRequest,
                action: 'feedback',
                actionLabel: 'Ocijeni trening',
                data: data[0]
              });
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Error checking pending feedback:', error);
      }
    };

    checkPendingFeedback();
  }, []);

  // Check activity status for inactivity reminder
  useEffect(() => {
    const checkActivityStatus = async () => {
      try {
        const response = await fetch(`${API}/user/activity-status`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setActivityStatus(data);
          
          // Show inactivity reminder if needed (and no other notifications are showing)
          if (data.should_show_reminder && pendingFeedback.length === 0) {
            setTimeout(() => {
              setCurrentNotification({
                ...NOTIFICATION_TEMPLATES.inactivityReminder,
                action: 'schedule',
                actionLabel: 'Rezerviši termin'
              });
            }, 5000);
          }
        }
      } catch (error) {
        console.error('Error checking activity status:', error);
      }
    };

    checkActivityStatus();
  }, [pendingFeedback.length]);

  const handleAction = (action) => {
    switch (action) {
      case 'feedback':
        // Will be handled by parent component
        break;
      case 'schedule':
        navigate('/termini');
        break;
      default:
        break;
    }
    setCurrentNotification(null);
  };

  const closeNotification = () => {
    setCurrentNotification(null);
  };

  const showNotification = (notification) => {
    setCurrentNotification(notification);
  };

  return {
    currentNotification,
    pendingFeedback,
    activityStatus,
    handleAction,
    closeNotification,
    showNotification,
    InAppNotification: () => (
      <InAppNotification
        notification={currentNotification}
        onClose={closeNotification}
        onAction={handleAction}
      />
    )
  };
};

export { NOTIFICATION_TEMPLATES };
export default InAppNotification;
