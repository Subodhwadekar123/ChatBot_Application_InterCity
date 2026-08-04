/**
 * Admin Activity Monitor Page
 * Paginated, filterable login history for all users with CSV export.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity, Search, Download, RefreshCw, CheckCircle, XCircle,
  Loader2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Monitor, Smartphone, Globe
} from 'lucide-react';
import { getLoginActivity, getLoginActivityCsvUrl } from '../../services/adminApi';

const LIMIT = 50;

const AdminActivityPage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: LIMIT, offset: page * LIMIT };
      if (search) params.search = search;
      if (successFilter !== '') params.success = successFilter === 'true';
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await getLoginActivity(params) as any;
      setRecords(res.records || []);
      setTotal(res.total || 0);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [page, search, successFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    const url = getLoginActivityCsvUrl({ date_from: dateFrom, date_to: dateTo });
    // Download using token in header via fetch
    const token = localStorage.getItem('auth_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `login_activity_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      })
      .catch(() => toast.error('Export failed.'));
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>
            <Activity size={22} style={{ display: 'inline', marginRight: '10px', color: '#6366f1', verticalAlign: 'middle' }} />
            Login Activity Monitor
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>{total.toLocaleString()} total records</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={load} style={ghostBtnStyle}><RefreshCw size={15} /> Refresh</button>
          <button onClick={handleExport} style={{ ...ghostBtnStyle, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={14} color="#475569" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by email or IP..." style={{ ...inputStyle, paddingLeft: '34px' }} />
        </div>
        <select value={successFilter} onChange={(e) => { setSuccessFilter(e.target.value); setPage(0); }} style={selectStyle}>
          <option value="">All Logins</option>
          <option value="true">Successful Only</option>
          <option value="false">Failed Only</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} style={{ ...selectStyle, width: '150px' }} />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} style={{ ...selectStyle, width: '150px' }} />
      </div>

      <div style={{ background: 'rgba(22,25,37,0.6)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Status', 'Email', 'Login Time', 'Browser', 'OS', 'Device', 'IP Address', 'Country', 'Duration'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></td></tr>
              ) : records.map((r) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                      background: r.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: r.success ? '#34d399' : '#f87171',
                    }}>
                      {r.success ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {r.success ? 'OK' : 'FAIL'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#e2e8f0', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', whiteSpace: 'nowrap', fontSize: '12px' }}>{new Date(r.login_time).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: '#e2e8f0' }}>{r.browser || '-'}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{r.os || '-'}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                    {r.device_type === 'mobile' ? <Smartphone size={14} style={{ color: '#a855f7' }} /> : r.device_type === 'tablet' ? <Monitor size={14} style={{ color: '#6366f1' }} /> : <Monitor size={14} style={{ color: '#06b6d4' }} />}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{r.ip_address || '-'}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                    {r.country ? <><Globe size={12} style={{ display: 'inline', marginRight: '4px' }} />{r.country}</> : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                    {r.session_duration_seconds ? `${Math.round(r.session_duration_seconds / 60)}m` : '-'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0} style={{ ...ghostBtnStyle, opacity: page === 0 ? 0.4 : 1 }}><ChevronLeft size={15} /></button>
            <span style={{ color: '#e2e8f0', fontSize: '13px', padding: '6px 12px', fontWeight: 600 }}>{page + 1} / {totalPages || 1}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} style={{ ...ghostBtnStyle, opacity: page >= totalPages - 1 ? 0.4 : 1 }}><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { padding: '9px 12px', background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', outline: 'none', cursor: 'pointer' };
const ghostBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', borderRadius: '10px', padding: '9px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 };

export default AdminActivityPage;
