import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Link as LinkIcon,
  CheckCircle,
  FileSpreadsheet,
  FileCode,
  FileType,
  Sparkles,
  Info,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { uploadDataset, uploadFromUrl } from '../services/api';
import DropZone from '../components/upload/DropZone';
import DataTable from '../components/ui/DataTable';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const TIPS = [
  'CSV format provides the fastest ingestion speeds. Keep column headers in the first row.',
  'Excel workbooks (.xlsx/.xls) support multi-sheet data; the active primary sheet is parsed.',
  'JSON records and nested hierarchies are flattened into standardized columnar structures automatically.',
  'Data privacy note: files are securely parsed in memory for exploratory analysis and model training.',
];

const FormatCard: React.FC<{ ext: string; label: string; color: string; description: string }> = ({ ext, label, color, description }) => (
  <div
    className="card-precision"
    style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}
  >
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        borderRadius: '8px',
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-default)',
        color,
        fontWeight: 700,
        fontSize: '0.78rem',
        letterSpacing: '0.04em',
      }}
    >
      {ext}
    </div>
    <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.88rem' }}>{label}</p>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.45 }}>{description}</p>
  </div>
);

const UploadPage: React.FC = () => {
  const { isUploading, setIsUploading, uploadProgress, setUploadProgress, addDataset, setActiveDataset } = useStore();
  const [uploadedDataset, setUploadedDataset] = useState<any>(null);
  const [urlInput, setUrlInput] = useState('');

  const handleFileDrop = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedDataset(null);

    try {
      const result = await uploadDataset(file, (pct: number) => {
        setUploadProgress(pct);
      });
      setUploadProgress(100);
      setUploadedDataset(result);
      addDataset(result as any);
      setActiveDataset(result as any);
      setTimeout(() => {
        setIsUploading(false);
      }, 300);
      toast.success('Dataset ingested successfully!');
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed. Please check file format.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [setIsUploading, setUploadProgress, addDataset, setActiveDataset]);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedDataset(null);

    try {
      const result = await uploadFromUrl(urlInput);
      setUploadProgress(100);
      setUploadedDataset(result);
      addDataset(result as any);
      setActiveDataset(result as any);
      setTimeout(() => setIsUploading(false), 300);
      toast.success('Dataset imported from public URL!');
      setUrlInput('');
    } catch (err: any) {
      toast.error(err?.message ?? 'Import failed. Verify public URL and structure.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '22px' }}>
        <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Ingest Dataset
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Upload local tabular files or import remote HTTP endpoints to initialize analytics
        </p>
      </motion.div>

      {/* Drop zone */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: '16px' }}>
        <DropZone onFileDrop={handleFileDrop} isUploading={isUploading} progress={uploadProgress} />
      </motion.div>

      {/* URL Import */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: '26px' }}>
        <div className="card-precision" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <LinkIcon size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Import via Public HTTP URL
            </span>
          </div>
          <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://raw.githubusercontent.com/dataset.csv"
              disabled={isUploading}
              className="input-precision"
              style={{ flex: 1, fontSize: '0.86rem' }}
            />
            <button
              type="submit"
              disabled={isUploading || !urlInput}
              className="btn-primary"
              style={{
                padding: '0 20px',
                fontSize: '0.84rem',
                opacity: isUploading || !urlInput ? 0.5 : 1,
                cursor: isUploading || !urlInput ? 'not-allowed' : 'pointer',
              }}
            >
              Fetch & Ingest
            </button>
          </form>
        </div>
      </motion.div>

      {/* Preview Section */}
      <AnimatePresence>
        {uploadedDataset && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ marginBottom: '26px' }}
          >
            <div className="card-precision" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={18} color="var(--color-success)" />
                  <h2 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Schema Profile: {uploadedDataset.filename}
                  </h2>
                </div>
                <span className="badge-subtle badge-success">
                  {uploadedDataset.dataset_info?.rows?.toLocaleString()} Rows Ingested
                </span>
              </div>

              {/* Stat Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '10px 14px', borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Columns</p>
                  <p style={{ margin: '2px 0 0', color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 800 }}>{uploadedDataset.dataset_info?.columns}</p>
                </div>
                <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '10px 14px', borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>File Size</p>
                  <p style={{ margin: '2px 0 0', color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 800 }}>{uploadedDataset.file_size_mb?.toFixed(2)} MB</p>
                </div>
                <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '10px 14px', borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Missing Values</p>
                  <p style={{ margin: '2px 0 0', color: 'var(--accent-amber)', fontSize: '1.15rem', fontWeight: 800 }}>{uploadedDataset.dataset_info?.missing_values_total?.toLocaleString()}</p>
                </div>
                <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '10px 14px', borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Completeness</p>
                  <p style={{ margin: '2px 0 0', color: 'var(--color-success)', fontSize: '1.15rem', fontWeight: 800 }}>{uploadedDataset.dataset_info?.completeness_score?.toFixed(1)}%</p>
                </div>
              </div>

              {/* Preview table */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tabular Preview</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>First {uploadedDataset.preview?.records?.length} records</p>
                </div>
                <DataTable
                  columns={uploadedDataset.preview?.columns || []}
                  data={uploadedDataset.preview?.records || []}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Supported Formats */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Supported Schema Types
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px' }}>
          <FormatCard ext="CSV" label="Comma-Separated Values" color="var(--accent-primary)" description="Standard UTF-8 formatted comma or tab delimited tabular datasets." />
          <FormatCard ext="XLSX" label="Excel Workbook" color="var(--color-success)" description="Modern Microsoft Excel spreadsheets with automated multi-sheet parsing." />
          <FormatCard ext="XLS" label="Legacy Excel" color="var(--accent-teal)" description="Excel 97-2003 binary formats automatically mapped to structured memory." />
          <FormatCard ext="JSON" label="JSON Records / Objects" color="var(--accent-amber)" description="Array of objects or dictionary series parsed into columnar tables." />
        </div>
      </div>

      {/* Tips */}
      <div className="card-precision" style={{ padding: '16px 20px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={15} color="var(--accent-primary)" />
          Best Practices & Performance Guidelines
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {TIPS.map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>•</span>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
