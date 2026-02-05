import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OTPPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const phone = location.state?.phone;

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!phone) {
      navigate('/login');
    }
  }, [phone, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Unesite kompletan OTP kod');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/phone/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, otp })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Neispravan OTP kod');
      }

      const userData = await response.json();
      toast.success('Uspješna prijava!');
      navigate('/', { state: { user: userData }, replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await fetch(`${API}/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      toast.success('Novi OTP kod je poslan');
      setCountdown(60);
    } catch (error) {
      toast.error('Greška pri slanju OTP koda');
    }
  };

  if (!phone) return null;

  return (
    <div className="mobile-container min-h-screen flex flex-col bg-background" data-testid="otp-page">
      {/* Header */}
      <header className="flex items-center px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
          data-testid="otp-back-btn"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-8 pb-12">
        {/* Title */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-heading text-3xl text-foreground mb-2">
            Verifikacija
          </h1>
          <p className="text-muted-foreground">
            Unesite kod poslan na<br />
            <span className="text-foreground font-medium">{phone}</span>
          </p>
        </div>

        {/* OTP Input */}
        <div className="flex justify-center mb-8 animate-slide-up delay-200">
          <InputOTP
            value={otp}
            onChange={setOtp}
            maxLength={6}
            data-testid="otp-input"
          >
            <InputOTPGroup className="gap-2">
              <InputOTPSlot index={0} className="w-12 h-14 text-xl border-border rounded-xl" />
              <InputOTPSlot index={1} className="w-12 h-14 text-xl border-border rounded-xl" />
              <InputOTPSlot index={2} className="w-12 h-14 text-xl border-border rounded-xl" />
              <InputOTPSlot index={3} className="w-12 h-14 text-xl border-border rounded-xl" />
              <InputOTPSlot index={4} className="w-12 h-14 text-xl border-border rounded-xl" />
              <InputOTPSlot index={5} className="w-12 h-14 text-xl border-border rounded-xl" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* Hint for mock */}
        <p className="text-center text-sm text-muted-foreground mb-6 animate-slide-up delay-300">
          <span className="text-primary">Demo: </span>
          Koristite kod <span className="font-mono font-bold">123456</span>
        </p>

        {/* Verify Button */}
        <Button
          onClick={handleVerify}
          disabled={loading || otp.length !== 6}
          className="btn-primary w-full h-14 text-lg animate-slide-up delay-400"
          data-testid="verify-otp-btn"
        >
          {loading ? 'Provjera...' : 'Potvrdi'}
        </Button>

        {/* Resend */}
        <div className="text-center mt-6 animate-slide-up delay-500">
          {countdown > 0 ? (
            <p className="text-muted-foreground">
              Pošalji ponovo za <span className="text-primary font-medium">{countdown}s</span>
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="text-primary hover:underline font-medium"
              data-testid="resend-otp-btn"
            >
              Pošalji ponovo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTPPage;
