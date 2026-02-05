import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="mobile-container min-h-screen bg-background" data-testid="privacy-page">
      {/* Header */}
      <header className="sticky top-0 bg-background/90 backdrop-blur-lg border-b border-border/40 px-6 py-4 z-10">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
            data-testid="privacy-back-btn"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="font-heading text-xl text-foreground ml-3">
            Politika privatnosti
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="prose prose-sm max-w-none">
          <p className="text-muted-foreground leading-relaxed mb-6">
            Vaša privatnost nam je važna. Ova politika objašnjava kako prikupljamo, 
            koristimo i štitimo vaše lične podatke.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            1. Podaci koje prikupljamo
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Prikupljamo podatke koje nam direktno pružite: ime i prezime, broj telefona, 
            email adresu, te podatke o vašim rezervacijama i članarinama.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            2. Kako koristimo vaše podatke
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Vaše podatke koristimo za: upravljanje vašim nalogom, procesiranje rezervacija, 
            slanje obavijesti o terminima, poboljšanje naših usluga i komunikaciju s vama.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            3. Dijeljenje podataka
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Vaše podatke ne dijelimo s trećim stranama osim kada je to neophodno za 
            pružanje naših usluga ili kada to zahtijeva zakon.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            4. Sigurnost podataka
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Koristimo savremene sigurnosne mjere za zaštitu vaših podataka od 
            neovlaštenog pristupa, izmjene ili uništenja.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            5. Vaša prava
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Imate pravo pristupiti svojim podacima, zatražiti ispravku ili brisanje, 
            te povući saglasnost za obradu podataka u bilo kojem trenutku.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            6. Kontakt
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Za sva pitanja vezana za privatnost, kontaktirajte nas na email ili telefon 
            naveden u aplikaciji.
          </p>

          <p className="text-sm text-muted-foreground mt-8 pt-4 border-t border-border">
            Posljednje ažuriranje: Januar 2026.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
