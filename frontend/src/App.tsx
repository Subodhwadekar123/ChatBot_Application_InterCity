/**
 * InterCity Property Chatbot Application - Main Entry
 * Single unified application for all users (no admin portal).
 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { healthCheck } from './services/api';
import SplashScreen from './components/ui/SplashScreen';
import DashboardLayout from './components/layout/DashboardLayout';

// ── User Portal Pages ──────────────────────────────────────────────────────
import PropertyChatPage from './pages/user/PropertyChatPage';


function App() {
  const [showSplash, setShowSplash] = useState(() => {
    const isFirstVisit = !localStorage.getItem('intercity_splash_seen');
    const isHome = !window.location.hash || window.location.hash === '#' || window.location.hash === '#/';
    return isFirstVisit && isHome;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  useEffect(() => {
    if (!showSplash) return;
    localStorage.setItem('intercity_splash_seen', 'true');
    healthCheck().catch(() => {});
    const timer = setTimeout(() => setShowSplash(false), 8000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  if (showSplash) return <SplashScreen />;

  return (
    <HashRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            fontSize: '13.5px',
            padding: '12px 20px',
            fontWeight: 600,
            boxShadow: 'var(--shadow-lg)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
        }}
      />

      <Routes>
        {/* ── Public Chatbot Dashboard ───────────────────────────── */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<PropertyChatPage />} />
        </Route>

        {/* ── Redirect all auth/legacy routes to / ────────────────── */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/" replace />} />
        <Route path="/reset-password" element={<Navigate to="/" replace />} />
        <Route path="/verify-email" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/dashboard/profile" element={<Navigate to="/" replace />} />

        {/* ── Fallback ───────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
