/**
 * Admin Login Page
 * Dedicated login screen for administrators (separate from user login).
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, LogIn } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { loginUser } from '../../services/authApi';
import type { AuthUser } from '../../store/useStore';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken, setSessionId } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginUser({ email, password });
      if (!res.user.is_admin && res.user.role !== 'admin') {
        setError('Access denied. This portal is restricted to system administrators only.');
        return;
      }
      setToken(res.access_token);
      setSessionId(res.session_id);
      setUser(res.user as AuthUser);
      toast.success(`Welcome, ${res.user.full_name || 'Admin'}!`);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 50%, rgba(79,70,229,0.10) 0%, #0a0c14 60%, rgba(124,58,237,0.07) 100%)',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: '18px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(79,70,229,0.5)' }}>
            <Shield size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>Admin Portal</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Restricted access — Authorized personnel only</p>
        </div>

        <div style={{ background: 'rgba(14,16,24,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '20px', padding: '32px', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', gap: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px' }}>
              <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Administrator Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com" required autoComplete="email"
                  style={{ ...inputStyle, paddingLeft: '38px' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input id="admin-password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password"
                  style={{ ...inputStyle, paddingLeft: '38px', paddingRight: '40px' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <motion.button type="submit" disabled={loading} whileHover={{ scale: loading ? 1 : 1.01 }}
              style={{ width: '100%', padding: '13px', background: loading ? 'rgba(79,70,229,0.4)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 20px rgba(79,70,229,0.4)', marginTop: '4px' }}>
              {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />Verifying...</> : <><LogIn size={18} />Access Admin Portal</>}
            </motion.button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none' }}>
              ← Back to User Login
            </Link>
          </div>
        </div>
      </motion.div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };

export default AdminLoginPage;
