/**
 * AI Data Analyst - Main App Component
 * Updated routing with enterprise auth system, admin portal, and user account pages.
 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { healthCheck } from './services/api';
import SplashScreen from './components/ui/SplashScreen';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ProtectedAdminRoute from './components/auth/ProtectedAdminRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// ── Public / Auth Pages ────────────────────────────────────────────────────
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';

// ── User Portal Pages ──────────────────────────────────────────────────────
import DashboardHome from './pages/DashboardHome';
import UploadPage from './pages/UploadPage';
import EDAPage from './pages/EDAPage';
import CleaningPage from './pages/CleaningPage';
import VisualizationPage from './pages/VisualizationPage';
import StatisticsPage from './pages/StatisticsPage';
import MLPage from './pages/MLPage';
import AIInsightsPage from './pages/AIInsightsPage';
import FeatureEngineeringPage from './pages/FeatureEngineeringPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/user/ProfilePage';

// ── Admin Portal Pages ─────────────────────────────────────────────────────
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminActivityPage from './pages/admin/AdminActivityPage';
import AdminSessionsPage from './pages/admin/AdminSessionsPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    healthCheck().catch(() => {});
    const timer = setTimeout(() => setShowSplash(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <HashRouter>
      <Toaster
        position="top-center"
        containerStyle={{ left: '120px' }}
        toastOptions={{
          style: {
            background: '#252836',
            color: '#e2e8f0',
            border: '1px solid #3d3f50',
            borderRadius: '16px',
            fontSize: '1.05rem',
            padding: '16px 28px',
            fontWeight: 600,
            minWidth: '340px',
            textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#252836' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#252836' } },
        }}
      />

      <Routes>
        {/* ── Public Routes ──────────────────────────────────────── */}
        <Route path="/" element={<LandingPage />} />

        {/* ── Auth Routes ────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* ── Admin Routes ───────────────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<ProtectedAdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="activity" element={<AdminActivityPage />} />
            <Route path="sessions" element={<AdminSessionsPage />} />
            <Route path="audit" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>

        {/* ── User Protected Routes ──────────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="eda" element={<EDAPage />} />
            <Route path="cleaning" element={<CleaningPage />} />
            <Route path="visualization" element={<VisualizationPage />} />
            <Route path="statistics" element={<StatisticsPage />} />
            <Route path="ml" element={<MLPage />} />
            <Route path="ai-insights" element={<AIInsightsPage />} />
            <Route path="features" element={<FeatureEngineeringPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* ── Fallback ───────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
