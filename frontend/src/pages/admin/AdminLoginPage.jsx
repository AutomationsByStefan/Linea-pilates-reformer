import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) { setChecking(false); return; }
        const res = await fetch(`${API}/admin/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (res.ok) { navigate('/admin'); return; }
      } catch {}
      setChecking(false);
    };
    checkAdmin();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('admin_token', data.session_token);
        toast.success('Uspješna prijava');
        navigate('/admin');
      } else {
        toast.error(data.detail || 'Pogrešan email ili lozinka');
      }
    } catch {
      toast.error('Greška pri prijavi');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <div className="animate-pulse text-white/50">Učitavanje...</div>
    </div>;
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="admin-email-input"
          />
          <Input
            type="password"
            placeholder="Lozinka"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="admin-password-input"
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#C4A574] hover:bg-[#A68B5B] text-white font-medium"
            data-testid="admin-login-btn"
          >
            {loading ? 'Prijava...' : 'Prijavi se'}
          </Button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          Pristup samo za ovlašteno osoblje
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
