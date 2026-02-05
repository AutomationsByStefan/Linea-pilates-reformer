import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPhone = location.state?.phone || '';

  const [formData, setFormData] = useState({
    phone: initialPhone,
    ime: '',
    prezime: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.phone || !formData.ime || !formData.prezime || !formData.email) {
      toast.error('Sva polja su obavezna');
      return;
    }

    if (!formData.email.includes('@')) {
      toast.error('Unesite ispravnu email adresu');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Greška pri registraciji');
      }

      const userData = await response.json();
      toast.success('Nalog je uspješno kreiran!');
      navigate('/', { state: { user: userData }, replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-container min-h-screen flex flex-col bg-background" data-testid="register-page">
      {/* Header */}
      <header className="flex items-center px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 px-8 pb-12">
        {/* Title */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-heading text-3xl text-foreground mb-2">
            Kreiraj nalog
          </h1>
          <p className="text-muted-foreground">
            Unesite svoje podatke za registraciju
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="animate-slide-up delay-100">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Broj telefona
            </label>
            <Input
              type="tel"
              name="phone"
              placeholder="+387 61 123 456"
              value={formData.phone}
              onChange={handleChange}
              className="input-linea w-full h-14"
              data-testid="register-phone-input"
            />
          </div>

          <div className="animate-slide-up delay-200">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Ime
            </label>
            <Input
              type="text"
              name="ime"
              placeholder="Vaše ime"
              value={formData.ime}
              onChange={handleChange}
              className="input-linea w-full h-14"
              data-testid="register-ime-input"
            />
          </div>

          <div className="animate-slide-up delay-300">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Prezime
            </label>
            <Input
              type="text"
              name="prezime"
              placeholder="Vaše prezime"
              value={formData.prezime}
              onChange={handleChange}
              className="input-linea w-full h-14"
              data-testid="register-prezime-input"
            />
          </div>

          <div className="animate-slide-up delay-400">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Email adresa
            </label>
            <Input
              type="email"
              name="email"
              placeholder="vasa@email.com"
              value={formData.email}
              onChange={handleChange}
              className="input-linea w-full h-14"
              data-testid="register-email-input"
            />
          </div>

          <div className="pt-4 animate-slide-up delay-500">
            <Button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-14 text-lg"
              data-testid="register-submit-btn"
            >
              {loading ? 'Kreiranje...' : 'Kreiraj nalog'}
            </Button>
          </div>
        </form>

        {/* Terms */}
        <p className="text-center text-sm text-muted-foreground mt-6 animate-slide-up delay-500">
          Registracijom prihvatate naše{' '}
          <Link to="/uslovi-koristenja" className="text-primary hover:underline">
            Uslove korištenja
          </Link>
          {' '}i{' '}
          <Link to="/politika-privatnosti" className="text-primary hover:underline">
            Politiku privatnosti
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
