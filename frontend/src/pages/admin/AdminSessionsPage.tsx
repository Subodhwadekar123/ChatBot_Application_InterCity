/**
 * Admin Sessions Management Page
 * Inspect all active user sessions across the system, view device/IP info, and terminate sessions.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Monitor, Smartphone, Tablet, Globe, Trash2,
  RefreshCw, Loader2, Search, AlertTriangle, ChevronLeft,
  ChevronRight, Shield, Clock, User
} from 'lucide-react';
import { getAllSessions, terminateSession } from '../../services/adminApi';

const LIMIT = 50;

const DeviceIcon: React.FC<{ type?: string }> = ({ type }) => {
  if (type === 'mobile') return <Smartphone size={16} color="#a855f7" />;
  if (type === 'tablet') return <Tablet size={16} color="#8b5cf6" />;
  return <Monitor size={16} color="#06b6d4" />;
};

const AdminSessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [terminating, setTerminating] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllSessions(LIMIT, page * LIMIT) as any;
      setSessions(res.sessions || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleTerminate = async (sessionId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to terminate this session for ${email}?`)) {
      return;
    }
    setTerminating(sessionId);
    try {
      await terminateSession(sessionId);
      toast.success('Session terminated.');
      loadSessions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to terminate session.');
    } finally {
      setTerminating(null);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.user_email && s.user_email.toLowerCase().includes(q)) ||
      (s.ip_address && s.ip_address.toLowerCase().includes(q)) ||
      (s.browser && s.browser.toLowerCase().includes(q)) ||
      (s.os && s.os.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>
            <Monitor size={22} style={{ display: 'inline', marginRight: '10px', color: '#06b6d4', verticalAlign: 'middle' }} />
            Active User Sessions
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            {total} total active concurrent sessions across all users
          </p>
        </div>
        <button
          onClick={loadSessions}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
            borderRadius: '10px',
            padding: '9px 14px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Search Filter */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <Search size={14} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user email, IP, browser..."
            style={{
              width: '100%',
              padding: '9px 14px 9px 36px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#e2e8f0',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="glow-card" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['User Email', 'Device & OS', 'Browser', 'IP Address', 'Created At', 'Last Active', 'Expires At', 'Action'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '11px 14px',
                      textAlign: 'left',
                      color: '#64748b',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  </td>
                </tr>
              ) : filteredSessions.map((s) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}
                      >
                        {(s.user_email || 'U')[0].toUpperCase()}
                      </div>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{s.user_email || s.user_id}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <DeviceIcon type={s.device_type} />
                      <span>{s.os || 'Unknown OS'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{s.browser || 'Unknown'}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '12px' }}>
                    {s.ip_address || '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {s.created_at ? new Date(s.created_at).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {s.last_active ? new Date(s.last_active).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {s.expires_at ? new Date(s.expires_at).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => handleTerminate(s.id, s.user_email || s.user_id)}
                      disabled={terminating === s.id}
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        cursor: terminating === s.id ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {terminating === s.id ? (
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      Terminate
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredSessions.length === 0 && !loading && (
            <p style={{ textAlign: 'center', color: '#475569', padding: '32px' }}>
              No active sessions found.
            </p>
          )}
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                opacity: page === 0 ? 0.4 : 1,
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ color: '#e2e8f0', fontSize: '13px', padding: '6px 12px', fontWeight: 600 }}>
              {page + 1} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages - 1 ? 0.4 : 1,
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AdminSessionsPage;
