import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, Mail, Lock } from 'lucide-react';

var API = process.env.REACT_APP_BACKEND_URL + '/api';

function RegisterPage() {
  var navigate = useNavigate();
  var location = useLocation();
  var phone = (location.state && location.state.phone) || '';
  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  function handleRegister() {
    if (!ime || !prezime) { toast.error('Unesite ime i prezime'); return; }
    if (!pin || pin.length !== 4) { toast.error('PIN mora biti 4 cifre'); return; }
    if (pin !== pinConfirm) { toast.error('PIN-ovi se ne podudaraju'); return; }
    if (!phone) { toast.error('Broj telefona nije postavljen'); navigate('/login'); return; }

    setLoading(true);
    fetch(API + '/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, ime: ime, prezime: prezime, email: email, pin: pin })
    }).then(function(r) {
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.detail); });
      return r.json();
    }).then(function(user) {
      toast.success('Registracija uspjesna! Dobrodosli.');
      window.location.href = '/';
    }).catch(function(e) { toast.error(e.message || 'Greska pri registraciji'); })
      .finally(function() { setLoading(false); });
  }

  function handleGoogleRegister() {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    var redirectUrl = window.location.origin + '/';
    window.location.href = 'https://auth.emergentagent.com/?redirect=' + encodeURIComponent(redirectUrl);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleRegister();
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col" data-testid="register-page">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="mb-6">
          <img src="/logo.png" alt="Linea Pilates" className="h-20 w-auto mix-blend-multiply" data-testid="register-logo" />
        </div>

        <div className="w-full max-w-sm space-y-5">
          <div className="text-center mb-2">
            <h1 className="text-xl font-semibold text-[#2C2C2C]">Kreirajte nalog</h1>
            <p className="text-sm text-[#8B8680] mt-1">{phone}</p>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8680]" />
                <Input value={ime} onChange={function(e) { setIme(e.target.value); }}
                  placeholder="Ime" className="h-12 pl-10 rounded-xl border-[#E8E2D8] bg-white text-[#2C2C2C] placeholder:text-[#C4BFBA]" data-testid="register-ime" />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8680]" />
                <Input value={prezime} onChange={function(e) { setPrezime(e.target.value); }}
                  placeholder="Prezime" className="h-12 pl-10 rounded-xl border-[#E8E2D8] bg-white text-[#2C2C2C] placeholder:text-[#C4BFBA]" data-testid="register-prezime" />
              </div>
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8680]" />
              <Input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }}
                placeholder="Email (opcionalno)" className="h-12 pl-10 rounded-xl border-[#E8E2D8] bg-white text-[#2C2C2C] placeholder:text-[#C4BFBA]" data-testid="register-email" />
            </div>

            <div className="pt-2">
              <p className="text-xs text-[#8B8680] mb-2">Postavite 4-cifreni PIN za prijavu</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8680]" />
                  <Input type="password" value={pin} maxLength={4} inputMode="numeric"
                    onChange={function(e) { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); }}
                    placeholder="PIN" className="h-12 pl-10 rounded-xl border-[#E8E2D8] bg-white text-[#2C2C2C] text-center tracking-[0.3em] placeholder:text-[#C4BFBA] placeholder:tracking-normal" data-testid="register-pin" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8680]" />
                  <Input type="password" value={pinConfirm} maxLength={4} inputMode="numeric"
                    onChange={function(e) { setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4)); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Potvrdi" className="h-12 pl-10 rounded-xl border-[#E8E2D8] bg-white text-[#2C2C2C] text-center tracking-[0.3em] placeholder:text-[#C4BFBA] placeholder:tracking-normal" data-testid="register-pin-confirm" />
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleRegister} disabled={loading}
            className="w-full h-12 rounded-xl bg-[#C4A574] hover:bg-[#A68B5B] text-white font-medium" data-testid="register-submit-btn">
            {loading ? 'Kreiranje...' : 'Kreiraj nalog'}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E8E2D8]"></div>
            <span className="text-xs text-[#8B8680]">ili</span>
            <div className="flex-1 h-px bg-[#E8E2D8]"></div>
          </div>

          {/* Google Register */}
          <button
            onClick={handleGoogleRegister}
            className="w-full h-12 rounded-xl border border-[#E8E2D8] bg-white hover:bg-[#F5F0E8] flex items-center justify-center gap-3 transition-colors"
            data-testid="google-register-btn"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
            <span className="text-sm font-medium text-[#2C2C2C]">Registruj se sa Google</span>
          </button>

          <button onClick={function() { navigate('/login'); }} className="w-full text-center text-sm text-[#8B8680] hover:text-[#C4A574]">
            Nazad na prijavu
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
