import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const token = localStorage.getItem('admin_token');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API}/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (res.ok) setUsers(await res.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchUsers();
  }, [token]);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q);
  });

  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()}`;
  };

  return (
    <div data-testid="admin-users-page">
      <h1 className="text-2xl font-bold text-white mb-6">Korisnici</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          placeholder="Pretraži korisnike..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm"
          data-testid="search-users-input"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/40">Nema korisnika</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {/* Desktop header */}
          <div className="hidden lg:grid grid-cols-6 gap-4 px-5 py-3 bg-white/5 border-b border-white/10 text-white/50 text-xs font-medium uppercase tracking-wider">
            <span>Ime</span>
            <span>Email</span>
            <span>Telefon</span>
            <span>Članarina</span>
            <span>Termini</span>
            <span>Registracija</span>
          </div>

          <div className="divide-y divide-white/5">
            {filtered.map((u) => (
              <div key={u.user_id} className="px-5 py-3 hover:bg-white/5 transition-colors" data-testid="user-row">
                {/* Mobile */}
                <div className="lg:hidden space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-sm font-medium">{u.name || 'Bez imena'}</p>
                      <p className="text-white/40 text-xs">{u.email || '-'} {u.phone ? `| ${u.phone}` : ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${u.aktivna_clanarina ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {u.aktivna_clanarina ? `${u.preostali_termini} termina` : 'Neaktivna'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>Predstojeći: {u['predstojeći_treninzi']}</span>
                    <span>Reg: {formatDate(u.created_at)}</span>
                  </div>
                </div>

                {/* Desktop */}
                <div className="hidden lg:grid grid-cols-6 gap-4 items-center">
                  <p className="text-white text-sm">{u.name || 'Bez imena'}</p>
                  <p className="text-white/70 text-sm truncate">{u.email || '-'}</p>
                  <p className="text-white/70 text-sm">{u.phone || '-'}</p>
                  <span className={`text-xs px-2 py-1 rounded-full w-fit ${u.aktivna_clanarina ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {u.aktivna_clanarina ? 'Aktivna' : 'Neaktivna'}
                  </span>
                  <div className="text-sm">
                    <span className="text-white/70">{u.preostali_termini} preostalih</span>
                    <span className="text-white/30 mx-1">|</span>
                    <span className="text-white/50">{u['predstojeći_treninzi']} zakazanih</span>
                  </div>
                  <p className="text-white/50 text-sm">{formatDate(u.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-white/30 text-xs mt-4">Ukupno: {filtered.length} korisnika</p>
    </div>
  );
};

export default AdminUsersPage;
