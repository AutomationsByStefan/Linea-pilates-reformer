import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PackagesPage = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [myRequest, setMyRequest] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pkgRes, reqRes] = await Promise.all([
          fetch(`${API}/packages`),
          fetch(`${API}/packages/my-requests`, { credentials: 'include' })
        ]);
        if (pkgRes.ok) setPackages(await pkgRes.json());
        if (reqRes.ok) {
          const reqs = await reqRes.json();
          const pending = reqs.find(r => r.status === 'pending');
          if (pending) setMyRequest(pending);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const handleRequest = async () => {
    if (!selectedPkg) return;
    setRequesting(true);
    try {
      const res = await fetch(`${API}/packages/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ package_id: selectedPkg.id })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setMyRequest({ package_name: selectedPkg.naziv, status: 'pending' });
        setSelectedPkg(null);
      } else {
        toast.error(data.detail);
      }
    } catch { toast.error('Greška pri slanju zahtjeva'); }
    finally { setRequesting(false); }
  };

  return (
    <div className="px-4 pt-4 pb-4" data-testid="packages-page">
      <div className="mb-6 animate-fade-in">
        <h1 className="font-heading text-2xl text-foreground mb-1">Paketi</h1>
        <p className="text-muted-foreground text-sm">Odaberite paket koji vam odgovara</p>
      </div>

      {myRequest && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-4 animate-fade-in" data-testid="pending-request-banner">
          <p className="font-medium text-foreground">Vaš paket čeka aktivaciju nakon uplate</p>
          <p className="text-sm text-muted-foreground mt-1">Paket: {myRequest.package_name}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-secondary/50 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`card-linea relative overflow-hidden transition-all ${pkg.popular ? 'ring-2 ring-primary' : ''}`}
              data-testid="package-card"
            >
              {pkg.popular && (
                <div className="absolute top-0 right-0 bg-primary text-white text-[10px] px-3 py-1 rounded-bl-xl font-medium">
                  Najpopularniji
                </div>
              )}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-heading text-lg text-foreground">{pkg.naziv}</h3>
                  <p className="text-sm text-muted-foreground">{pkg.opis}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{pkg.cijena}</p>
                  <p className="text-xs text-muted-foreground">KM</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary" />
                  <span>{pkg.termini} termina / mjesec</span>
                </div>
                <Button
                  onClick={() => setSelectedPkg(pkg)}
                  disabled={!!myRequest}
                  className={`h-10 rounded-full text-sm px-5 ${pkg.popular ? 'btn-primary' : 'bg-secondary hover:bg-secondary/80 text-foreground'}`}
                  data-testid="select-package-btn"
                >
                  {myRequest ? 'Na čekanju' : 'Odaberi'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedPkg} onOpenChange={() => setSelectedPkg(null)}>
        <DialogContent className="max-w-[90%] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">Potvrda izbora paketa</DialogTitle>
          </DialogHeader>
          {selectedPkg && (
            <div className="py-4 space-y-4">
              <div className="text-center">
                <p className="text-lg font-heading font-semibold text-foreground">{selectedPkg.naziv}</p>
                <p className="text-2xl font-bold text-primary mt-1">{selectedPkg.cijena} KM</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedPkg.termini} termina mjesečno</p>
              </div>
              <p className="text-center text-muted-foreground text-sm">
                Nakon potvrde, vaš paket će čekati aktivaciju od strane studija nakon uplate.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setSelectedPkg(null)} variant="outline" className="flex-1 h-12 rounded-full">
                  Otkaži
                </Button>
                <Button onClick={handleRequest} disabled={requesting} className="flex-1 h-12 rounded-full btn-primary" data-testid="confirm-package-btn">
                  {requesting ? 'Slanje...' : 'Potvrdi izbor'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PackagesPage;
