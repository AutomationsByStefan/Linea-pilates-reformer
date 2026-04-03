import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronDown, Lock, Phone, Search } from 'lucide-react';
import COUNTRY_CODES from '@/data/countryCodes';

var API = process.env.REACT_APP_BACKEND_URL + '/api';

function LoginPage() {
  const [step, setStep] = useState('phone');
  const [countryCode, setCountryCode] = useState('+387');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  var navigate = useNavigate();
  var dropdownRef = useRef(null);

  var selectedCountry = COUNTRY_CODES.find(function(c) { return c.code === countryCode; }) || COUNTRY_CODES.find(function(c) { return c.country === 'BA'; });

  var filteredCodes = COUNTRY_CODES.filter(function(c) {
    var q = searchQuery.toLowerCase();
    return c.label.toLowerCase().includes(q) || c.code.includes(q) || c.country.toLowerCase().includes(q);
  });

  useEffect(function() {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCodes(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return function() { document.removeEventListener('mousedown', handleClickOutside); };
  }, []);

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

  function handleGoogleLogin() {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    var redirectUrl = window.location.origin + '/';
    window.location.href = 'https://auth.emergentagent.com/?redirect=' + encodeURIComponent(redirectUrl);
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
          <img src="/logo.png" alt="Linea Pilates" className="h-28 w-auto mix-blend-multiply" data-testid="login-logo" />
        </div>

        <div className="w-full max-w-sm">
          {step === 'phone' && (
            <div className="space-y-5" data-testid="phone-step">
              <div className="text-center mb-2">
                <h1 className="text-xl font-semibold text-[#2C2C2C]">Dobrodosli</h1>
                <p className="text-sm text-[#8B8680] mt-1">Unesite broj telefona za prijavu</p>
              </div>

              <div className="flex gap-2">
                {/* Country code dropdown with flags */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={function() { setShowCodes(!showCodes); setSearchQuery(''); }}
                    className="h-12 px-3 rounded-xl border border-[#E8E2D8] bg-white flex items-center gap-1.5 text-sm text-[#2C2C2C] min-w-[110px]"
                    data-testid="country-code-btn"
                  >
                    <span className="text-lg leading-none">{selectedCountry ? selectedCountry.flag : ''}</span>
                    <span className="font-medium">{countryCode}</span>
                    <ChevronDown className="w-3 h-3 text-[#8B8680] ml-auto" />
                  </button>
                  {showCodes && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-[#E8E2D8] rounded-xl shadow-lg z-50 w-64" data-testid="country-code-dropdown">
                      <div className="p-2 border-b border-[#E8E2D8]">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B8680]" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={function(e) { setSearchQuery(e.target.value); }}
                            placeholder="Pretrazi..."
                            className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E8E2D8] text-sm text-[#2C2C2C] placeholder:text-[#C4BFBA] outline-none focus:border-[#C4A574]"
                            autoFocus
                            data-testid="country-search-input"
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredCodes.map(function(c) {
                          return (
                            <button key={c.country} onClick={function() { setCountryCode(c.code); setShowCodes(false); setSearchQuery(''); }}
                              className={'w-full text-left px-3 py-2.5 text-sm hover:bg-[#F5F0E8] flex items-center gap-2.5 ' + (c.code === countryCode && c.country === (selectedCountry && selectedCountry.country) ? 'bg-[#F5F0E8] font-medium' : '')}
                              data-testid={'country-option-' + c.country}
                            >
                              <span className="text-lg leading-none">{c.flag}</span>
                              <span className="flex-1 truncate">{c.label}</span>
                              <span className="text-[#8B8680] text-xs">{c.code}</span>
                            </button>
                          );
                        })}
                        {filteredCodes.length === 0 && (
                          <div className="px-3 py-4 text-sm text-[#8B8680] text-center">Nema rezultata</div>
                        )}
                      </div>
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
                    placeholder="61 234 567"
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

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E8E2D8]"></div>
                <span className="text-xs text-[#8B8680]">ili</span>
                <div className="flex-1 h-px bg-[#E8E2D8]"></div>
              </div>

              {/* Google Login */}
              <button
                onClick={handleGoogleLogin}
                className="w-full h-12 rounded-xl border border-[#E8E2D8] bg-white hover:bg-[#F5F0E8] flex items-center justify-center gap-3 transition-colors"
                data-testid="google-login-btn"
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
                <span className="text-sm font-medium text-[#2C2C2C]">Prijavi se sa Google</span>
              </button>
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
