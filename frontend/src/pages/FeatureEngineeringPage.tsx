import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Layers,
  TrendingUp,
  Filter,
  ZoomIn,
  ChevronDown,
  CheckCircle,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { runPCA, polynomialFeatures, featureSelection, varianceThreshold, suggestFeatures, applySuggestedFeature } from '../services/api';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import BarChartComponent from '../components/charts/BarChartComponent';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PCAResult {
  explained_variance_ratio: number[];
  components: number[][];
  transformed_preview: unknown;
}

interface PolyResult {
  new_features: string[];
  preview: unknown;
}

interface SelectionResult {
  selected_features: string[];
  scores: Record<string, number>;
  dropped_features: string[];
  all_scores?: Array<{ feature: string; score: number; selected: boolean }>;
}

interface VarianceResult {
  removed_features: string[];
  remaining_features: string[];
}

// ─── Expandable card wrapper ─────────────────────────────────────────────────

interface ExpandableCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const ExpandableCard: React.FC<ExpandableCardProps> = ({
  title,
  subtitle,
  icon,
  isExpanded,
  onToggle,
  children,
}) => (
  <div
    className="card-precision"
    style={{ overflow: 'hidden', padding: 0 }}
  >
    {/* Header */}
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 18px',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '8px',
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
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</p>
          <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
        </div>
      </div>
      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
        <ChevronDown size={16} color="var(--text-secondary)" />
      </motion.div>
    </button>

    {/* Animated body */}
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{ padding: '0 18px 18px' }}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ─── Multi-select checkboxes ─────────────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange }) => {
  const toggleItem = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label style={labelStyle}>{label}</label>
        <button
          onClick={toggleAll}
          style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: '0 4px' }}
        >
          {selected.length === options.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div
        style={{
          maxHeight: '140px',
          overflowY: 'auto',
          background: 'var(--bg-canvas)',
          borderRadius: '8px',
          border: '1px solid var(--border-default)',
          padding: '6px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
        }}
      >
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggleItem(opt)}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              border: `1px solid ${selected.includes(opt) ? 'var(--accent-primary)' : 'var(--border-default)'}`,
              background: selected.includes(opt) ? 'var(--accent-primary-light)' : 'var(--bg-surface)',
              color: selected.includes(opt) ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {opt}
          </button>
        ))}
        {options.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', padding: '4px 6px' }}>No numeric columns available</span>
        )}
      </div>
    </div>
  );
};

// ─── Result success banner ────────────────────────────────────────────────────

const SuccessBanner: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      background: 'var(--status-success-bg, rgba(16, 185, 129, 0.08))',
      borderRadius: '6px',
      border: '1px solid var(--border-default)',
      marginBottom: '12px',
      fontSize: '0.78rem',
      color: 'var(--status-success)',
    }}
  >
    <CheckCircle size={13} />
    {message}
  </div>
);

// ─── Label style helper ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
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

// ─── Main component ───────────────────────────────────────────────────────────

