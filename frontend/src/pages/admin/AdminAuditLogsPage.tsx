/**
 * Admin Audit Logs Page
 * Enterprise security audit log viewer with severity badges, JSON detail modal, and filtering.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FileText, Search, RefreshCw, Loader2, ChevronLeft,
  ChevronRight, Shield, AlertTriangle, AlertCircle, Info,
  CheckCircle, X, Eye, Calendar
} from 'lucide-react';
import { getAuditLogs, AuditParams } from '../../services/adminApi';

const LIMIT = 50;

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const s = severity.toLowerCase();
  if (s === 'critical') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}>
        <AlertCircle size={11} /> CRITICAL
      </span>
    );
  }
  if (s === 'warning') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)' }}>
        <AlertTriangle size={11} /> WARNING
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
      <Info size={11} /> INFO
    </span>
  );
};

const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: AuditParams = {
        limit: LIMIT,
        offset: page * LIMIT,
      };
      if (search) params.search = search;
      if (severityFilter) params.severity = severityFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await getAuditLogs(params) as any;
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, severityFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>
            <FileText size={22} style={{ display: 'inline', marginRight: '10px', color: '#8b5cf6', verticalAlign: 'middle' }} />
            Security Audit Logs
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            {total.toLocaleString()} immutable security events recorded
          </p>
        </div>
        <button
          onClick={loadLogs}
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={14} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by action, user, or IP..."
            style={inputStyle}
          />
        </div>

        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
          style={selectStyle}
        >
          <option value="">All Severities</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          style={selectStyle}
        >
          <option value="">All Actions</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          <option value="LOGOUT">LOGOUT</option>
          <option value="REGISTER">REGISTER</option>
          <option value="PASSWORD_RESET_REQUEST">PASSWORD_RESET_REQUEST</option>
          <option value="PASSWORD_RESET_SUCCESS">PASSWORD_RESET_SUCCESS</option>
          <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
          <option value="EMAIL_VERIFIED">EMAIL_VERIFIED</option>
          <option value="ACCOUNT_LOCKED">ACCOUNT_LOCKED</option>
          <option value="ACCOUNT_UNLOCKED">ACCOUNT_UNLOCKED</option>
          <option value="USER_SUSPENDED">USER_SUSPENDED</option>
          <option value="ROLE_CHANGED">ROLE_CHANGED</option>
          <option value="SESSION_REVOKED">SESSION_REVOKED</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          style={{ ...selectStyle, width: '140px' }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          style={{ ...selectStyle, width: '140px' }}
        />
      </div>

      {/* Logs Table */}
      <div className="glow-card" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Severity', 'Action', 'Target User', 'Admin / Performed By', 'IP Address', 'Timestamp', 'Details'].map((h) => (
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  </td>
                </tr>
              ) : logs.map((log) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <SeverityBadge severity={log.severity || 'INFO'} />
                  </td>
                  <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace', fontSize: '12px' }}>
                    {log.action}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#cbd5e1', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.user_email || log.user_id || '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                    {log.performed_by || 'System / Self'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>
                    {log.ip_address || '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => setSelectedLog(log)}
                      style={{
                        background: 'rgba(99,102,241,0.12)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        color: '#a5b4fc',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={13} /> View
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && !loading && (
            <p style={{ textAlign: 'center', color: '#475569', padding: '32px' }}>
              No audit logs matched your search.
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

      {/* Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              zIndex: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              style={{
                background: '#1a1d2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '28px',
                maxWidth: '560px',
                width: '100%',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SeverityBadge severity={selectedLog.severity || 'INFO'} />
                  <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '16px', fontFamily: 'monospace' }}>
                    {selectedLog.action}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={detailBox}>
                  <span style={detailLabel}>User</span>
                  <span style={detailValue}>{selectedLog.user_email || selectedLog.user_id || '-'}</span>
                </div>
                <div style={detailBox}>
                  <span style={detailLabel}>Performed By</span>
                  <span style={detailValue}>{selectedLog.performed_by || 'Self / System'}</span>
                </div>
                <div style={detailBox}>
                  <span style={detailLabel}>IP Address</span>
                  <span style={{ ...detailValue, fontFamily: 'monospace' }}>{selectedLog.ip_address || '-'}</span>
                </div>
                <div style={detailBox}>
                  <span style={detailLabel}>Timestamp</span>
                  <span style={detailValue}>{selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : '-'}</span>
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Event Metadata (JSON)
                  </span>
                  <pre
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      padding: '14px',
                      color: '#38bdf8',
                      fontSize: '12px',
                      overflowX: 'auto',
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {typeof selectedLog.details === 'string'
                      ? selectedLog.details
                      : JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 14px 9px 34px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#e2e8f0',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '9px 12px',
  background: '#1e2235',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#94a3b8',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
};

const detailBox: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '10px',
  padding: '10px 12px',
};

const detailLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#64748b',
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: '4px',
  letterSpacing: '0.06em',
};

const detailValue: React.CSSProperties = {
  color: '#e2e8f0',
  fontSize: '13px',
  fontWeight: 600,
};

export default AdminAuditLogsPage;
