import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, MinusCircle, Snowflake, Sun,
  FileText, Plus, Activity, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { StatCard } from './components/StatCard';
import { SectionCard } from './components/SectionCard';
import { ClientProfileHeader } from './components/ClientProfileHeader';
import { ClientMembershipDetail } from './components/ClientMembershipDetail';
import { ClientHistoryLists } from './components/ClientHistoryLists';
import { FreezeDialog, NotesDialog, CustomMembershipDialog } from './AdminUserDialogs';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

function AdminClientProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState({ memberships: [], requests: [] });
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [freezeOpen, setFreezeOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeEnd, setFreezeEnd] = useState('');
  const [noteText, setNoteText] = useState('');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [customForm, setCustomForm] = useState({ naziv: '', cijena: '', termini: '', trajanje_dana: '30' });

  function fetchUser() {
    Promise.all([
      fetch(API + '/admin/users', { credentials: 'include' }),
      fetch(API + '/admin/users/' + userId + '/membership-history', { credentials: 'include' }),
      fetch(API + '/admin/packages', { credentials: 'include' }),
    ])
      .then(async (results) => {
        if (results[0].ok) {
          const allUsers = await results[0].json();
          const found = allUsers.find((u) => u.user_id === userId);
          setUser(found || null);
        }
        if (results[1].ok) setHistory(await results[1].json());
        if (results[2].ok) setPackages(await results[2].json());
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUser(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function callJson(url, options) {
    setActionLoading(true);
    return fetch(url, { credentials: 'include', ...options })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((r) => {
        if (r.ok) { toast.success(r.data.message); fetchUser(); return true; }
        toast.error(r.data.detail || 'Greška');
        return false;
      })
      .catch(() => { toast.error('Greška'); return false; })
      .finally(() => setActionLoading(false));
  }

  const handleDeduct = () =>
    callJson(API + '/admin/users/' + userId + '/deduct-session', { method: 'POST' });

  const handleUnfreeze = () =>
    callJson(API + '/admin/users/' + userId + '/unfreeze', { method: 'POST' });

  const handleFreeze = async () => {
    if (!freezeStart || !freezeEnd) { toast.error('Popunite datume'); return; }
    const ok = await callJson(API + '/admin/users/' + userId + '/freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: freezeStart, end_date: freezeEnd }),
    });
    if (ok) setFreezeOpen(false);
  };

  const handleSaveNotes = async () => {
    const ok = await callJson(API + '/admin/users/' + userId + '/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: noteText }),
    });
    if (ok) setNotesOpen(false);
  };

  const handleCreateCustom = async () => {
    let body;
    if (selectedPkg) {
      const pkg = packages.find((p) => p.id === selectedPkg);
      if (!pkg) { toast.error('Paket nije pronađen'); return; }
      body = { user_id: userId, package_id: pkg.id, naziv: pkg.naziv, cijena: pkg.cijena, termini: pkg.termini, trajanje_dana: pkg.trajanje_dana || 30 };
    } else {
      if (!customForm.naziv || !customForm.cijena || !customForm.termini) { toast.error('Popunite sva polja'); return; }
      body = {
        user_id: userId, package_id: 'custom',
        naziv: customForm.naziv, cijena: parseFloat(customForm.cijena),
        termini: parseInt(customForm.termini, 10), trajanje_dana: parseInt(customForm.trajanje_dana, 10) || 30,
      };
    }
    const ok = await callJson(API + '/admin/users/' + userId + '/custom-membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (ok) {
      setCustomOpen(false);
      setSelectedPkg('');
      setCustomForm({ naziv: '', cijena: '', termini: '', trajanje_dana: '30' });
    }
  };

  if (loading) {
    return (
      <div data-testid="admin-client-profile">
        <div className="h-8 bg-white/5 rounded w-48 mb-6 animate-pulse" />
        <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div data-testid="admin-client-profile" className="text-center py-16">
        <p className="text-white/50">Korisnik nije pronađen</p>
        <Button onClick={() => navigate('/admin/korisnici')} variant="ghost" className="mt-4 text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Nazad
        </Button>
      </div>
    );
  }

  const totalUsed = history.memberships.reduce(
    (sum, m) => sum + ((m.ukupno_termina || m.ukupni_termini || 0) - (m.preostali_termini || 0)),
    0
  );
  const totalSpent = history.requests
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + (r.package_price || 0), 0);
  const activePackages = packages.filter((p) => p.active !== false);
  const remainingValue = (user.preostali_termini || 0) + '/' + (user.ukupni_termini || 0);
  const totalSpentValue = totalSpent + ' KM';

  return (
    <div className="space-y-6" data-testid="admin-client-profile">
      <button
        onClick={() => navigate('/admin/korisnici')}
        className="text-white/50 hover:text-white text-xs flex items-center gap-1"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4" /> Svi korisnici
      </button>

      <ClientProfileHeader user={user} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard testId="profile-stat-package" icon={CreditCard} accent="gold" label="Trenutni paket" value={user.naziv_paketa || '-'} />
        <StatCard testId="profile-stat-remaining" icon={Activity} accent="emerald" label="Preostalo termina" value={remainingValue} />
        <StatCard testId="profile-stat-used" icon={Award} accent="blue" label="Iskorišteno (ukupno)" value={totalUsed} />
        <StatCard testId="profile-stat-spent" icon={CreditCard} accent="purple" label="Ukupno potrošeno" value={totalSpentValue} />
      </div>

      <ClientMembershipDetail user={user} />

      {!user.disable_actions && (
        <SectionCard title="Akcije" icon={Activity} accent="emerald" testId="actions-section">
          <div className="flex flex-wrap gap-2">
            {user.membership_status === 'aktivna' && user.preostali_termini > 0 && (
              <Button onClick={handleDeduct} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white text-xs" data-testid="deduct-session-btn">
                <MinusCircle className="w-3 h-3 mr-1" /> Oduzmi termin
              </Button>
            )}
            {user.membership_status === 'aktivna' && (
              <Button onClick={() => { setFreezeStart(''); setFreezeEnd(''); setFreezeOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white text-xs" data-testid="freeze-btn">
                <Snowflake className="w-3 h-3 mr-1" /> Zamrzni
              </Button>
            )}
            {user.membership_status === 'zamrznuta' && (
              <Button onClick={handleUnfreeze} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs" data-testid="unfreeze-btn">
                <Sun className="w-3 h-3 mr-1" /> Odmrzni
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectedPkg('');
                setCustomForm({ naziv: '', cijena: '', termini: '', trajanje_dana: '30' });
                setCustomOpen(true);
              }}
              className="bg-[#C4A574] hover:bg-[#A68B5B] text-white text-xs"
              data-testid="custom-membership-btn"
            >
              <Plus className="w-3 h-3 mr-1" /> Dodaj članarinu
            </Button>
            <Button
              onClick={() => { setNoteText(user.notes || ''); setNotesOpen(true); }}
              variant="ghost"
              className="text-white/70 hover:bg-white/5 text-xs"
              data-testid="notes-btn"
            >
              <FileText className="w-3 h-3 mr-1" /> Bilješka
            </Button>
          </div>
        </SectionCard>
      )}

      <ClientHistoryLists memberships={history.memberships} requests={history.requests} />

      <FreezeDialog
        open={freezeOpen}
        user={user}
        freezeStart={freezeStart}
        freezeEnd={freezeEnd}
        setFreezeStart={setFreezeStart}
        setFreezeEnd={setFreezeEnd}
        onClose={() => setFreezeOpen(false)}
        onConfirm={handleFreeze}
        loading={actionLoading}
      />
      <NotesDialog
        open={notesOpen}
        user={user}
        noteText={noteText}
        setNoteText={setNoteText}
        onClose={() => setNotesOpen(false)}
        onSave={handleSaveNotes}
        loading={actionLoading}
      />
      <CustomMembershipDialog
        open={customOpen}
        user={user}
        selectedPkg={selectedPkg}
        setSelectedPkg={setSelectedPkg}
        packages={activePackages}
        customForm={customForm}
        setCustomForm={setCustomForm}
        onClose={() => setCustomOpen(false)}
        onConfirm={handleCreateCustom}
        loading={actionLoading}
      />
    </div>
  );
}

export default AdminClientProfilePage;
