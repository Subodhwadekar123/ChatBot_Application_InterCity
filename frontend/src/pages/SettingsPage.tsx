import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Key,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Database,
  Palette,
  Info,
  Sidebar,
  ChevronRight,
  CheckCircle,
  X,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { deleteDataset, reportIssue } from '../services/api';

// ─── Toggle switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  id: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, id }) => (
  <button
    id={id}
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    style={{
      width: 40,
      height: 22,
      borderRadius: 99,
      background: checked ? 'var(--accent-primary)' : 'var(--border-default)',
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}
  >
    <motion.span
      animate={{ x: checked ? 20 : 2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      style={{
        position: 'absolute',
        top: 2,
        left: 0,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'block',
      }}
    />
  </button>
);

// ─── Section card ─────────────────────────────────────────────────────────────

interface SettingsCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay?: number;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ icon, title, children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className="card-precision"
    style={{ marginBottom: '18px', padding: '18px' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          background: 'var(--accent-primary-light)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <h2 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
    </div>
    {children}
  </motion.div>
);

// ─── Row helpers ──────────────────────────────────────────────────────────────

const RowDivider: React.FC = () => (
  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '14px 0' }} />
);

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
    <div style={{ flex: 1 }}>
      <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</p>
      {description && <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{description}</p>}
    </div>
    {children}
  </div>
);

// ─── Input style ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  color: 'var(--text-secondary)',
  marginBottom: '4px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

// ─── Tech badge ───────────────────────────────────────────────────────────────

const TechBadge: React.FC<{ label: string }> = ({ label }) => (
  <span
    className="badge-subtle badge-info"
    style={{
      fontSize: '0.72rem',
      fontWeight: 500,
    }}
  >
    {label}
  </span>
);

