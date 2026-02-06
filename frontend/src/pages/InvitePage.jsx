import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const InvitePage = () => {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await fetch(`${API}/invites/${inviteId}`);
        if (response.ok) {
          const data = await response.json();
          setInvite(data);
        } else {
          setResult({ success: false, message: 'Pozivnica nije pronađena' });
        }
      } catch (error) {
        setResult({ success: false, message: 'Greška pri učitavanju pozivnice' });
      } finally {
        setLoading(false);
      }
    };

    if (inviteId) {
      fetchInvite();
    }
  }, [inviteId]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await fetch(`${API}/trainings/invites/${inviteId}/accept`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toast.success(data.message);
        setTimeout(() => navigate('/'), 2000);
      }
    } catch (error) {
      setResult({ success: false, message: 'Greška pri prihvatanju poziva' });
    } finally {
      setAccepting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
    const months = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
    return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
  };

  if (loading) {
    return (
      <div className="mobile-container min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <img 
            src="https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/5nxfiuyl_att._hwTgC7bergolOr8J8t8MnMqBiHNjbb-rVcNJHYvkZw.jpg"
            alt="Linea"
            className="w-24 h-24 object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container min-h-screen bg-background" data-testid="invite-page">
      <div className="px-6 py-12 flex flex-col items-center justify-center min-h-screen">
        {/* Logo */}
        <img 
          src="https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/5nxfiuyl_att._hwTgC7bergolOr8J8t8MnMqBiHNjbb-rVcNJHYvkZw.jpg"
          alt="Linea Reformer Pilates"
          className="w-32 h-32 object-contain mb-8"
        />

        {result ? (
          // Result state
          <div className="card-linea w-full max-w-sm text-center animate-fade-in">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
              result.success ? 'bg-green-100' : 'bg-orange-100'
            }`}>
              {result.success ? (
                <Check className="w-8 h-8 text-green-600" />
              ) : (
                <X className="w-8 h-8 text-orange-500" />
              )}
            </div>
            <p className="text-foreground whitespace-pre-line">
              {result.message}
            </p>
            {!result.success && (
              <Button
                onClick={() => navigate('/termini')}
                className="btn-primary mt-6"
              >
                Pogledaj termine
              </Button>
            )}
          </div>
        ) : invite ? (
          // Invite details
          <div className="w-full max-w-sm animate-fade-in">
            <div className="card-linea mb-6">
              <h1 className="font-heading text-2xl text-foreground text-center mb-2">
                Poziv na trening 💪
              </h1>
              <p className="text-muted-foreground text-center mb-6">
                {invite.sender_name} te poziva na zajednički Pilates Reformer trening
              </p>

              {/* Training details */}
              <div className="bg-secondary/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="text-foreground">{formatDate(invite.datum)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-foreground">{invite.vrijeme}</span>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-foreground">{invite.instruktor}</span>
                </div>
              </div>
            </div>

            {invite.status === 'pending' ? (
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="btn-primary w-full h-14 text-lg"
                data-testid="accept-invite-btn"
              >
                {accepting ? 'Prihvatanje...' : 'Prihvati poziv'}
              </Button>
            ) : (
              <p className="text-center text-muted-foreground">
                Ova pozivnica je već iskorištena
              </p>
            )}

            <p className="text-center text-sm text-muted-foreground mt-6">
              Potrebna je aktivna članarina za prihvatanje poziva
            </p>
          </div>
        ) : (
          // Not found
          <div className="card-linea text-center">
            <p className="text-muted-foreground">Pozivnica nije pronađena</p>
            <Button
              onClick={() => navigate('/login')}
              className="btn-primary mt-4"
            >
              Prijavi se
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
