import React, { useState } from 'react';
import { Send, Clock, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { SectionCard } from './SectionCard';
import { AlertTriangle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

function buildDefaultMessage(item) {
  const name = item.korisnik?.name || 'klijent';
  if (item.preostali_termini !== undefined && item.preostali_termini <= 2 && !item._isExpiring) {
    return {
      title: 'Vrijeme za obnovu paketa',
      message: `Pozdrav ${name}! Imate još ${item.preostali_termini} ${item.preostali_termini === 1 ? 'termin' : 'termina'} u trenutnom paketu. Obnovite članarinu i nastavite svoju Pilates rutinu.`,
    };
  }
  return {
    title: 'Vaša članarina uskoro ističe',
    message: `Pozdrav ${name}! Vaša Linea Pilates članarina ističe ${formatDate(item.datum_isteka)}. Obnovite paket i nastavite tamo gdje ste stali.`,
  };
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('bs-BA');
}

function ClientRow({ item, kind, onSend }) {
  const isLow = kind === 'low';
  const Icon = isLow ? Activity : Clock;
  const accent = isLow ? 'text-orange-400' : 'text-amber-400';
  const detail = isLow
    ? `Preostalo ${item.preostali_termini} ${item.preostali_termini === 1 ? 'termin' : 'termina'}`
    : `Ističe ${formatDate(item.datum_isteka)}`;

  return (
    <div className="bg-white/5 hover:bg-white/[0.07] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2 transition" data-testid="renewal-alert-row">
      <div className={'w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 ' + accent}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{item.korisnik?.name || 'Nepoznat'}</p>
        <p className={'text-[10px] truncate ' + accent}>{detail}</p>
      </div>
      <p className="text-white/40 text-[10px] sm:mr-2 truncate">{item.korisnik?.phone || ''}</p>
      <Button
        onClick={onSend}
        size="sm"
        className="h-8 bg-[#C4A574] hover:bg-[#A68B5B] text-white text-[11px] px-3"
        data-testid="send-renewal-btn"
      >
        <Send className="w-3 h-3 mr-1" /> Pošalji obnovu
      </Button>
    </div>
  );
}

export function RenewalAlerts({ expiring, lowSessions }) {
  const [dialogItem, setDialogItem] = useState(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const total = expiring.length + lowSessions.length;
  if (total === 0) return null;

  function openDialog(item, kind) {
    const enriched = { ...item, _isExpiring: kind === 'expiring' };
    const defaults = buildDefaultMessage(enriched);
    setDialogItem(enriched);
    setTitle(defaults.title);
    setMessage(defaults.message);
  }

  function handleSend() {
    if (!dialogItem || !dialogItem.user_id) return;
    if (!title.trim() || !message.trim()) {
      toast.error('Naslov i poruka su obavezni');
      return;
    }
    setSending(true);
    fetch(API + '/admin/send-notification', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: dialogItem.user_id, title, message }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((r) => {
        if (r.ok) {
          toast.success(r.data.message || 'Notifikacija poslana');
          setDialogItem(null);
        } else {
          toast.error(r.data.detail || 'Greška');
        }
      })
      .catch(() => toast.error('Greška'))
      .finally(() => setSending(false));
  }

  return (
    <>
      <SectionCard
        title={`Klijenti za obnovu (${total})`}
        icon={AlertTriangle}
        accent="amber"
        testId="renewal-alerts-section"
      >
        <div className="space-y-2">
          {expiring.map((item) => (
            <ClientRow
              key={'exp-' + (item.id || item.user_id)}
              item={item}
              kind="expiring"
              onSend={() => openDialog(item, 'expiring')}
            />
          ))}
          {lowSessions.map((item) => (
            <ClientRow
              key={'low-' + (item.id || item.user_id)}
              item={item}
              kind="low"
              onSend={() => openDialog(item, 'low')}
            />
          ))}
        </div>
      </SectionCard>

      <Dialog open={!!dialogItem} onOpenChange={(o) => { if (!o) setDialogItem(null); }}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Pošalji notifikaciju za obnovu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dialogItem && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white text-xs font-medium">{dialogItem.korisnik?.name || 'Nepoznat'}</p>
                <p className="text-white/40 text-[10px]">{dialogItem.korisnik?.phone || ''}</p>
              </div>
            )}
            <div>
              <label className="text-white/60 text-xs mb-1 block">Naslov</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 bg-white/10 border-white/20 text-white"
                data-testid="renewal-title-input"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">Poruka</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-md bg-white/10 border border-white/20 text-white px-3 py-2 text-sm"
                data-testid="renewal-message-input"
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full h-11 bg-[#C4A574] hover:bg-[#A68B5B] text-white"
              data-testid="confirm-send-renewal-btn"
            >
              <Send className="w-4 h-4 mr-2" /> {sending ? 'Šaljem...' : 'Pošalji notifikaciju'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RenewalAlerts;
