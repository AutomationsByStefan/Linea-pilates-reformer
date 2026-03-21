import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

const LoginPage = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API}/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          navigate('/');
          return;
        }
      } catch (error) {
        // Not authenticated, show login
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    
    if (!phone || phone.length < 9) {
      toast.error('Unesite ispravan broj telefona');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await response.json();

      if (data.user_exists) {
        // User exists, go to OTP page
        toast.success('OTP kod je poslan');
        navigate('/otp', { state: { phone } });
      } else {
        // User doesn't exist, go to registration
        toast.info('Potrebna je registracija');
        navigate('/register', { state: { phone } });
      }
    } catch (error) {
      toast.error('Došlo je do greške');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <img 
            src="https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/jp1fkri2_Untitled%20design%20%285%29.png"
            alt="Linea"
            className="w-32 h-32 object-contain rounded-2xl"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container min-h-screen flex flex-col bg-background" data-testid="login-page">
      {/* Logo Section */}
      <div className="flex items-center justify-center pt-6 animate-fade-in">
        <img 
          src="https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/jp1fkri2_Untitled%20design%20%285%29.png"
          alt="Linea Reformer Pilates"
          className="w-64 h-64 object-contain mix-blend-multiply"
          data-testid="login-logo"
        />
      </div>
      
      {/* Content Section */}
      <div className="flex-1 flex flex-col px-8 pt-0 pb-6">
        {/* Welcome text */}
        <div className="text-center mb-5 animate-slide-up">
          <h1 className="font-heading text-3xl text-foreground">Dobrodošli</h1>
          <p className="text-muted-foreground mt-2 text-base">
            Prijavite se na svoj nalog
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handlePhoneSubmit} className="space-y-3 animate-slide-up delay-100">
          <Input
            type="tel"
            placeholder="Broj telefona"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-linea w-full h-12 text-base"
            data-testid="phone-input"
          />

          <Button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-12 text-base"
            data-testid="continue-btn"
          >
            {loading ? 'Učitavanje...' : 'Nastavi'}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-4 animate-slide-up delay-200">
          <div className="flex-1 h-px bg-border" />
          <span className="px-4 text-sm text-muted-foreground">ili</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google Login */}
        <Button
          type="button"
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full h-12 text-base border-2 border-primary text-primary hover:bg-primary/5 rounded-full animate-slide-up delay-300"
          data-testid="google-login-btn"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Nastavi s Google nalogom
        </Button>

        {/* Terms */}
        <p className="text-center text-xs text-muted-foreground mt-6 animate-slide-up delay-400">
          Registracijom prihvatate naše{' '}
          <Link 
            to="/uslovi-koristenja" 
            className="text-primary hover:underline"
            data-testid="terms-link"
          >
            Uslove korištenja
          </Link>
          {' '}i{' '}
          <Link 
            to="/politika-privatnosti" 
            className="text-primary hover:underline"
            data-testid="privacy-link"
          >
            Politiku privatnosti
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
