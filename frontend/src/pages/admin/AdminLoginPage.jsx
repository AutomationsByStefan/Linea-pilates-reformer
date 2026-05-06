import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock, Phone, KeyRound, ArrowLeft } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COUNTRY_CODES = [
  { code: '+387', flag: '🇧🇦', label: 'BiH' },
  { code: '+381', flag: '🇷🇸', label: 'Srbija' },
  { code: '+382', flag: '🇲🇪', label: 'CG' },
  { code: '+385', flag: '🇭🇷', label: 'Hrvatska' },
];

function normalizePhone(prefix, raw) {
  let p = (raw || '').replace(/[\s()-]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('+')) return p;
  if (p.startsWith('0')) p = p.slice(1);
  return prefix + p;
}

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // 'phone' | 'pin'
  const [prefix, setPrefix] = useState('+387');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then(async (res) => {
        if (!mounted) return;
        if (res.ok) {
          const me = await res.json();
          if (me && me.is_admin) {
            navigate('/admin');
            return;
          }
        }
        setChecking(false);
      })
      .catch(() => mounted && setChecking(false));
    return () => { mounted = false; };
  }, [navigate]);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phoneLocal.trim()) { toast.error('Unesite broj telefona'); return; }
    const fullPhone = normalizePhone(prefix, phoneLocal);
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/phone/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Greška pri provjeri broja');
        return;
      }
      if (!data.exists) {
        toast.error('Nalog sa ovim brojem ne postoji');
        return;
      }
      setUserName(data.name || '');
      setStep('pin');
    } catch {
      toast.error('Greška pri provjeri broja');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error('PIN mora biti 4 cifre');
      return;
    }
    const fullPhone = normalizePhone(prefix, phoneLocal);
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/phone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: fullPhone, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Pogrešan PIN');
        return;
      }
      if (!data.is_admin) {
        toast.error('Nemate admin pristup.');
        return;
      }
      toast.success('Uspješna prijava');
      navigate('/admin');
    } catch {
      toast.error('Greška pri prijavi');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="animate-pulse text-white/50">Učitavanje...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center px-6" data-testid="admin-login-page">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#C4A574] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/50 mt-1 text-sm">Linea Reformer Pilates</p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4" data-testid="phone-step">
            <label className="block text-white/60 text-xs uppercase tracking-wider mb-1">Broj telefona</label>
            <div className="flex gap-2">
              <select
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="h-12 rounded-md bg-white/10 border border-white/20 text-white px-2 text-sm focus:outline-none focus:border-[#C4A574]"
                data-testid="admin-country-select"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#1a1a2e]">
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="tel"
                  inputMode="tel"
                  autoFocus
                  placeholder="66 024 148"
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-9"
                  data-testid="admin-phone-input"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#C4A574] hover:bg-[#A68B5B] text-white font-medium"
              data-testid="admin-phone-continue-btn"
            >
              {loading ? 'Provjera...' : 'Nastavi'}
            </Button>
          </form>
        )}

        {step === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4" data-testid="pin-step">
            <button
              type="button"
              onClick={() => { setStep('phone'); setPin(''); }}
              className="text-white/50 hover:text-white text-xs flex items-center gap-1"
              data-testid="admin-back-btn"
            >
              <ArrowLeft className="w-3 h-3" /> Promijeni broj
            </button>
            {userName && (
              <p className="text-white/60 text-sm">
                Pozdrav, <span className="text-[#C4A574] font-medium">{userName}</span>
              </p>
            )}
            <label className="block text-white/60 text-xs uppercase tracking-wider mb-1">4-cifren PIN</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-9 tracking-[0.5em] text-center"
                data-testid="admin-pin-input"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || pin.length !== 4}
              className="w-full h-12 bg-[#C4A574] hover:bg-[#A68B5B] text-white font-medium disabled:opacity-50"
              data-testid="admin-login-btn"
            >
              {loading ? 'Prijava...' : 'Prijavi se'}
            </Button>
          </form>
        )}

        <p className="text-center text-white/30 text-xs mt-6">
          Pristup samo za ovlašteno osoblje
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
