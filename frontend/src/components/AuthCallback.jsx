import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use useRef for the processed flag - prevents race conditions under StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          console.error('No session_id found in URL');
          navigate('/login');
          return;
        }

        const sessionId = sessionIdMatch[1];

        // Exchange session_id for session data
        const response = await fetch(`${API}/auth/session`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          }
        });

        if (!response.ok) {
          throw new Error('Failed to authenticate');
        }

        const userData = await response.json();

        // Clear the hash from URL and redirect to dashboard with user data
        window.history.replaceState(null, '', '/');
        navigate('/', { state: { user: userData }, replace: true });

      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login');
      }
    };

    processAuth();
  }, [navigate, location.hash]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-32 h-32 bg-black rounded-2xl flex items-center justify-center mb-4">
          <img 
            src="https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png"
            alt="Linea Reformer Pilates"
            className="w-28 h-28 object-contain"
          />
        </div>
        <p className="text-muted-foreground font-body">Prijava u toku...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
