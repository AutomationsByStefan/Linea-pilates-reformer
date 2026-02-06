import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Calendar, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API}/notifications`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await fetch(`${API}/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include'
      });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API}/notifications/read-all`, {
        method: 'POST',
        credentials: 'include'
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Sva obavještenja označena kao pročitana');
    } catch (error) {
      toast.error('Greška');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Upravo sada';
    if (diffMins < 60) return `Prije ${diffMins} min`;
    if (diffHours < 24) return `Prije ${diffHours}h`;
    if (diffDays < 7) return `Prije ${diffDays} dana`;
    return date.toLocaleDateString('bs-BA');
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'training_invite':
        return Calendar;
      case 'training_reminder':
        return Bell;
      case 'feedback_request':
        return Check;
      default:
        return Bell;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background" data-testid="notifications-page">
      {/* Header */}
      <header className="sticky top-0 bg-background/90 backdrop-blur-lg border-b border-border/40 px-6 py-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
              data-testid="notifications-back-btn"
            >
              <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
            </button>
            <h1 className="font-heading text-xl text-foreground ml-3">
              Obavještenja
            </h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-primary font-medium"
            >
              Označi sve
            </button>
          )}
        </div>
      </header>

      <div className="px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-linea animate-pulse h-20" />
            ))}
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              return (
                <div
                  key={notification.id}
                  className={`card-linea ${!notification.read ? 'border-l-4 border-l-primary' : ''}`}
                  onClick={() => !notification.read && handleMarkRead(notification.id)}
                  data-testid="notification-item"
                >
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      !notification.read ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Icon className={`w-5 h-5 ${!notification.read ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card-linea text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nema obavještenja</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
