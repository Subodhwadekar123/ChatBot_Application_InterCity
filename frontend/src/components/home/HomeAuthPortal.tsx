import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Shield, Mail, Lock, User, Eye, EyeOff, Loader2,
  Sparkles, ArrowRight, CheckCircle2, AlertCircle,
  Settings, LogIn, UserPlus, Zap, Database, Activity, LogOut
} from 'lucide-react';
import { useStore, AuthUser } from '../../store/useStore';
import { loginUser, registerUser } from '../../services/authApi';
import { getApiBaseUrl, setCustomApiUrl } from '../../utils/apiUrl';

interface HomeAuthPortalProps {
  onSuccess?: () => void;
}

export const HomeAuthPortal: React.FC<HomeAuthPortalProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { user, token, setUser, setToken, setSessionId, logout } = useStore();

  // Active portal tab: 'user' | 'admin'
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  
  // User sub-mode: 'login' | 'register'
  const [userMode, setUserMode] = useState<'login' | 'register'>('login');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(() => {
    return localStorage.getItem('custom_api_url') || getApiBaseUrl();
  });

  // Switch tab & reset state
  const handleTabChange = (tab: 'user' | 'admin') => {
    setActiveTab(tab);
    setError('');
    if (tab === 'admin') {
      setEmail('admin@infinitics.ai');
      setPassword('SubodhW@7116');
    } else {
      setEmail('');
      setPassword('');
    }
  };

  // Submit Handler for User or Admin Login / Register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (activeTab === 'user' && userMode === 'register' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading(
      activeTab === 'admin'
        ? 'Verifying Administrator credentials...'
        : userMode === 'register'
        ? 'Creating your account...'
        : 'Authenticating analyst session...'
    );

    try {
      if (activeTab === 'user' && userMode === 'register') {
        const res = await registerUser({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
        });
        toast.dismiss(toastId);
        toast.success('Registration successful! Please log in.');
        setUserMode('login');
        setPassword('');
        setLoading(false);
        return;
      }

      // Login (User or Admin)
      const res = await loginUser({
        email: email.trim(),
        password,
        remember_me: rememberMe,
      });

      if (activeTab === 'admin' && !res.user.is_admin && res.user.role !== 'admin') {
        toast.dismiss(toastId);
        setError('Access denied: This account does not possess System Administrator privileges.');
        setLoading(false);
        return;
      }

      setToken(res.access_token);
      setSessionId(res.session_id);
      setUser(res.user as AuthUser);

      toast.dismiss(toastId);
      toast.success(
        activeTab === 'admin'
          ? `Welcome to Admin Center, ${res.user.full_name || 'Admin'}!`
          : `Welcome back, ${res.user.full_name || res.user.email}!`
      );

      if (onSuccess) onSuccess();

      if (activeTab === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard/upload');
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      setError(err.message || 'Authentication failed. Please check credentials or server status.');
    } finally {
      setLoading(false);
    }
  };

  // Instant Demo Mode Launchers (Work 100% even without a live backend)
  const handleLaunchUserDemo = () => {
    const demoUser: AuthUser = {
      id: 'demo-analyst-001',
      email: 'analyst.demo@infinitics.ai',
      username: 'demouser',
      full_name: 'Demo Data Analyst',
      role: 'user',
      is_admin: false,
      is_active: true,
      is_verified: true,
      created_at: new Date().toISOString(),
      login_count: 1,
    };
    setToken('demo-token-offline-analyst-' + Date.now());
    setSessionId('demo-session-001');
    setUser(demoUser);
    toast.success('🚀 Entered Analyst Workspace (Demo Mode)!');
    if (onSuccess) onSuccess();
    navigate('/dashboard/upload');
  };

  const handleLaunchAdminDemo = () => {
    const demoAdmin: AuthUser = {
      id: 'demo-admin-001',
      email: 'admin@infinitics.ai',
      username: 'admin',
      full_name: 'Lead System Administrator',
      role: 'admin',
      is_admin: true,
      is_active: true,
      is_verified: true,
      created_at: new Date().toISOString(),
      login_count: 42,
    };
    setToken('demo-token-offline-admin-' + Date.now());
    setSessionId('demo-session-admin-001');
    setUser(demoAdmin);
    toast.success('🛡️ Entered Admin Control Panel (Demo Mode)!');
    if (onSuccess) onSuccess();
    navigate('/admin/dashboard');
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiUrl(apiUrlInput.trim() || null);
    setShowApiModal(false);
    toast.success('API Base URL updated!');
  };

  // ──────────────────────────────────────────────────────────────────────────
  // If User is Already Authenticated: Render Welcome & Direct Access Card
  // ──────────────────────────────────────────────────────────────────────────
  if (token && user) {
    return (
      <div
        style={{
          background: 'rgba(20, 24, 39, 0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.15)',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: user.is_admin || user.role === 'admin'
                ? 'linear-gradient(135deg, #7c3aed, #d97706)'
                : 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '20px',
              color: 'white',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'white' }}>
                {user.full_name || 'Active User'}
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: user.is_admin || user.role === 'admin' ? 'rgba(217, 119, 6, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                  color: user.is_admin || user.role === 'admin' ? '#fbbf24' : '#818cf8',
                  border: user.is_admin || user.role === 'admin' ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
                }}
              >
                {user.is_admin || user.role === 'admin' ? '🛡️ ADMIN' : '📊 ANALYST'}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {user.email}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => navigate('/dashboard/upload')}
            style={{
              padding: '14px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              fontWeight: 700,
              fontSize: '15px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} /> Open Analytics Workspace
            </span>
            <ArrowRight size={18} />
          </button>

          {(user.is_admin || user.role === 'admin') && (
            <button
              onClick={() => navigate('/admin/dashboard')}
              style={{
                padding: '14px 20px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #7c3aed, #d97706)',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(124, 58, 237, 0.35)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} /> Admin Control Center
              </span>
              <ArrowRight size={18} />
            </button>
          )}

          <button
            onClick={() => navigate('/dashboard/eda')}
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="#38bdf8" /> Explore Auto-EDA & ML Models
            </span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => {
              logout();
              toast.success('Signed out.');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogOut size={14} /> Sign Out / Switch User
          </button>

          <button
            type="button"
            onClick={() => setShowApiModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Settings size={13} /> API Config
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Main Dual-Portal Login & Registration Card
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: 'rgba(17, 21, 34, 0.95)',
        backdropFilter: 'blur(24px)',
        border: activeTab === 'admin' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: activeTab === 'admin'
          ? '0 24px 60px rgba(0,0,0,0.7), 0 0 50px rgba(168,85,247,0.18)'
          : '0 24px 60px rgba(0,0,0,0.7), 0 0 50px rgba(99,102,241,0.18)',
        maxWidth: '460px',
        width: '100%',
        textAlign: 'left',
        position: 'relative',
        zIndex: 10,
        boxSizing: 'border-box',
      }}
    >
      {/* ── Main Tab Header: User Portal vs Admin Portal ───────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(0,0,0,0.35)',
          borderRadius: '14px',
          padding: '4px',
          marginBottom: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('user')}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            background: activeTab === 'user' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
            color: activeTab === 'user' ? 'white' : '#94a3b8',
            boxShadow: activeTab === 'user' ? '0 4px 12px rgba(79,70,229,0.4)' : 'none',
          }}
        >
          <User size={15} /> User Portal
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('admin')}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            background: activeTab === 'admin' ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'transparent',
            color: activeTab === 'admin' ? 'white' : '#94a3b8',
            boxShadow: activeTab === 'admin' ? '0 4px 12px rgba(124,58,237,0.4)' : 'none',
          }}
        >
          <Shield size={15} /> Admin Control
        </button>
      </div>

      {/* ── Subtitle / Security Badge ──────────────────────────────────────── */}
      <div style={{ marginBottom: '18px' }}>
        {activeTab === 'user' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'white' }}>
                {userMode === 'login' ? 'Analyst Sign In' : 'Create Free Account'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Access automated EDA, charts & ML models
              </p>
            </div>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => { setUserMode('login'); setError(''); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: userMode === 'login' ? 'rgba(99,102,241,0.3)' : 'transparent',
                  color: userMode === 'login' ? '#c7d2fe' : '#64748b',
                }}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { setUserMode('register'); setError(''); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: userMode === 'register' ? 'rgba(99,102,241,0.3)' : 'transparent',
                  color: userMode === 'register' ? '#c7d2fe' : '#64748b',
                }}
              >
                Register
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f5f3ff' }}>
                Admin Control Center
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#c4b5fd' }}>
                System diagnostics, telemetry & user management
              </p>
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '8px',
                background: 'rgba(217, 119, 6, 0.2)',
                color: '#fbbf24',
                border: '1px solid rgba(217, 119, 6, 0.4)',
                letterSpacing: '0.04em',
              }}
            >
              RESTRICTED
            </span>
          </div>
        )}
      </div>

      {/* ── Error Banner ───────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '12px', color: '#fca5a5', lineHeight: 1.4 }}>{error}</span>
        </motion.div>
      )}

      {/* ── Form Inputs ────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {activeTab === 'user' && userMode === 'register' && (
          <div>
            <label style={labelStyle}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={15} color="#64748b" style={inputIconStyle} />
              <input
                type="text"
                placeholder="Dr. Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ ...inputStyle, paddingLeft: '38px' }}
              />
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>
            {activeTab === 'admin' ? 'Administrator Email' : 'Email Address'}
          </label>
          <div style={{ position: 'relative' }}>
            <Mail size={15} color="#64748b" style={inputIconStyle} />
            <input
              type="email"
              placeholder={activeTab === 'admin' ? 'admin@infinitics.ai' : 'analyst@company.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ ...inputStyle, paddingLeft: '38px' }}
            />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
            {activeTab === 'user' && userMode === 'login' && (
              <Link to="/forgot-password" style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'none' }}>
                Forgot?
              </Link>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={15} color="#64748b" style={inputIconStyle} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ ...inputStyle, paddingLeft: '38px', paddingRight: '38px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* ── Quick Autofill Buttons ───────────────────────────────────────── */}
        <div
          style={{
            background: activeTab === 'admin' ? 'rgba(168, 85, 247, 0.08)' : 'rgba(99, 102, 241, 0.08)',
            border: activeTab === 'admin' ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: activeTab === 'admin' ? '#d8b4fe' : '#c7d2fe', fontWeight: 600 }}>
              {activeTab === 'admin' ? 'Admin Default Account' : 'Demo Analyst Account'}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              {activeTab === 'admin' ? 'admin@infinitics.ai' : 'user@infinitics.ai'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'admin') {
                setEmail('admin@infinitics.ai');
                setPassword('SubodhW@7116');
              } else {
                setEmail('user@infinitics.ai');
                setPassword('Analyst@2026');
                setUserMode('login');
              }
              toast.success(`${activeTab === 'admin' ? 'Admin' : 'Analyst'} credentials autofilled!`);
            }}
            style={{
              background: activeTab === 'admin' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(99, 102, 241, 0.25)',
              border: activeTab === 'admin' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
              color: activeTab === 'admin' ? '#f3e8ff' : '#e0e7ff',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Auto-Fill
          </button>
        </div>

        {/* ── Primary Submit Button ────────────────────────────────────────── */}
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
          style={{
            padding: '13px',
            background: activeTab === 'admin'
              ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
              : 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: activeTab === 'admin'
              ? '0 6px 20px rgba(124, 58, 237, 0.45)'
              : '0 6px 20px rgba(79, 70, 229, 0.45)',
            marginTop: '2px',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              {activeTab === 'admin' ? 'Authenticating Admin...' : 'Connecting...'}
            </>
          ) : (
            <>
              {activeTab === 'admin' ? <Shield size={16} /> : userMode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />}
              {activeTab === 'admin'
                ? 'Access Admin Control Panel'
                : userMode === 'register'
                ? 'Create Analyst Account'
                : 'Sign In to Workspace'}
            </>
          )}
        </motion.button>
      </form>

      {/* ── Instant Demo Quick-Launch Divider ──────────────────────────────── */}
      <div style={{ position: 'relative', textAlign: 'center', margin: '18px 0 14px' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', position: 'absolute', top: '50%', left: 0, right: 0 }} />
        <span style={{ background: '#111522', padding: '0 10px', fontSize: '11px', color: '#64748b', position: 'relative', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Instant Workspace Access
        </span>
      </div>

      {/* ── 1-Click Launch in Demo Mode Button ──────────────────────────────── */}
      <button
        type="button"
        onClick={activeTab === 'admin' ? handleLaunchAdminDemo : handleLaunchUserDemo}
        style={{
          width: '100%',
          padding: '11px 16px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#e2e8f0',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
        }}
      >
        <Zap size={15} color="#fbbf24" />
        {activeTab === 'admin'
          ? '⚡ Launch Admin Center (Instant Demo)'
          : '⚡ Launch Analyst Workspace (Instant Demo)'}
      </button>

      {/* ── Footer Info & API Config Modal Trigger ─────────────────────────── */}
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#64748b',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Render & Localhost Ready
        </span>

        <button
          type="button"
          onClick={() => setShowApiModal(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#818cf8',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
        >
          <Settings size={12} /> Server Settings
        </button>
      </div>

      {/* ── API URL Settings Modal ─────────────────────────────────────────── */}
      {showApiModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#1a1e2e',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', color: 'white', fontWeight: 700 }}>
              ⚙️ Custom Backend API Endpoint
            </h4>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              Specify the live backend URL (e.g. your Render deployment or localhost proxy).
            </p>

            <form onSubmit={handleSaveApiUrl} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                value={apiUrlInput}
                onChange={(e) => setApiUrlInput(e.target.value)}
                placeholder="https://datamind-backend-tmql.onrender.com"
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Save & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#94a3b8',
  fontWeight: 600,
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#f8fafc',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s ease',
};

const inputIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
};

export default HomeAuthPortal;
