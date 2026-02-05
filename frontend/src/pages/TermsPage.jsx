import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="mobile-container min-h-screen bg-background" data-testid="terms-page">
      {/* Header */}
      <header className="sticky top-0 bg-background/90 backdrop-blur-lg border-b border-border/40 px-6 py-4 z-10">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
            data-testid="terms-back-btn"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="font-heading text-xl text-foreground ml-3">
            Uslovi korištenja
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="prose prose-sm max-w-none">
          <p className="text-muted-foreground leading-relaxed mb-6">
            Dobrodošli u Linea Reformer Pilates. Korištenjem naše aplikacije i usluga, 
            prihvatate sljedeće uslove korištenja.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            1. Opći uslovi
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Ovi uslovi korištenja regulišu upotrebu mobilne aplikacije Linea Reformer Pilates 
            i svih povezanih usluga. Pristupom aplikaciji, korisnik potvrđuje da je pročitao, 
            razumio i prihvatio ove uslove.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            2. Rezervacije
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Rezervacije treninga mogu se vršiti putem aplikacije. Korisnici su dužni 
            otkazati rezervaciju najmanje 12 sati prije zakazanog termina. U slučaju 
            nepojavljivanja ili kasnog otkazivanja, termin se odbija sa korisničkog paketa.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            3. Članarine i plaćanja
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Sve članarine su neprenosive i nevraćive osim u izuzetnim okolnostima koje 
            studio procijeni. Cijene paketa su podložne promjenama bez prethodne najave.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            4. Odgovornost
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Korisnici vježbaju na vlastitu odgovornost. Studio ne snosi odgovornost za 
            eventualne povrede nastale tokom treninga. Preporučujemo konsultaciju sa 
            ljekarom prije početka programa vježbanja.
          </p>

          <h2 className="font-heading text-lg text-foreground mt-6 mb-3">
            5. Izmjene uslova
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Linea Reformer Pilates zadržava pravo izmjene ovih uslova u bilo kojem trenutku. 
            Izmjene stupaju na snagu objavljivanjem u aplikaciji.
          </p>

          <p className="text-sm text-muted-foreground mt-8 pt-4 border-t border-border">
            Posljednje ažuriranje: Januar 2026.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
