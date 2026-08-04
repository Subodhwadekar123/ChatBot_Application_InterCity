import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FileText,
  Table2,
  Download,
  Sparkles,
  CheckCircle,
  Clock,
  Database,
  Code,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { downloadPDFReport, downloadExcelReport, downloadJupyterReport, getQualityScore } from '../services/api';
import EmptyState from '../components/ui/EmptyState';

// ─── Types ──────────────────────────────────────────────────────────────────

interface QualityScore {
  score: number;
  breakdown: {
    completeness: number;
    consistency: number;
    validity: number;
    uniqueness: number;
  };
}

// ─── Content list item ────────────────────────────────────────────────────────

const ContentItem: React.FC<{ label: string; index: number }> = ({ label, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -6 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.04 }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '7px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: '0.8rem',
      color: 'var(--text-secondary)',
    }}
  >
    <CheckCircle size={13} color="var(--status-success)" style={{ flexShrink: 0 }} />
    {label}
  </motion.div>
);

// ─── Download card ────────────────────────────────────────────────────────────

interface DownloadCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badgeLabel: string;
  estimatedSize: string;
  buttonLabel: string;
  onClick: () => void;
  delay?: number;
}

const DownloadCard: React.FC<DownloadCardProps> = ({
  icon,
  title,
  description,
  badgeLabel,
  estimatedSize,
  buttonLabel,
  onClick,
  delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className="card-precision"
    style={{
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}
  >
    <div>
      {/* Icon & Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '10px',
            background: 'var(--accent-primary-light)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
        <span className="badge-subtle badge-info" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
          {badgeLabel}
        </span>
      </div>

      <h2 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{description}</p>
    </div>

    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        <Database size={11} />
        Estimated size: {estimatedSize}
      </div>

      <button
        onClick={onClick}
        className="btn-primary"
        style={{
          width: '100%',
          height: '38px',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <Download size={14} />
        {buttonLabel}
      </button>
    </div>
  </motion.div>
);

// ─── Info stat box ────────────────────────────────────────────────────────────

const StatBox: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div
    style={{
      background: 'var(--bg-canvas)',
      borderRadius: '8px',
      border: '1px solid var(--border-default)',
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '6px',
        background: 'var(--accent-primary-light)',
        color: 'var(--accent-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div>
      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</p>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  const { activeDataset } = useStore();
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);

  useEffect(() => {
    if (!activeDataset) return;
    getQualityScore(activeDataset.id)
      .then(setQualityScore)
      .catch(() => {});
  }, [activeDataset?.id]);

  if (!activeDataset) {
    return (
      <EmptyState
        title="No Dataset Selected"
        description="Upload or select a dataset to generate reports."
      />
    );
  }

  const handlePDFDownload = async () => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf' });
      await downloadPDFReport(activeDataset.id);
      toast.success('PDF report downloaded!', { id: 'pdf' });
    } catch {
      toast.error('Failed to download PDF', { id: 'pdf' });
    }
  };

  const handleExcelDownload = async () => {
    try {
      toast.loading('Generating Excel...', { id: 'excel' });
      await downloadExcelReport(activeDataset.id);
      toast.success('Excel report downloaded!', { id: 'excel' });
    } catch {
      toast.error('Failed to download Excel', { id: 'excel' });
    }
  };

  const handleJupyterDownload = async () => {
    try {
      toast.loading('Generating Notebook...', { id: 'jupyter' });
      await downloadJupyterReport(activeDataset.id);
      toast.success('Jupyter Notebook downloaded!', { id: 'jupyter' });
    } catch {
      toast.error('Failed to download Notebook', { id: 'jupyter' });
    }
  };

  const { dataset_info } = activeDataset;

  const pdfContents = [
    'Dataset Overview & Summary',
    'EDA Summary with Statistics',
    'Data Quality Grade & Score',
    'Comprehensive Column Profiles',
    'AI Key Findings & Trends',
    'ML Readiness Diagnostics',
  ];

  const excelContents = [
    'Sheet 1: Raw Data',
    'Sheet 2: Descriptive Statistics',
    'Sheet 3: Correlations',
    'Sheet 4: Missing Values',
    'Sheet 5: Summary',
  ];

  const jupyterContents = [
    'Cell 1: Environment Setup',
    'Cell 2: Data Loading',
    'Cell 3: Exact Cleaning Steps',
    'Cell 4: Exploratory Analysis',
    'Standard ML Boilerplate',
  ];

  return (
    <div style={{ paddingBottom: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Reports & Export Center
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
          Generate and download executive reports for <strong style={{ color: 'var(--text-primary)' }}>{activeDataset.filename}</strong>
        </p>
      </div>

      {/* ── Download cards ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '18px',
          marginBottom: '24px',
        }}
      >
        <DownloadCard
          icon={<FileText size={22} />}
          title="Executive PDF Report"
          description="A publication-grade document containing executive summaries, structured statistics, data quality assessments, and ML recommendations."
          badgeLabel="PDF"
          estimatedSize="~1-2 MB"
          buttonLabel="Download PDF Report"
          onClick={handlePDFDownload}
          delay={0}
        />
        <DownloadCard
          icon={<Database size={22} />}
          title="Excel Workbook Report"
          description="Multi-sheet Excel workbook with raw data, descriptive statistics, correlation matrix, and summary sheets."
          badgeLabel="XLSX"
          estimatedSize="~1-3 MB"
          buttonLabel="Download Excel Report"
          onClick={handleExcelDownload}
          delay={0.1}
        />
        <DownloadCard
          icon={<Code size={22} />}
          title="Jupyter Notebook"
          description="A programmatic notebook containing the Python code to reproduce your cleaning, transformations, and visualization steps."
          badgeLabel="IPYNB"
          estimatedSize="~10-50 KB"
          buttonLabel="Generate Notebook"
          onClick={handleJupyterDownload}
          delay={0.2}
        />
      </div>

      {/* ── What's included ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <h2 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Report Specifications & Breakdown
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* PDF contents */}
          <div className="card-precision" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FileText size={16} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>PDF Structure</h3>
            </div>
            {pdfContents.map((item, i) => (
              <ContentItem key={i} label={item} index={i} />
            ))}
          </div>

          {/* Excel contents */}
          <div className="card-precision" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Table2 size={16} color="var(--status-success)" />
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>Workbook Sheets</h3>
            </div>
            {excelContents.map((item, i) => (
              <ContentItem key={i} label={item} index={i} />
            ))}
          </div>

          {/* Jupyter contents */}
          <div className="card-precision" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Code size={16} color="var(--status-warning)" />
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notebook Sequence</h3>
            </div>
            {jupyterContents.map((item, i) => (
              <ContentItem key={i} label={item} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Dataset info card ───────────────────────────────────────────────── */}
      <div className="card-precision" style={{ padding: '18px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          <Database size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--accent-primary)' }} />
          Target Dataset Metadata
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <StatBox
            label="Filename"
            value={activeDataset.filename.length > 18 ? activeDataset.filename.slice(0, 18) + '...' : activeDataset.filename}
            icon={<Database size={15} />}
          />
          <StatBox
            label="Total Rows"
            value={dataset_info.rows.toLocaleString()}
            icon={<Database size={15} />}
          />
          <StatBox
            label="Total Columns"
            value={dataset_info.columns}
            icon={<Database size={15} />}
          />
          <StatBox
            label="Quality Score"
            value={
              qualityScore
                ? `${qualityScore.score.toFixed(1)}%`
                : `${(dataset_info.completeness_score * 100).toFixed(1)}%`
            }
            icon={<Database size={15} />}
          />
        </div>

        {/* Quality breakdown */}
        {qualityScore && (
          <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {Object.entries(qualityScore.breakdown).map(([key, val]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key}</span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-primary)', fontWeight: 600 }}>{val.toFixed(0)}%</span>
                </div>
                <div style={{ height: '5px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{ width: `${val}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tip box ─────────────────────────────────────────────────────────── */}
      <div
        className="card-precision"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '14px 18px',
          background: 'var(--bg-surface-raised)',
        }}
      >
        <Clock size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Processing Pipeline Notice
          </p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Report generation may take <strong style={{ color: 'var(--text-primary)' }}>10–20 seconds</strong> for comprehensive datasets.
            Files are compiled and streamed directly to your browser download manager.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
