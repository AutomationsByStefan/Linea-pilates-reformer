import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AllMembershipsPage = () => {
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const response = await fetch(`${API}/memberships`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setMemberships(data);
        }
      } catch (error) {
        console.error('Error fetching memberships:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberships();
  }, []);

  const activeMemberships = memberships.filter(m => m.tip === 'aktivna');
  const pastMemberships = memberships.filter(m => m.tip === 'prethodna');

  return (
    <div className="min-h-screen bg-background" data-testid="all-memberships-page">
      {/* Header */}
      <header className="sticky top-0 bg-background/90 backdrop-blur-lg border-b border-border/40 px-6 py-4 z-10">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
            data-testid="memberships-back-btn"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="font-heading text-xl text-foreground ml-3">
            Tvoje članarine
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-6">
        {/* Active Memberships */}
        <section className="mb-8">
          <h2 className="font-heading text-lg text-foreground mb-4">
            Aktivne članarine
          </h2>
          
          {loading ? (
            <div className="card-linea animate-pulse h-24" />
          ) : activeMemberships.length > 0 ? (
            <div className="space-y-3">
              {activeMemberships.map((membership) => (
                <div
                  key={membership.id}
                  className="card-linea"
                  data-testid="active-membership-card"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-foreground mb-1">
                        {membership.naziv}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Preostalo: <span className="text-primary font-semibold">{membership.preostali_termini}/{membership.ukupni_termini}</span> termina
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Aktivna
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Ističe: {new Date(membership.datum_isteka).toLocaleDateString('bs-BA')}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full gradient-gold rounded-full transition-all duration-500"
                      style={{ width: `${(membership.preostali_termini / membership.ukupni_termini) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-linea text-center py-8">
              <p className="text-muted-foreground">Nemate aktivnih članarina</p>
            </div>
          )}
        </section>

        {/* Past Memberships */}
        <section>
          <h2 className="font-heading text-lg text-foreground mb-4">
            Prethodne članarine
          </h2>
          
          {loading ? (
            <div className="card-linea animate-pulse h-24" />
          ) : pastMemberships.length > 0 ? (
            <div className="space-y-3">
              {pastMemberships.map((membership) => (
                <div
                  key={membership.id}
                  className="card-linea opacity-70"
                  data-testid="past-membership-card"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-foreground mb-1">
                        {membership.naziv}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Iskorišteno: {membership.ukupni_termini - membership.preostali_termini}/{membership.ukupni_termini} termina
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                      Istekla
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-linea text-center py-8">
              <p className="text-muted-foreground">Nemate prethodnih članarina</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AllMembershipsPage;
