import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield, Mail, Lock, User, RefreshCw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { login, registerUser } from '../../services/api';

interface AuthFormProps {
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, initialMode = 'login' }) => {
  const navigate = useNavigate();
  const { setUser, setToken } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForceModal, setShowForceModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password.');
      return;
    }
    if (mode === 'register' && !fullName.trim()) {
      toast.error('Please enter your name.');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading(mode === 'login' ? 'Authenticating session...' : 'Creating your account...');

    try {
      if (mode === 'login') {
        const res = await login({ email, password });
        setToken(res.access_token);
        setUser(res.user);
        toast.dismiss(loadingToast);
        toast.success(`Welcome back, ${res.user.full_name || res.user.email}!`);
        if (onSuccess) onSuccess();
        navigate('/dashboard/upload');
      } else {
        await registerUser({ email, password, full_name: fullName });
        toast.dismiss(loadingToast);
        toast.success('Account registered successfully! Please log in.');
        setMode('login');
        setLoading(false);
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      if (err.message && err.message.includes('already logged in elsewhere')) {
        setShowForceModal(true);
      } else {
        toast.error(err.message || 'Authentication failed.');
      }
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    setShowForceModal(false);
    setLoading(true);
    const loadingToast = toast.loading('Terminating prior session...');
    try {
      const res = await login({ email, password, force_login: true });
      setToken(res.access_token);
      setUser(res.user);
      toast.dismiss(loadingToast);
      toast.success(`Successfully authenticated!`);
      if (onSuccess) onSuccess();
      navigate('/dashboard/upload');
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Title */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', textAlign: 'center', letterSpacing: '-0.02em' }}>
        {mode === 'login' ? 'Sign In to Workspace' : 'Create an Account'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 18px', textAlign: 'center' }}>
        {mode === 'login' ? "Enterprise analytics & automated machine learning" : "Join the collaborative intelligence platform"}
      </p>

      {/* Onboarding Info Alert */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          padding: '10px 12px',
          background: 'var(--accent-primary-light)',
          borderRadius: '8px',
          border: '1px solid var(--border-default)',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        </div>
        <div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: '1.4' }}>
            Protected with role-based session isolation, encrypted dataset pipelines, and secure model persistence.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {mode === 'register' && (
          <div>
            <label
              htmlFor="reg-name"
              style={{
                display: 'block',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Full Name *
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={15}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                id="reg-name"
                type="text"
                className="input-precision"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ paddingLeft: '34px', fontSize: '0.82rem' }}
                required
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="auth-email"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Work Email *
          </label>
          <div style={{ position: 'relative' }}>
            <Mail
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              id="auth-email"
              type="email"
              className="input-precision"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '0.82rem' }}
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="auth-password"
            style={{
              display: 'block',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Password *
          </label>
          <div style={{ position: 'relative' }}>
            <Lock
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              id="auth-password"
              type="password"
              className="input-precision"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '0.82rem' }}
              required
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{
            marginTop: '6px',
            height: '36px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
          }}
        >
          {loading ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : mode === 'login' ? (
            'Authenticate'
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Mode Switcher */}
      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          {mode === 'login' ? "Don't have an account? " : "Already registered? "}
        </span>
        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: '0.78rem',
          }}
        >
          {mode === 'login' ? 'Sign Up' : 'Log In'}
        </button>
      </div>

      {/* Force Login Modal */}
      {showForceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="card-precision" style={{
            padding: '24px', maxWidth: '380px', width: '90%', textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px', color: 'var(--status-danger)', fontSize: '1.05rem', fontWeight: 700 }}>Concurrent Session Active</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '18px', lineHeight: '1.45' }}>
              Your account is logged in on another device. Would you like to terminate the previous session and proceed?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowForceModal(false)}
                className="btn-secondary"
                style={{ height: '32px', padding: '0 14px', fontSize: '0.78rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleForceLogin}
                className="btn-primary"
                style={{ height: '32px', padding: '0 14px', fontSize: '0.78rem', background: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
              >
                Terminate &amp; Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthForm;