const FeatureEngineeringPage: React.FC = () => {
  const { activeDataset } = useStore();

  const numericCols = activeDataset?.dataset_info?.column_types?.numeric ?? [];
  const allCols = activeDataset?.dataset_info?.column_details?.map((c) => c.name) ?? [];

  // Suggested Features state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [skippedSuggestions, setSkippedSuggestions] = useState<string[]>([]);

  const fetchSuggestions = async () => {
    if (!activeDataset) return;
    try {
      const res = await suggestFeatures(activeDataset.id);
      setSuggestions(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [activeDataset?.id]);

  const handleApplySuggestion = async (sug: any) => {
    if (!activeDataset) return;
    try {
      let params = {};
      if (sug.type === 'date') {
        params = { column: sug.column };
      } else if (sug.type === 'ratio') {
        params = { column1: sug.column1, column2: sug.column2 };
      }
      
      await applySuggestedFeature(activeDataset.id, sug.type, params);
      toast.success(`Successfully applied feature: ${sug.title}`);
      
      // Remove suggestion
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply suggested feature');
    }
  };

  const handleSkipSuggestion = (sugId: string) => {
    setSkippedSuggestions(prev => [...prev, sugId]);
  };

  // ── Expanded state ─────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    pca: false,
    poly: false,
    selection: false,
    variance: false,
  });

  const toggleExpand = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── PCA state ──────────────────────────────────────────────────────────────
  const [pcaNComponents, setPcaNComponents] = useState(2);
  const [pcaColumns, setPcaColumns] = useState<string[]>([]);
  const [pcaLoading, setPcaLoading] = useState(false);
  const [pcaResult, setPcaResult] = useState<PCAResult | null>(null);

  const handleRunPCA = async () => {
    if (!activeDataset) return;
    setPcaLoading(true);
    try {
      const result = (await runPCA(activeDataset.id, {
        n_components: pcaNComponents,
        columns: pcaColumns.length > 0 ? pcaColumns : undefined,
      })) as any;
      setPcaResult(result);
      toast.success('PCA completed successfully!');
    } catch {
      toast.error('PCA failed. Please check your parameters.');
    } finally {
      setPcaLoading(false);
    }
  };

  // ── Polynomial Features state ──────────────────────────────────────────────
  const [polyDegree, setPolyDegree] = useState(2);
  const [polyColumns, setPolyColumns] = useState<string[]>([]);
  const [polyInteractionOnly, setPolyInteractionOnly] = useState(false);
  const [polyLoading, setPolyLoading] = useState(false);
  const [polyResult, setPolyResult] = useState<PolyResult | null>(null);

  const handlePolyFeatures = async () => {
    if (!activeDataset) return;
    setPolyLoading(true);
    try {
      const result = (await polynomialFeatures(activeDataset.id, {
        degree: polyDegree,
        columns: polyColumns.length > 0 ? polyColumns : undefined,
        interaction_only: polyInteractionOnly,
      })) as any;
      setPolyResult(result);
      toast.success(`Generated ${result.new_features.length} new features!`);
    } catch {
      toast.error('Polynomial feature generation failed.');
    } finally {
      setPolyLoading(false);
    }
  };

  // ── Feature Selection state ────────────────────────────────────────────────
  const [selMethod, setSelMethod] = useState('correlation');
  const [selTarget, setSelTarget] = useState('');
  const [selK, setSelK] = useState(10);
  const [selLoading, setSelLoading] = useState(false);
  const [selResult, setSelResult] = useState<SelectionResult | null>(null);

  const handleFeatureSelection = async () => {
    if (!activeDataset) return;
    if (!selTarget) {
      toast.error('Please select a target column.');
      return;
    }
    setSelLoading(true);
    try {
      const result = (await featureSelection(activeDataset.id, {
        target_column: selTarget,
        k: selK,
        problem_type: numericCols.includes(selTarget) ? 'regression' : 'classification',
      })) as any;
      setSelResult(result);
      toast.success(`Selected ${result.selected_features.length} features!`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Feature selection failed.');
    } finally {
      setSelLoading(false);
    }
  };

  // ── Variance Threshold state ───────────────────────────────────────────────
  const [varThreshold, setVarThreshold] = useState(0.01);
  const [varLoading, setVarLoading] = useState(false);
  const [varResult, setVarResult] = useState<VarianceResult | null>(null);

  const handleVarianceThreshold = async () => {
    if (!activeDataset) return;
    setVarLoading(true);
    try {
      const result = (await varianceThreshold(activeDataset.id, varThreshold)) as any;
      setVarResult({
        removed_features: result.removed_features,
        remaining_features: result.kept_features,
      });
      toast.success(`Removed ${result.removed_features.length} low-variance features!`);
    } catch {
      toast.error('Variance threshold failed.');
    } finally {
      setVarLoading(false);
    }
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!activeDataset) {
    return (
      <EmptyState
        title="No Dataset Selected"
        description="Upload or select a dataset to start feature engineering."
        actionText="Upload Dataset"
        actionLink="/dashboard/upload"
      />
    );
  }

  // ── PCA chart data ─────────────────────────────────────────────────────────
  const pcaChartData = pcaResult?.explained_variance_ratio.map((v, i) => ({
    name: `PC${i + 1}`,
    value: parseFloat((v * 100).toFixed(2)),
  })) ?? [];

  const totalExplained = pcaResult
    ? (pcaResult.explained_variance_ratio.reduce((a, b) => a + b, 0) * 100).toFixed(1)
    : null;

  const droppedFeatures = selResult?.all_scores
    ? selResult.all_scores.filter((s: any) => !s.selected).map((s: any) => s.feature)
    : [];

  return (
    <div style={{ paddingBottom: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Feature Engineering Studio
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
          Transform, synthesize, and filter feature subsets for <strong style={{ color: 'var(--text-primary)' }}>{activeDataset.filename}</strong>
          {' '}— {numericCols.length} numeric columns available
        </p>
      </div>

      {/* Suggested Features Card */}
      {suggestions.filter(s => !skippedSuggestions.includes(s.id)).length > 0 && (
        <div className="card-precision" style={{ padding: '20px', marginBottom: '24px', border: '1px dashed var(--accent-primary)' }}>
          <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💡 Suggested Feature Engineering Transformations</span>
          </h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            We detected columns in your dataset that could benefit from automated feature extraction:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {suggestions.filter(s => !skippedSuggestions.includes(s.id)).map(sug => (
              <div key={sug.id} style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>{sug.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{sug.description}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem', height: '28px' }} onClick={() => handleApplySuggestion(sug)}>
                    Apply
                  </button>
                  <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.7rem', height: '28px' }} onClick={() => handleSkipSuggestion(sug.id)}>
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-column grid of expandable cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '18px',
          alignItems: 'start',
        }}
      >
        {/* ── 1. PCA ──────────────────────────────────────────────────────── */}
        <ExpandableCard
          title="Principal Component Analysis (PCA)"
          subtitle="Dimensionality reduction via orthogonal transformation"
          icon={<Layers size={17} />}
          isExpanded={expanded.pca}
          onToggle={() => toggleExpand('pca')}
        >
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            {/* n_components */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Number of Components</label>
              <input
                type="number"
                min={1}
                max={10}
                value={pcaNComponents}
                onChange={(e) => setPcaNComponents(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            {/* Column selection */}
            <MultiSelect
              label="Feature Subset (leave empty for all numeric)"
              options={numericCols}
              selected={pcaColumns}
              onChange={setPcaColumns}
            />

            <button
              className="btn-primary"
              onClick={handleRunPCA}
              disabled={pcaLoading}
              style={{ width: '100%', height: '36px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {pcaLoading ? <LoadingSpinner /> : <Layers size={14} />}
              {pcaLoading ? 'Running PCA…' : 'Execute PCA'}
            </button>

            {/* Result */}
            <AnimatePresence>
              {pcaResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: '14px' }}
                >
                  <SuccessBanner message={`PCA complete — ${totalExplained}% cumulative variance explained`} />
                  <p style={labelStyle}>Explained Variance per Component (%)</p>
                  <div className="chart-container" style={{ height: 180, background: 'var(--bg-canvas)', borderRadius: '8px', border: '1px solid var(--border-default)', padding: '10px' }}>
                    <BarChartComponent
                      data={pcaChartData}
                      color="var(--accent-primary)"
                      yLabel="Variance %"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ExpandableCard>

        {/* ── 2. Polynomial Features ──────────────────────────────────────── */}
        <ExpandableCard
          title="Polynomial &amp; Interaction Terms"
          subtitle="Synthesize non-linear feature interaction pairs"
          icon={<TrendingUp size={17} />}
          isExpanded={expanded.poly}
          onToggle={() => toggleExpand('poly')}
        >
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            {/* Degree */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Polynomial Degree</label>
              <select
                value={polyDegree}
                onChange={(e) => setPolyDegree(Number(e.target.value))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value={2}>Degree 2 (Quadratic)</option>
                <option value={3}>Degree 3 (Cubic)</option>
                <option value={4}>Degree 4 (Quartic)</option>
              </select>
            </div>

            {/* Columns */}
            <MultiSelect
              label="Columns (leave empty for all numeric)"
              options={numericCols}
              selected={polyColumns}
              onChange={setPolyColumns}
            />

            {/* Interaction only */}
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="interaction-only"
                checked={polyInteractionOnly}
                onChange={(e) => setPolyInteractionOnly(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--accent-primary)' }}
              />
              <label htmlFor="interaction-only" style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer' }}>
                Interaction terms only (exclude polynomial powers)
              </label>
            </div>

            <button
              className="btn-primary"
              onClick={handlePolyFeatures}
              disabled={polyLoading}
              style={{ width: '100%', height: '36px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {polyLoading ? <LoadingSpinner /> : <TrendingUp size={14} />}
              {polyLoading ? 'Generating…' : 'Generate Polynomial Features'}
            </button>

            {/* Result */}
            <AnimatePresence>
              {polyResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '14px' }}>
                  <SuccessBanner message={`Created ${polyResult.new_features.length} synthesized features`} />
                  <p style={labelStyle}>New Feature Names</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                    {polyResult.new_features.map((f) => (
                      <span key={f} className="badge-subtle badge-info" style={{ fontSize: '0.7rem' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ExpandableCard>

        {/* ── 3. Feature Selection ────────────────────────────────────────── */}
        <ExpandableCard
          title="Supervised Feature Selection"
          subtitle="Rank and retain the most predictive predictors"
          icon={<Filter size={17} />}
          isExpanded={expanded.selection}
          onToggle={() => toggleExpand('selection')}
        >
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            {/* Method */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Scoring Algorithm</label>
              <select
                value={selMethod}
                onChange={(e) => setSelMethod(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="correlation">Correlation (ANOVA / F-Test)</option>
                <option value="mutual_info">Mutual Information</option>
                <option value="rfe">Recursive Feature Elimination (RFE)</option>
              </select>
            </div>

            {/* Target column */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Target Variable</label>
              <select
                value={selTarget}
                onChange={(e) => setSelTarget(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">— Select Target Column —</option>
                {allCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* K */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Top K Features</label>
              <input
                type="number"
                min={1}
                max={allCols.length}
                value={selK}
                onChange={(e) => setSelK(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <button
              className="btn-primary"
              onClick={handleFeatureSelection}
              disabled={selLoading}
              style={{ width: '100%', height: '36px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {selLoading ? <LoadingSpinner /> : <Filter size={14} />}
              {selLoading ? 'Selecting…' : 'Run Feature Selection'}
            </button>

            {/* Result */}
            <AnimatePresence>
              {selResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '14px' }}>
                  <SuccessBanner message={`${selResult.selected_features.length} selected, ${droppedFeatures.length} dropped`} />

                  <p style={labelStyle}>Selected Predictors</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                    {selResult.selected_features.map((f: string) => (
                      <span key={f} className="badge-subtle badge-success" style={{ fontSize: '0.7rem' }}>{f}</span>
                    ))}
                  </div>

                  {droppedFeatures.length > 0 && (
                    <>
                      <p style={labelStyle}>Excluded Predictors</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                        {droppedFeatures.map((f: string) => (
                          <span key={f} className="badge-subtle" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{f}</span>
                        ))}
                      </div>
                    </>
                  )}

                  {selResult.all_scores && selResult.all_scores.length > 0 && (
                    <>
                      <p style={labelStyle}>Predictor Scores</p>
                      <div style={{ overflowX: 'auto', background: 'var(--bg-canvas)', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Feature</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(selResult.all_scores)
                              .map(([k, v]: any) => [v.feature, v.score])
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 8)
                              .map(([feat, score]: any) => (
                                <tr key={feat} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                  <td style={{ padding: '5px 10px' }}>
                                    <code style={{ color: 'var(--accent-primary)', fontSize: '0.72rem' }}>{feat}</code>
                                  </td>
                                  <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                                    {score.toFixed(4)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ExpandableCard>

        {/* ── 4. Variance Threshold ───────────────────────────────────────── */}
        <ExpandableCard
          title="Variance Threshold Filtering"
          subtitle="Prune low-information features with near-zero dispersion"
          icon={<ZoomIn size={17} />}
          isExpanded={expanded.variance}
          onToggle={() => toggleExpand('variance')}
        >
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Dispersion Threshold (0.0 – 1.0)</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={varThreshold}
                onChange={(e) => setVarThreshold(Number(e.target.value))}
                style={inputStyle}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Features with variance strictly below this threshold will be flagged.
              </p>
            </div>

            <button
              className="btn-primary"
              onClick={handleVarianceThreshold}
              disabled={varLoading}
              style={{ width: '100%', height: '36px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {varLoading ? <LoadingSpinner /> : <ZoomIn size={14} />}
              {varLoading ? 'Applying…' : 'Apply Variance Filter'}
            </button>

            {/* Result */}
            <AnimatePresence>
              {varResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '14px' }}>
                  <SuccessBanner message={`${varResult.removed_features.length} features pruned, ${varResult.remaining_features.length} retained`} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        padding: '10px',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--status-danger)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 2 }}>
                        Pruned
                      </p>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-danger)' }}>
                        {varResult.removed_features.length}
                      </p>
                    </div>
                    <div
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        padding: '10px',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--status-success)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 2 }}>
                        Retained
                      </p>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-success)' }}>
                        {varResult.remaining_features.length}
                      </p>
                    </div>
                  </div>

                  {varResult.removed_features.length > 0 && (
                    <>
                      <p style={labelStyle}>Pruned Features</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {varResult.removed_features.map((f) => (
                          <span key={f} className="badge-subtle badge-warning" style={{ fontSize: '0.7rem' }}>{f}</span>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ExpandableCard>
      </div>
    </div>
  );
};

export default FeatureEngineeringPage;
