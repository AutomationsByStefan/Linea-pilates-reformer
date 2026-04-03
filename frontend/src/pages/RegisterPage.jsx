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

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleRegister();
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col" data-testid="register-page">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="mb-6">
          <img src="/logo.png" alt="Linea Pilates" className="h-20 w-auto mix-blend-multiply" />
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

          <button onClick={function() { navigate('/login'); }} className="w-full text-center text-sm text-[#8B8680] hover:text-[#C4A574]">
            Nazad na prijavu
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
