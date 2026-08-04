/**
 * LoginPage.tsx
 * Enterprise-grade unified login page with:
 *  - User & Admin Portal tab switching
 *  - Email + password validation
 *  - 1-Click Quick Fill for Admin demo
 *  - Remember Me
 *  - Show/hide password
 *  - Loading states & animations
 *  - Responsive, dark glassmorphism design
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Mail, Lock, Eye, EyeOff, Shield, Loader2,
  AlertCircle, LogIn, ArrowRight, User, Sparkles, CheckCircle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { loginUser } from '../../services/authApi';
import type { AuthUser } from '../../store/useStore';

type LoginRole = 'user' | 'admin';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, setToken, setSessionId } = useStore();

  const [activeTab, setActiveTab] = useState<LoginRole>(
    searchParams.get('role') === 'admin' ? 'admin' : 'user'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Switch tab helper
  const handleTabChange = (role: LoginRole) => {
    setActiveTab(role);
    setError('');
    if (role === 'admin') {
      setEmail('admin@infinitics.ai');
      setPassword('SubodhW@7116');
    } else {
      setEmail('');
      setPassword('');
    }
  };

  const handleQuickFillAdmin = () => {
    setEmail('admin@infinitics.ai');
    setPassword('SubodhW@7116');
    toast.success('Admin credentials autofilled!');
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser({ email, password, remember_me: rememberMe });

      if (activeTab === 'admin' && !res.user.is_admin && res.user.role !== 'admin') {
        setError('Access denied: This account does not have administrator privileges.');
        return;
      }

      setToken(res.access_token);
      setSessionId(res.session_id);
      setUser(res.user as AuthUser);
      toast.success(`Welcome back, ${res.user.full_name || res.user.email}!`);

      // Route based on role
      if (res.user.is_admin || res.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please verify your credentials.';
      setError(msg);
      if (msg.toLowerCase().includes('verify your email')) {
        setTimeout(() => navigate('/verify-email'), 2000);
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, rememberMe, activeTab, setUser, setToken, setSessionId, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: activeTab === 'admin'
        ? 'radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.14) 0%, #0c0e17 50%, rgba(234,88,12,0.06) 100%)'
        : 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.09) 0%, #0f1117 50%, rgba(139,92,246,0.06) 100%)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background 0.5s ease',
    }}>
      {/* Background glowing blobs */}
      <div style={{
        position: 'absolute', top: '15%', left: '10%',
        width: '400px', height: '400px',
        background: activeTab === 'admin'
          ? 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
        transition: 'background 0.5s ease',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '10%',
        width: '350px', height: '350px',
        background: activeTab === 'admin'
          ? 'radial-gradient(circle, rgba(234,88,12,0.12) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
        transition: 'background 0.5s ease',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}
      >
        {/* Top Segmented Selector */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '4px',
          marginBottom: '24px',
          backdropFilter: 'blur(10px)',
        }}>
          <button
            type="button"
            onClick={() => handleTabChange('user')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'user' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
              color: activeTab === 'user' ? '#ffffff' : '#94a3b8',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'user' ? '0 4px 12px rgba(79,70,229,0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <User size={16} />
            User Login
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'admin' ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : 'transparent',
              color: activeTab === 'admin' ? '#ffffff' : '#94a3b8',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: activeTab === 'admin' ? '0 4px 12px rgba(124,58,237,0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Shield size={16} color={activeTab === 'admin' ? '#fbbf24' : '#94a3b8'} />
            Admin Portal
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <motion.div
            key={activeTab}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              width: '64px', height: '64px',
              background: activeTab === 'admin'
                ? 'linear-gradient(135deg, #7c3aed, #ea580c)'
                : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              borderRadius: '18px', margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: activeTab === 'admin'
                ? '0 8px 32px rgba(124,58,237,0.5)'
                : '0 8px 32px rgba(99,102,241,0.4)',
            }}
          >
            {activeTab === 'admin' ? (
              <Shield size={32} color="#fef08a" />
            ) : (
              <LogIn size={30} color="white" />
            )}
          </motion.div>

          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>
            {activeTab === 'admin' ? 'Administrator Login' : 'Welcome Back'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            {activeTab === 'admin'
              ? 'Security-cleared administrative console'
              : 'Sign in to your AI Data Analyst account'
            }
          </p>

          {activeTab === 'admin' && (
            <div style={{ marginTop: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(234,88,12,0.15)',
                border: '1px solid rgba(234,88,12,0.3)',
                color: '#fb923c',
                borderRadius: '20px',
                padding: '3px 12px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                <Shield size={11} /> Restricted Access
              </span>
            </div>
          )}
        </div>

        {/* Card */}
        <div style={{
          background: activeTab === 'admin' ? 'rgba(20, 18, 32, 0.9)' : 'rgba(22, 25, 37, 0.85)',
          backdropFilter: 'blur(20px)',
          border: activeTab === 'admin' ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          transition: 'border 0.3s ease',
        }}>
          {/* Quick Fill Button for Admin */}
          {activeTab === 'admin' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#a855f7" />
                <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 600 }}>Default Admin Preset</span>
              </div>
              <button
                type="button"
                onClick={handleQuickFillAdmin}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Autofill
              </button>
            </div>
          )}

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
                }}
              >
                <AlertCircle size={16} color="#f87171" style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: '#fca5a5', lineHeight: '1.4' }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email */}
            <div>
              <label style={labelStyle}>
                {activeTab === 'admin' ? 'Admin Email Address' : 'Email Address'}
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#475569" style={iconStyle} />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activeTab === 'admin' ? 'admin@infinitics.ai' : 'name@example.com'}
                  autoComplete="email"
                  required
                  style={{ ...inputStyle, paddingLeft: '40px' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>
                {activeTab === 'admin' ? 'Admin Password' : 'Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#475569" style={iconStyle} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{ ...inputStyle, paddingLeft: '40px', paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#475569', padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Remember me</span>
              </label>
              {activeTab === 'user' && (
                <Link to="/forgot-password" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
                  Forgot password?
                </Link>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{
                width: '100%', padding: '13px',
                background: loading
                  ? 'rgba(99,102,241,0.5)'
                  : activeTab === 'admin'
                    ? 'linear-gradient(135deg, #7c3aed, #9333ea)'
                    : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: loading
                  ? 'none'
                  : activeTab === 'admin'
                    ? '0 4px 20px rgba(124,58,237,0.45)'
                    : '0 4px 20px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />Verifying...</>
              ) : activeTab === 'admin' ? (
                <><Shield size={18} color="#fef08a" />Access Admin Console</>
              ) : (
                <><LogIn size={18} />Sign In</>
              )}
            </motion.button>
          </form>

          {/* Footer Section */}
          {activeTab === 'user' ? (
            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
              <span style={{ color: '#64748b' }}>Don't have an account? </span>
              <Link to="/register" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>
                Create account <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </Link>
            </div>
          ) : (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => handleTabChange('user')}
                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
              >
                ← Back to standard user login
              </button>
            </div>
          )}
        </div>

        {/* Quick Footer Links */}
        <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => handleTabChange(activeTab === 'admin' ? 'user' : 'admin')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12px',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {activeTab === 'admin' ? (
              <>Switch to User Login</>
            ) : (
              <><Shield size={13} color="#a5b4fc" /> Switch to Admin Portal</>
            )}
          </button>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #1e2235 inset !important; -webkit-text-fill-color: #e2e8f0 !important; }
      `}</style>
    </div>
  );
};

// ── Shared Styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: '#64748b',
  fontWeight: 600, marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', color: '#e2e8f0',
  fontSize: '14px', outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};

const iconStyle: React.CSSProperties = {
  position: 'absolute', left: '13px',
  top: '50%', transform: 'translateY(-50%)',
};

export default LoginPage;
