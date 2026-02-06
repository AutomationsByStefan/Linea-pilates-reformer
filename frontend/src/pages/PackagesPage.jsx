import React, { useState, useEffect } from 'react';
import { Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PackagesPage = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch(`${API}/packages`);
        if (response.ok) {
          const data = await response.json();
          setPackages(data);
        }
      } catch (error) {
        console.error('Error fetching packages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = (pkg) => {
    toast.success(`Paket "${pkg.naziv}" je odabran. Kontaktirajte nas za plaćanje.`);
  };

  return (
    <div className="px-6 pt-6 pb-4" data-testid="packages-page">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="font-heading text-2xl text-foreground mb-2">
          Paketi
        </h1>
        <p className="text-muted-foreground">
          Odaberite paket koji vam odgovara
        </p>
      </div>

      {/* Packages List */}
      <div className="space-y-4">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-linea animate-pulse h-48" />
            ))}
          </>
        ) : (
          packages.map((pkg, index) => (
            <div
              key={pkg.id}
              className={`card-linea relative overflow-hidden animate-slide-up`}
              style={{ animationDelay: `${index * 100}ms` }}
              data-testid="package-card"
            >
              {/* Popular badge */}
              {pkg.popular && (
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                  <Star className="w-3 h-3 fill-current" />
                  Najpopularniji
                </div>
              )}

              {/* Package content */}
              <div className="mb-4">
                <h3 className="font-heading text-xl text-foreground mb-1">
                  {pkg.naziv}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {pkg.opis}
                </p>
              </div>

              {/* Price */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-4xl text-primary">
                    {pkg.cijena}
                  </span>
                  <span className="text-lg text-muted-foreground">
                    {pkg.valuta}
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{pkg.termini} {pkg.termini === 1 ? 'termin' : 'termina'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Važi {pkg.trajanje_dana} dana</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Trening na Reformer-u</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Mala grupa do 3 osobe</span>
                </div>
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => handlePurchase(pkg)}
                className={`w-full h-12 rounded-full font-medium ${
                  pkg.popular 
                    ? 'btn-primary' 
                    : 'btn-outline'
                }`}
                data-testid="purchase-package-btn"
              >
                Odaberi paket
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Note */}
      <div className="mt-6 p-4 bg-secondary/50 rounded-2xl animate-slide-up delay-500">
        <p className="text-sm text-muted-foreground text-center">
          Za plaćanje i dodatne informacije kontaktirajte nas putem telefona ili u studiju.
        </p>
      </div>
    </div>
  );
};

export default PackagesPage;
