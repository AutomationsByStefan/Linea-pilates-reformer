import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

// Pages
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OTPPage from "@/pages/OTPPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import HomePage from "@/pages/HomePage";
import SchedulePage from "@/pages/SchedulePage";
import PackagesPage from "@/pages/PackagesPage";
import ProfilePage from "@/pages/ProfilePage";
import AllMembershipsPage from "@/pages/AllMembershipsPage";
import AllTrainingsPage from "@/pages/AllTrainingsPage";
import WeightTrackingPage from "@/pages/WeightTrackingPage";
import NotificationsPage from "@/pages/NotificationsPage";
import InvitePage from "@/pages/InvitePage";

// Admin Pages
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminSchedulePage from "@/pages/admin/AdminSchedulePage";
import AdminBookingsPage from "@/pages/admin/AdminBookingsPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";

// Components
import Layout from "@/components/Layout";
import AuthCallback from "@/components/AuthCallback";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth context
export const AuthContext = {
  API,
  BACKEND_URL
};

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.user) {
      const u = location.state.user;
      setUser(u);
      setIsAuthenticated(true);
      // Redirect admin to admin dashboard
      if (u.is_admin && !location.pathname.startsWith('/admin')) {
        navigate('/admin');
      }
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await fetch(`${API}/auth/me`, {
          credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Not authenticated');
        
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
        // Redirect admin to admin dashboard if on client page
        if (userData.is_admin && !location.pathname.startsWith('/admin')) {
          navigate('/admin');
          return;
        }
        // Redirect regular user away from admin pages
        if (!userData.is_admin && adminOnly) {
          navigate('/');
          return;
        }
      } catch (error) {
        setIsAuthenticated(false);
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate, location.state, location.pathname, adminOnly]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <img 
            src="https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/jp1fkri2_Untitled%20design%20%285%29.png"
            alt="Linea"
            className="w-36 h-36 object-contain rounded-2xl"
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children({ user, setUser });
};

// App Router with session_id detection
function AppRouter() {
  const location = useLocation();

  // CRITICAL: Check URL fragment for session_id synchronously during render
  // This prevents race conditions by processing new session_id FIRST
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/otp" element={<OTPPage />} />
      <Route path="/uslovi-koristenja" element={<TermsPage />} />
      <Route path="/politika-privatnosti" element={<PrivacyPage />} />
      <Route path="/pozivnica/:inviteId" element={<InvitePage />} />

      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          {({ user, setUser }) => (
            <Layout user={user}>
              <HomePage user={user} />
            </Layout>
          )}
        </ProtectedRoute>
      } />
      
      <Route path="/termini" element={
        <ProtectedRoute>
          {({ user }) => (
            <Layout user={user}>
              <SchedulePage />
            </Layout>
          )}
        </ProtectedRoute>
      } />
      
      <Route path="/paketi" element={
        <ProtectedRoute>
          {({ user }) => (
            <Layout user={user}>
              <PackagesPage />
            </Layout>
          )}
        </ProtectedRoute>
      } />
      
      <Route path="/profil" element={
        <ProtectedRoute>
          {({ user }) => (
            <Layout user={user}>
              <ProfilePage user={user} />
            </Layout>
          )}
        </ProtectedRoute>
      } />

      <Route path="/clanarine" element={
        <ProtectedRoute>
          {({ user }) => (
            <Layout user={user} hideNav>
              <AllMembershipsPage />
            </Layout>
          )}
        </ProtectedRoute>
      } />

      <Route path="/treninzi" element={
        <ProtectedRoute>
          {({ user }) => (
            <Layout user={user} hideNav>
              <AllTrainingsPage />
            </Layout>
          )}
        </ProtectedRoute>
      } />

      <Route path="/tezina" element={
        <ProtectedRoute>
          {({ user }) => (
            <Layout user={user} hideNav>
              <WeightTrackingPage />
            </Layout>
          )}
        </ProtectedRoute>
      } />

      <Route path="/obavjestenja" element={
        <ProtectedRoute>
          {({ user }) => (
            <Layout user={user} hideNav>
              <NotificationsPage />
            </Layout>
          )}
        </ProtectedRoute>
      } />

      {/* Admin routes - use regular user session with is_admin check */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={
        <ProtectedRoute adminOnly><AdminLayout><AdminDashboardPage /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/raspored" element={
        <ProtectedRoute adminOnly><AdminLayout><AdminSchedulePage /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/rezervacije" element={
        <ProtectedRoute adminOnly><AdminLayout><AdminBookingsPage /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/korisnici" element={
        <ProtectedRoute adminOnly><AdminLayout><AdminUsersPage /></AdminLayout></ProtectedRoute>
      } />

      {/* Fallback to login */}
      <Route path="*" element={<LoginPage />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App bg-bone min-h-screen">
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;