// ─── Main component ───────────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const {
    datasets,
    activeDataset,
    setActiveDataset,
    removeDataset,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useStore();

  // ── API Key ────────────────────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('/api/v1');
  const [aiModel, setAiModel] = useState('gemini-2.0-flash');
  
  // ── Collapsible Docs State ──────────────────────────────────────────────────
  const [showDocs, setShowDocs] = useState(false);

  // ── Report an Issue States ─────────────────────────────────────────────────
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueCategory, setIssueCategory] = useState('bug');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueEmail, setIssueEmail] = useState('');

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim() || !issueDesc.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }
    const loadingToast = toast.loading('Submitting report...');
    try {
      await reportIssue({
        title: issueTitle,
        category: issueCategory,
        description: issueDesc,
        email: issueEmail || undefined,
      });
      toast.dismiss(loadingToast);
      toast.success('Thank you! Your issue report has been recorded.');
      setIssueTitle('');
      setIssueCategory('bug');
      setIssueDesc('');
      setIssueEmail('');
      setShowIssueModal(false);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Failed to submit issue report.');
    }
  };

  useEffect(() => {
    setApiKey(localStorage.getItem('gemini_api_key') ?? '');
    setApiBaseUrl(localStorage.getItem('api_base_url') ?? '/api/v1');
    setAiModel(localStorage.getItem('ai_model') ?? 'gemini-2.0-flash');
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('api_base_url', apiBaseUrl);
    localStorage.setItem('ai_model', aiModel);
    toast.success('Settings saved successfully!');
  };

  const downloadDocs = () => {
    const docsMarkdown = `# Infinitics AI - Platform User Guide & Documentation

Welcome to the Infinitics AI documentation. This guide details the features, capabilities, and settings of the Infinitics AI platform.

## 🚀 1. Getting Started
Infinitics AI is an automated, AI-driven data analyst web application. 
- **Upload File Size**: Maximum 200 MB.
- **Supported Formats**: CSV (\`.csv\`), Excel (\`.xlsx\`, \`.xls\`).

## 🧼 2. Data Cleaning
- **Missing Values**: Impute numeric columns with mean/median, and categorical columns with mode or a constant.
- **De-duplication**: Remove duplicate rows instantly.
- **Datatype Casting**: Correctly cast columns to float, integer, category, or datetime.
- **Outliers**: Drop rows with outliers or clip values using the IQR/Z-score method.

## 📊 3. Exploratory Data Analysis (EDA)
- **Data Quality Score**: Calculates a 100-point score breaking down completeness, uniqueness, consistency, and validity.
- **Column Summaries**: Detailed metrics for data distributions.
- **Correlations**: Auto-calculates Pearson correlation matrix.

## 🎨 4. Data Visualizations
Generate and customize:
- Bar Charts, Histograms, Scatter Plots, Pie Charts, Line Charts, and Box Plots.
- **Bubble Maps**: Plot geographical location names and size bubbles based on aggregated numeric variables.

## 🧮 5. Statistical Inference
- **Normality Tests**: Run Shapiro-Wilk or Kolmogorov-Smirnov tests.
- **Confidence Intervals**: Calculate margins of error and 95% confidence intervals.
- **Hypothesis Tests**: Configure and run independent two-sample t-tests.

## 🤖 6. Machine Learning (AutoML)
- **Auto-detection**: Classify continuous target variables for Regression, and categorical target variables for Classification.
- **AutoML Compare**: Click "Compare All" to train all compatible algorithms and view a performance-sorted scoreboard.

## 📥 7. Reports & Exports
- **Excel Report**: Download descriptive metrics and column definitions.
- **Executive PDF Report**: Generate print-ready, beautifully designed PDF documents powered by ReportLab.
`;

    const blob = new Blob([docsMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Infinitics_AI_Documentation.md';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Documentation download started!');
  };

  // ── Dataset management ─────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteDataset = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDataset(id);
      removeDataset(id);
      toast.success('Dataset deleted.');
    } catch {
      toast.error('Failed to delete dataset.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = () => {
    if (!window.confirm('Are you sure you want to clear all datasets? This action cannot be undone.')) return;
    datasets.forEach((ds) => {
      removeDataset(ds.id);
      deleteDataset(ds.id).catch(() => {});
    });
    toast.success('All datasets cleared.');
  };

  // ── Tech stack ─────────────────────────────────────────────────────────────
  const techStack = [
    'React 19',
    'FastAPI',
    'Pandas',
    'Recharts',
    'Framer Motion',
    'TypeScript',
    'Python 3.11',
    'Gemini AI',
  ];

  return (
    <div style={{ paddingBottom: '40px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Platform Settings
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
          Configure generative models, system appearance, and workspace datasets.
        </p>
      </div>

      {/* ── 1. AI Configuration ─────────────────────────────────────────────── */}
      <SettingsCard
        icon={<Key size={16} />}
        title="AI Engine &amp; API Configuration"
        delay={0}
      >
        {/* API Key */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle} htmlFor="api-key-input">Gemini API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              id="api-key-input"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              style={{ ...inputStyle, paddingRight: '40px' }}
            />
            <button
              onClick={() => setShowApiKey((v) => !v)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
              }}
              title={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <RowDivider />

        {/* API Base URL */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle} htmlFor="api-base-url-input">API Base Endpoint</label>
          <input
            id="api-base-url-input"
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="/api/v1"
            style={inputStyle}
          />
        </div>

        <RowDivider />

        {/* AI Model */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle} htmlFor="ai-model-select">Active Model Version</label>
          <select
            id="ai-model-select"
            value={aiModel}
            onChange={(e) => {
              setAiModel(e.target.value);
              localStorage.setItem('ai_model', e.target.value);
            }}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended, Low Latency)</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning)</option>
            <option value="gemini-1.5-flash">gemini-1.5-flash (Balanced)</option>
          </select>
        </div>

        {/* Save button */}
        <button
          id="save-settings-btn"
          className="btn-primary"
          onClick={handleSaveApiKey}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', fontSize: '0.82rem', padding: '0 16px' }}
        >
          <Save size={14} />
          Save Configuration
        </button>
      </SettingsCard>

      {/* ── 2. Appearance ──────────────────────────────────────────────────── */}
      <SettingsCard
        icon={<Palette size={16} />}
        title="Workspace Interface"
        delay={0.08}
      >
        <SettingRow
          label="Default Collapsed Sidebar"
          description="Preserve maximum canvas workspace width on startup"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sidebar size={15} color="var(--text-secondary)" />
            <ToggleSwitch
              id="sidebar-toggle"
              checked={sidebarCollapsed}
              onChange={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>
        </SettingRow>
      </SettingsCard>

      {/* ── 3. Dataset Management ─────────────────────────────────────────── */}
      <SettingsCard
        icon={<Database size={16} />}
        title="Dataset Storage &amp; Cache"
        delay={0.16}
      >
        {datasets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '16px 0' }}>
            No active datasets in local cache.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {datasets.map((ds) => {
              const isActive = activeDataset?.id === ds.id;
              return (
                <div
                  key={ds.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: isActive ? 'var(--accent-primary-light)' : 'var(--bg-canvas)',
                    border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    borderRadius: '8px',
                  }}
                >
                  {/* Dataset info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ds.filename}
                      </p>
                      {isActive && (
                        <span className="badge-subtle badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {(ds.dataset_info?.rows ?? 0).toLocaleString()} rows · {(ds.dataset_info?.columns ?? 0)} cols ·{' '}
                      {(ds.file_size_mb ?? 0).toFixed(2)} MB
                      {ds.uploaded_at ? ` · ${new Date(ds.uploaded_at.endsWith('Z') ? ds.uploaded_at : ds.uploaded_at + 'Z').toLocaleDateString()}` : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {!isActive && (
                      <button
                        className="btn-secondary"
                        onClick={() => setActiveDataset(ds)}
                        style={{ padding: '4px 10px', fontSize: '0.74rem', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle size={12} />
                        Select
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteDataset(ds.id)}
                      disabled={deletingId === ds.id}
                      style={{ background: 'transparent', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', padding: '4px' }}
                      title="Delete dataset"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {datasets.length > 0 && (
          <>
            <RowDivider />
            <button
              id="clear-all-datasets-btn"
              onClick={handleClearAll}
              style={{
                color: 'var(--status-danger)',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              Purge All Cached Datasets
            </button>
          </>
        )}
      </SettingsCard>

      {/* ── 4. About ─────────────────────────────────────────────────────── */}
      <SettingsCard
        icon={<Info size={16} />}
        title="About Infinitics Engine"
        delay={0.24}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Database size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Infinitics AI Platform</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Enterprise Data Intelligence · v1.0.0</p>
          </div>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          An intelligent enterprise platform designed for fast dataset exploration, statistical inference, automated data preprocessing, and production machine learning model deployment.
        </p>

        <RowDivider />

        <div style={{ marginTop: '14px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Architecture Frameworks
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {techStack.map((label) => (
              <TechBadge key={label} label={label} />
            ))}
          </div>
        </div>

        <RowDivider />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Collapsible Documentation Item */}
          <button
            onClick={() => setShowDocs(!showDocs)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-canvas)',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              Platform User Manual &amp; Specifications
            </span>
            <ChevronRight
              size={15}
              style={{
                transition: 'transform 0.2s',
                transform: showDocs ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          <AnimatePresence>
            {showDocs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                }}
              >
                {/* Download Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadDocs();
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.74rem',
                      height: '28px',
                      borderRadius: '6px',
                    }}
                  >
                    Download Manual (.md)
                  </button>
                </div>

                <h4 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.82rem' }}>Getting Started</h4>
                <p style={{ margin: '0 0 12px' }}>
                  Upload CSV or Excel files (up to 200 MB) to get instant descriptive analysis, interactive charts, statistical hypothesis tests, and machine learning predictions.
                </p>

                <h4 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.82rem' }}>Data Preprocessing</h4>
                <p style={{ margin: '0 0 12px' }}>
                  Drop duplicate rows, convert column datatypes, treat numeric outliers using Z-Score or IQR methods, and impute missing values.
                </p>

                <h4 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.82rem' }}>Machine Learning AutoML</h4>
                <p style={{ margin: 0 }}>
                  Compare multiple algorithms (Decision Trees, XGBoost, Random Forests, etc.) sorted by metrics (Accuracy, Precision, Recall, or R²).
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setShowIssueModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-canvas)',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <span>Feedback &amp; Issue Submission</span>
            <ChevronRight size={15} />
          </button>
        </div>
      </SettingsCard>

      {/* Report an Issue Modal */}
      <AnimatePresence>
        {showIssueModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIssueModal(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
              }}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="card-precision"
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '460px',
                padding: '20px',
                zIndex: 1001,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  <AlertCircle size={16} color="var(--accent-primary)" /> Submit Feedback
                </h3>
                <button
                  onClick={() => setShowIssueModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleReportIssue} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label htmlFor="issue-title" style={labelStyle}>Subject *</label>
                  <input
                    id="issue-title"
                    type="text"
                    placeholder="Brief summary..."
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="issue-category" style={labelStyle}>Category</label>
                  <select
                    id="issue-category"
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="bug">Bug / Defect</option>
                    <option value="feature">Feature Request</option>
                    <option value="docs">Documentation</option>
                    <option value="performance">Performance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="issue-desc" style={labelStyle}>Description *</label>
                  <textarea
                    id="issue-desc"
                    placeholder="Details about your feedback..."
                    value={issueDesc}
                    onChange={(e) => setIssueDesc(e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, resize: 'none' }}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="issue-email" style={labelStyle}>Email (Optional)</label>
                  <input
                    id="issue-email"
                    type="email"
                    placeholder="user@example.com"
                    value={issueEmail}
                    onChange={(e) => setIssueEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowIssueModal(false)}
                    style={{ height: '32px', padding: '0 14px', fontSize: '0.78rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ height: '32px', padding: '0 16px', fontSize: '0.78rem' }}
                  >
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
