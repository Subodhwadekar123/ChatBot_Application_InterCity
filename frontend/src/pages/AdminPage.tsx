import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Users,
  Database,
  AlertCircle,
  FileText,
  User,
  Shield,
  Activity,
  Inbox,
  Power,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  Trash2
} from 'lucide-react';
import {
  getAdminStats,
  getAdminUsers,
  getAdminDatasets,
  getAdminIssues,
  forceLogoutUser,
  getUserDatasets,
  adminDownloadPDF,
  adminDownloadExcel,
  adminDownloadCSV,
  deleteIssue
} from '../services/api';
import SectionHeader from '../components/ui/SectionHeader';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'datasets' | 'issues'>('users');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total_users: number; total_datasets: number; total_experiments: number; total_issues: number } | null>(null);
  
  const [usersList, setUsersList] = useState<any[]>([]);
  const [datasetsList, setDatasetsList] = useState<any[]>([]);
  const [issuesList, setIssuesList] = useState<any[]>([]);

  // State for expanded user datasets drawer
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userDatasets, setUserDatasets] = useState<any[]>([]);
  const [loadingUserDatasets, setLoadingUserDatasets] = useState(false);

  // State for toggling user access
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // State for deleting issues
  const [deletingIssueId, setDeletingIssueId] = useState<number | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, datasetsData, issuesData] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminDatasets(),
        getAdminIssues()
      ]);
      setStats(statsData);
      setUsersList(usersData);
      setDatasetsList(datasetsData);
      setIssuesList(issuesData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch administration logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Force a user to logout
  const handleForceLogout = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to forcefully logout ${userName}? Their current session will be terminated.`)) return;
    setTogglingUserId(userId);
    try {
      const result = await forceLogoutUser(userId);
      toast.success(result.message || `Session terminated for ${userName}`);
      const usersData = await getAdminUsers();
      setUsersList(usersData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to force logout user.');
    } finally {
      setTogglingUserId(null);
    }
  };

  // Delete an issue
  const handleDeleteIssue = async (issueId: number) => {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    setDeletingIssueId(issueId);
    try {
      await deleteIssue(issueId);
      toast.success('Issue deleted successfully');
      const issuesData = await getAdminIssues();
      setIssuesList(issuesData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete issue.');
    } finally {
      setDeletingIssueId(null);
    }
  };

  // Download Handlers
  const handleDownload = async (type: 'csv' | 'pdf' | 'excel', id: string) => {
    const downloadPromise = async () => {
      if (type === 'csv') await adminDownloadCSV(id);
      if (type === 'pdf') await adminDownloadPDF(id);
      if (type === 'excel') await adminDownloadExcel(id);
    };

    toast.promise(downloadPromise(), {
      loading: `Downloading ${type.toUpperCase()}...`,
      success: `Downloaded ${type.toUpperCase()} successfully!`,
      error: `Failed to download ${type.toUpperCase()}`
    });
  };

  // Expand user row to show their datasets
  const handleViewUserDatasets = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserDatasets([]);
      return;
    }
    setExpandedUserId(userId);
    setLoadingUserDatasets(true);
    try {
      const data = await getUserDatasets(userId);
      setUserDatasets(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch user datasets.');
      setUserDatasets([]);
    } finally {
      setLoadingUserDatasets(false);
    }
  };

  // Format date + time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    }) + ' • ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading administration console..." />
      </div>
    );
  }

  const onlineUserCount = usersList.length > 0 ? usersList.filter(u => u.is_online).length : 0;

  const statCards = [
    { label: 'Active Online Users', value: onlineUserCount, icon: Users },
    { label: 'Ingested Datasets', value: stats?.total_datasets || 0, icon: Database },
    { label: 'Trained ML Models', value: stats?.total_experiments || 0, icon: Activity },
    { label: 'Reported Inquiries', value: stats?.total_issues || 0, icon: AlertCircle }
  ];

  return (
    <div style={{ paddingBottom: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <SectionHeader
        title="Administrative Control &amp; Audit Console"
        subtitle="Manage user access permissions, inspect uploaded datasets, and monitor system activity logs."
      />

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
          marginTop: '12px'
        }}
      >
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="card-precision"
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {card.label}
              </span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0' }}>
                {card.value}
              </h3>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'var(--accent-primary-light)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <card.icon size={18} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tab controls */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '3px',
          width: 'fit-content'
        }}
      >
        {[
          { id: 'users', label: 'User Directory', icon: Users },
          { id: 'datasets', label: 'Dataset Storage', icon: Database },
          { id: 'issues', label: 'Feedback Inquiries', icon: AlertCircle }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab contents */}
      <div className="card-precision" style={{ padding: '18px', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {/* ═══════════════════ USERS TAB ═══════════════════ */}
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <h3 style={{ fontSize: '0.94rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 14px' }}>Registered User Accounts</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Profile Name</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Email Address</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Role</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Last Login</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No users registered.</td>
                      </tr>
                    ) : (
                      usersList.map((user) => (
                        <React.Fragment key={user.id}>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={14} color="var(--text-secondary)" />
                                {user.full_name || 'N/A'}
                              </div>
                            </td>
                            <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{user.email}</td>
                            <td style={{ padding: '10px' }}>
                              {user.is_admin ? (
                                <span className="badge-subtle badge-danger" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                                  <Shield size={9} style={{ marginRight: '3px', display: 'inline' }} /> ADMIN
                                </span>
                              ) : (
                                <span className="badge-subtle badge-info" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                                  USER
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ color: user.is_online ? 'var(--status-success)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.74rem' }}>
                                ● {user.is_online ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                                <Clock size={12} />
                                {user.last_login ? formatDateTime(user.last_login) : 'Never'}
                              </div>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                {!user.is_admin && user.is_online && (
                                  <button
                                    onClick={() => handleForceLogout(user.id, user.full_name || user.email)}
                                    disabled={togglingUserId === user.id}
                                    title="Force Logout User"
                                    className="btn-secondary"
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '0.72rem',
                                      color: 'var(--status-danger)',
                                      height: '26px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <Power size={11} />
                                    {togglingUserId === user.id ? '...' : 'Terminate'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleViewUserDatasets(user.id)}
                                  title="View User Datasets"
                                  className="btn-secondary"
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.72rem',
                                    height: '26px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <Eye size={11} />
                                  Datasets
                                  {expandedUserId === user.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded User Datasets Drawer */}
                          {expandedUserId === user.id && (
                            <tr>
                              <td colSpan={6} style={{ padding: 0 }}>
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  style={{
                                    background: 'var(--bg-canvas)',
                                    borderTop: '1px solid var(--border-default)',
                                    borderBottom: '2px solid var(--accent-primary)',
                                    padding: '12px 16px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                      Datasets by {user.full_name || user.email}
                                    </h4>
                                    <button
                                      onClick={() => { setExpandedUserId(null); setUserDatasets([]); }}
                                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                  {loadingUserDatasets ? (
                                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading user datasets...</div>
                                  ) : userDatasets.length === 0 ? (
                                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No datasets uploaded by this user.</div>
                                  ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                                          <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>File Name</th>
                                          <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>Dimensions</th>
                                          <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>Size</th>
                                          <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>Uploaded</th>
                                          <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>Download</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {userDatasets.map((ds: any) => (
                                          <tr key={ds.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '6px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <FileText size={12} color="var(--accent-primary)" />
                                                {ds.original_filename}
                                              </div>
                                            </td>
                                            <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>
                                              {ds.rows != null ? `${ds.rows.toLocaleString()} × ${ds.columns}` : '—'}
                                            </td>
                                            <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{roundSize(ds.file_size_bytes)}</td>
                                            <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{formatDateTime(ds.created_at)}</td>
                                            <td style={{ padding: '6px', textAlign: 'center' }}>
                                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button
                                                  onClick={() => handleDownload('pdf', ds.id)}
                                                  className="btn-secondary"
                                                  style={{ padding: '2px 6px', fontSize: '0.68rem', height: '22px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                >
                                                  <Download size={10} /> PDF
                                                </button>
                                                <button
                                                  onClick={() => handleDownload('excel', ds.id)}
                                                  className="btn-secondary"
                                                  style={{ padding: '2px 6px', fontSize: '0.68rem', height: '22px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                >
                                                  <Download size={10} /> Excel
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════ DATASETS TAB ═══════════════════ */}
          {activeTab === 'datasets' && (
            <motion.div
              key="datasets"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <h3 style={{ fontSize: '0.94rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 14px' }}>System-Wide Dataset Logs</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Dataset Name</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Owner Account</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Dimensions</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>File Size</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Upload Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasetsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No dataset records found.</td>
                      </tr>
                    ) : (
                      datasetsList.map((d) => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileText size={14} color="var(--accent-primary)" />
                              {d.original_filename}
                            </div>
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{d.owner_email}</td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                            {d.rows !== null ? `${d.rows.toLocaleString()} × ${d.columns}` : 'Loading...'}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                            {roundSize(d.file_size_bytes)}
                          </td>
                          <td style={{ padding: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                              <Clock size={12} />
                              {formatDateTime(d.created_at)}
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDownload('csv', d.id)}
                              className="btn-secondary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                height: '26px',
                              }}
                            >
                              <Download size={11} /> CSV
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════ ISSUES TAB ═══════════════════ */}
          {activeTab === 'issues' && (
            <motion.div
              key="issues"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <h3 style={{ fontSize: '0.94rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 14px' }}>Recorded User Inquiries &amp; Reports</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {issuesList.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Inbox size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.82rem' }}>No feedback inquiries recorded. System running nominally.</p>
                  </div>
                ) : (
                  issuesList.map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        padding: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                          #{issue.id} · {issue.title}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className={`badge-subtle ${
                              issue.category === 'bug' ? 'badge-danger' :
                              issue.category === 'feature' ? 'badge-success' :
                              issue.category === 'performance' ? 'badge-warning' : 'badge-info'
                            }`}
                            style={{ fontSize: '0.68rem' }}
                          >
                            {issue.category.toUpperCase()}
                          </span>
                          <button
                            onClick={() => handleDeleteIssue(issue.id)}
                            disabled={deletingIssueId === issue.id}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--status-danger)',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                            title="Delete Issue"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                        {issue.description}
                      </p>

                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <div>
                          Reporter: <span style={{ color: 'var(--text-secondary)' }}>{issue.email || 'Anonymous'}</span>
                        </div>
                        <div>
                          Date: <span style={{ color: 'var(--text-secondary)' }}>{issue.created_at ? new Date(issue.created_at.endsWith('Z') ? issue.created_at : issue.created_at + 'Z').toLocaleString() : '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Helpers
const roundSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export default AdminPage;
