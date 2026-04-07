import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminSchedulePage = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [newSlot, setNewSlot] = useState({ datum: '', vrijeme: '', instruktor: 'Marija Trisic', ukupno_mjesta: 3 });
  const [genDays, setGenDays] = useState(7);
  const [genStartDate, setGenStartDate] = useState(new Date().toISOString().split('T')[0]);
  const token = localStorage.getItem('admin_token');

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/schedule`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (res.ok) setSlots(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSlots(); }, []);

  const handleAddSlot = async () => {
    if (!newSlot.datum || !newSlot.vrijeme || !newSlot.instruktor) {
      toast.error('Popunite sva polja');
      return;
    }
    try {
      const res = await fetch(`${API}/admin/schedule/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(newSlot)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Termin kreiran');
        setShowAddDialog(false);
        setNewSlot({ datum: '', vrijeme: '', instruktor: 'Marija Trisic', ukupno_mjesta: 3 });
        fetchSlots();
      } else {
        toast.error(data.detail);
      }
    } catch { toast.error('Greška'); }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Da li ste sigurni?')) return;
    try {
      const res = await fetch(`${API}/admin/schedule/slots/${slotId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Termin obrisan');
        fetchSlots();
      } else {
        toast.error(data.detail);
      }
    } catch { toast.error('Greška'); }
  };

  const handleGenerate = async () => {
    try {
      const res = await fetch(`${API}/admin/schedule/generate-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ start_date: genStartDate, days: genDays })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowGenerateDialog(false);
        fetchSlots();
      } else {
        toast.error(data.detail);
      }
    } catch { toast.error('Greška'); }
  };

  // Group slots by date
  const groupedSlots = {};
  const filtered = filterDate ? slots.filter(s => s.datum === filterDate) : slots;
  filtered.forEach(s => {
    if (!groupedSlots[s.datum]) groupedSlots[s.datum] = [];
    groupedSlots[s.datum].push(s);
  });
  const sortedDates = Object.keys(groupedSlots).sort();

  const formatDate = (d) => {
    const date = new Date(d + 'T00:00:00');
    const days = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
    return `${days[date.getDay()]} ${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()}`;
  };

  const instructors = ['Marija Trisic'];

  return (
    <div data-testid="admin-schedule-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Raspored</h1>
        <div className="flex gap-2 flex-wrap">
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-10 bg-white/10 border-white/20 text-white text-sm w-40"
            data-testid="filter-date-input"
          />
          {filterDate && (
            <Button variant="ghost" onClick={() => setFilterDate('')} className="h-10 text-white/60 text-sm">
              Poništi filter
            </Button>
          )}
          <Button onClick={() => setShowGenerateDialog(true)} className="h-10 bg-white/10 text-white hover:bg-white/20 text-sm" data-testid="generate-week-btn">
            <RefreshCw className="w-4 h-4 mr-2" /> Generiši dane
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="h-10 bg-[#C4A574] hover:bg-[#A68B5B] text-white text-sm" data-testid="add-slot-btn">
            <Plus className="w-4 h-4 mr-2" /> Dodaj termin
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          Nema termina{filterDate ? ' za odabrani datum' : ''}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-white/5 border-b border-white/10">
                <p className="text-white font-semibold text-sm">{formatDate(date)}</p>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {groupedSlots[date].sort((a,b) => a.vrijeme.localeCompare(b.vrijeme)).map(slot => (
                  <div key={slot.id} className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col" data-testid="admin-slot-card">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-white font-bold text-lg">{slot.vrijeme}</p>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="text-red-400/60 hover:text-red-400 transition-colors" data-testid="delete-slot-btn">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-white/50 text-xs mb-1">{slot.instruktor}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <span className={`text-xs font-medium ${slot.slobodna_mjesta === 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {slot.slobodna_mjesta}/{slot.ukupno_mjesta} mjesta
                      </span>
                      {slot.zauzeto > 0 && (
                        <span className="text-xs text-amber-400">{slot.zauzeto} rez.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Slot Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Novi termin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-white/60 text-sm mb-1 block">Datum</label>
              <Input type="date" value={newSlot.datum} onChange={e => setNewSlot({...newSlot, datum: e.target.value})}
                className="h-10 bg-white/10 border-white/20 text-white" data-testid="new-slot-date" />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Vrijeme</label>
              <Input type="time" value={newSlot.vrijeme} onChange={e => setNewSlot({...newSlot, vrijeme: e.target.value})}
                className="h-10 bg-white/10 border-white/20 text-white" data-testid="new-slot-time" />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Instruktor</label>
              <select value={newSlot.instruktor} onChange={e => setNewSlot({...newSlot, instruktor: e.target.value})}
                className="w-full h-10 rounded-md bg-white/10 border border-white/20 text-white px-3 text-sm" data-testid="new-slot-instructor">
                {instructors.map(i => <option key={i} value={i} className="bg-[#1a1a2e]">{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Broj mjesta</label>
              <Input type="number" min={1} max={10} value={newSlot.ukupno_mjesta}
                onChange={e => setNewSlot({...newSlot, ukupno_mjesta: parseInt(e.target.value) || 3})}
                className="h-10 bg-white/10 border-white/20 text-white" data-testid="new-slot-spots" />
            </div>
            <Button onClick={handleAddSlot} className="w-full h-11 bg-[#C4A574] hover:bg-[#A68B5B] text-white" data-testid="confirm-add-slot-btn">
              Kreiraj termin
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Generiši raspored</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-white/50 text-sm">Automatski kreiraj termine za odabrani period (8 termina dnevno: 09-12h i 16-19h).</p>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Početni datum</label>
              <Input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)}
                className="h-10 bg-white/10 border-white/20 text-white" data-testid="gen-start-date" />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Broj dana</label>
              <Input type="number" min={1} max={60} value={genDays} onChange={e => setGenDays(parseInt(e.target.value) || 7)}
                className="h-10 bg-white/10 border-white/20 text-white" data-testid="gen-days" />
            </div>
            <Button onClick={handleGenerate} className="w-full h-11 bg-[#C4A574] hover:bg-[#A68B5B] text-white" data-testid="confirm-generate-btn">
              Generiši
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSchedulePage;
