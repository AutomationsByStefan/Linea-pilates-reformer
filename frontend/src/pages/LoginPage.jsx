import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronDown, Lock, Phone } from 'lucide-react';

var API = process.env.REACT_APP_BACKEND_URL + '/api';

var COUNTRY_CODES = [
  { code: '+387', label: 'BiH +387', placeholder: '61 234 567' },
  { code: '+385', label: 'HR +385', placeholder: '91 234 5678' },
  { code: '+381', label: 'SRB +381', placeholder: '60 123 4567' },
  { code: '+382', label: 'MNE +382', placeholder: '67 123 456' },
  { code: '+386', label: 'SLO +386', placeholder: '40 123 456' },
  { code: '+43', label: 'AT +43', placeholder: '660 123 456' },
  { code: '+49', label: 'DE +49', placeholder: '170 123 4567' },
];

function LoginPage() {
  const [step, setStep] = useState('phone');
  const [countryCode, setCountryCode] = useState('+387');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  var navigate = useNavigate();

  var selectedCountry = COUNTRY_CODES.find(function(c) { return c.code === countryCode; }) || COUNTRY_CODES[0];

  function getFullPhone() {
    var cleaned = phoneNumber.replace(/\s/g, '');
    return countryCode + cleaned;
  }

  function handleCheckPhone() {
    if (!phoneNumber || phoneNumber.replace(/\s/g, '').length < 6) {
      toast.error('Unesite ispravan broj telefona');
      return;
    }
    setLoading(true);
    var fullPhone = getFullPhone();
    fetch(API + '/auth/phone/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fullPhone })
    }).then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.exists) {
          setUserName(data.name);
          setStep('pin');
        } else {
          navigate('/register', { state: { phone: fullPhone, countryCode: countryCode } });
        }
      })
      .catch(function() { toast.error('Greska pri provjeri broja'); })
      .finally(function() { setLoading(false); });
  }

  function handleLogin() {
    if (!pin || pin.length !== 4) {
      toast.error('PIN mora biti 4 cifre');
      return;
    }
    setLoading(true);
    fetch(API + '/auth/phone/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: getFullPhone(), pin: pin })
    }).then(function(r) {
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.detail); });
      return r.json();
    }).then(function(user) {
      toast.success('Dobrodosli, ' + (user.name || ''));
      window.location.href = '/';
    }).catch(function(e) { toast.error(e.message || 'Neispravan PIN'); })
      .finally(function() { setLoading(false); });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (step === 'phone') handleCheckPhone();
      else if (step === 'pin') handleLogin();
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col" data-testid="login-page">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <div className="mb-8">
          <img src="/logo.png" alt="Linea Pilates" className="h-28 w-auto mix-blend-multiply" />
        </div>

        <div className="w-full max-w-sm">
          {step === 'phone' && (
            <div className="space-y-5" data-testid="phone-step">
              <div className="text-center mb-2">
                <h1 className="text-xl font-semibold text-[#2C2C2C]">Dobrodosli</h1>
                <p className="text-sm text-[#8B8680] mt-1">Unesite broj telefona za prijavu</p>
              </div>

              <div className="flex gap-2">
                {/* Country code dropdown */}
                <div className="relative">
                  <button
                    onClick={function() { setShowCodes(!showCodes); }}
                    className="h-12 px-3 rounded-xl border border-[#E8E2D8] bg-white flex items-center gap-1 text-sm text-[#2C2C2C] min-w-[100px]"
                    data-testid="country-code-btn"
                  >
                    <span className="font-medium">{countryCode}</span>
                    <ChevronDown className="w-3 h-3 text-[#8B8680]" />
                  </button>
                  {showCodes && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-[#E8E2D8] rounded-xl shadow-lg z-50 w-48 max-h-48 overflow-y-auto" data-testid="country-code-dropdown">
                      {COUNTRY_CODES.map(function(c) {
                        return (
                          <button key={c.code} onClick={function() { setCountryCode(c.code); setShowCodes(false); }}
                            className={'w-full text-left px-4 py-2.5 text-sm hover:bg-[#F5F0E8] ' + (c.code === countryCode ? 'bg-[#F5F0E8] font-medium' : '')}>
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Phone number */}
                <div className="flex-1 relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8680]" />
                  <Input
                    type="tel"
                    value={phoneNumber}
                    onChange={function(e) { setPhoneNumber(e.target.value); }}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedCountry.placeholder}
                    className="h-12 pl-10 rounded-xl border-[#E8E2D8] bg-white text-[#2C2C2C] placeholder:text-[#C4BFBA] text-sm"
                    data-testid="phone-input"
                  />
                </div>
              </div>

              <Button
                onClick={handleCheckPhone}
                disabled={loading || !phoneNumber}
                className="w-full h-12 rounded-xl bg-[#C4A574] hover:bg-[#A68B5B] text-white font-medium"
                data-testid="continue-btn"
              >
                {loading ? 'Provjera...' : 'Nastavi'}
              </Button>
            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-5" data-testid="pin-step">
              <div className="text-center mb-2">
                <h1 className="text-xl font-semibold text-[#2C2C2C]">
                  {userName ? 'Zdravo, ' + userName : 'Unesite PIN'}
                </h1>
                <p className="text-sm text-[#8B8680] mt-1">Unesite vas 4-cifreni PIN</p>
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8680]" />
                <Input
                  type="password"
                  value={pin}
                  onChange={function(e) { var v = e.target.value.replace(/\D/g, '').slice(0, 4); setPin(v); }}
                  onKeyDown={handleKeyDown}
                  placeholder="* * * *"
                  maxLength={4}
                  inputMode="numeric"
                  className="h-12 pl-10 rounded-xl border-[#E8E2D8] bg-white text-[#2C2C2C] text-center text-lg tracking-[0.5em] placeholder:text-[#C4BFBA] placeholder:tracking-[0.3em]"
                  data-testid="pin-input"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleLogin}
                disabled={loading || pin.length !== 4}
                className="w-full h-12 rounded-xl bg-[#C4A574] hover:bg-[#A68B5B] text-white font-medium"
                data-testid="login-btn"
              >
                {loading ? 'Prijava...' : 'Prijavi se'}
              </Button>

              <button
                onClick={function() { setStep('phone'); setPin(''); }}
                className="w-full text-center text-sm text-[#8B8680] hover:text-[#C4A574]"
              >
                Nazad
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
