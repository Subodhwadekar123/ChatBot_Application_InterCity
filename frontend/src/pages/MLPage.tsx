import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import { detectProblemType, trainModel, compareModels } from '../services/api';
import toast from 'react-hot-toast';
import {
  Brain,
  Play,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  Sparkles,
  Table,
  Check,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MLPage() {
  const { activeDataset } = useStore();
  const [targetCol, setTargetCol] = useState('');
  const [problemType, setProblemType] = useState<any>(null);
  const [algorithm, setAlgorithm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [comparisonResults, setComparisonResults] = useState<any>(null);

  // What-If live simulator state
  const [, setSimulatorInputs] = useState<Record<string, number>>({});

  if (!activeDataset) return <EmptyState />;

  const cols = [
    ...(activeDataset.dataset_info.column_types.numeric || []),
    ...(activeDataset.dataset_info.column_types.categorical || []),
    ...(activeDataset.dataset_info.column_types.boolean || []),
  ];

  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
  };

  const handleDetect = async () => {
    if (!targetCol) return;
    try {
      setLoading(true);
      setResults(null);
      setComparisonResults(null);
      const res: any = await detectProblemType(activeDataset.id, targetCol);
      setProblemType(res);
      const recommended = res.recommended_algorithms?.[0]?.id || '';
      setAlgorithm(recommended);
      toast.success(`Detected ${res.problem_type.toUpperCase()} problem`);
    } catch (err: any) {
      toast.error(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    try {
      setLoading(true);
      const res: any = await trainModel(activeDataset.id, {
        target_column: targetCol,
        algorithm: algorithm,
        test_size: 0.2,
      });
      setResults(res);
      
      // Initialize simulator with the first preview row or default zeros
      if (res.predictions_preview && res.predictions_preview.length > 0) {
        const sampleFeats = res.predictions_preview[0].features;
        const initialInputs: Record<string, number> = {};
        Object.keys(sampleFeats).forEach((k) => {
          initialInputs[k] = Number(sampleFeats[k]) || 0;
        });
        setSimulatorInputs(initialInputs);
      }
      toast.success(`Trained ${res.algorithm} with ${res.accuracy_summary?.overall_accuracy_pct ?? ''}% accuracy!`);
    } catch (err: any) {
      toast.error(err.message || 'Training failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!targetCol || !problemType) return;
    try {
      setLoading(true);
      const algos = problemType.recommended_algorithms.map((a: any) => a.id);
      const res: any = await compareModels(activeDataset.id, {
        target_column: targetCol,
        algorithms: algos,
        test_size: 0.2,
      });
      setComparisonResults(res);
      toast.success('Model comparison completed!');
    } catch (err: any) {
      toast.error(err.message || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '60px', maxWidth: '1600px', margin: '0 auto' }}>
      <SectionHeader
        title="Machine Learning & Prediction Studio"
        subtitle="AutoML pipeline: Detect problem type, train models, inspect percentage accuracy, and explore actual predictions."
        icon={<Brain />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        
        {/* ── STEP 1 & 2: SETUP & TRAINING ─────────────────────────────────── */}
        <div className="card-precision" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            
            {/* Target Selector */}
            <div style={{ flex: '1 1 300px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                1. Select Target Variable to Predict
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  className="input-precision"
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  style={{ flex: 1, height: '36px', fontSize: '0.82rem' }}
                >
                  <option value="">-- Choose Column to Predict --</option>
                  {cols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-primary"
                  onClick={handleDetect}
                  disabled={!targetCol || loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
                >
                  <Sparkles size={14} /> Detect
                </button>
              </div>
            </div>

            {/* Algorithm Selector & Actions */}
            {problemType && (
              <div style={{ flex: '2 1 420px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                  2. Select Algorithm ({problemType.problem_type.toUpperCase()} • {problemType.reason})
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <select
                    className="input-precision"
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value)}
                    style={{ flex: '1 1 220px', height: '36px', fontSize: '0.82rem' }}
                  >
                    {problemType.recommended_algorithms?.map((algo: any, idx: number) => (
                      <option key={algo.id} value={algo.id}>
                        {algo.name} {idx === 0 ? '⭐ (Recommended)' : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-primary"
                      onClick={handleTrain}
                      disabled={loading || !algorithm}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
                    >
                      <Play size={14} /> Train & Predict
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleCompare}
                      disabled={loading}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 12px', fontSize: '0.82rem' }}
                    >
                      <BarChart2 size={14} /> Compare All
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── LOADING ANIMATION ────────────────────────────────────────────── */}
        {loading && (
          <div className="card-precision" style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-primary)' }}>
            <Brain size={44} className="animate-spin" style={{ margin: '0 auto 14px', animationDuration: '4s' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Training & Evaluating ML Model...
            </h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto', fontSize: '0.82rem' }}>
              Preprocessing features, performing 80/20 train-test split, fitting {algorithm}, calculating percentage accuracy, and computing actual prediction differences.
            </p>
          </div>
        )}

        {/* ── RESULTS: HERO ACCURACY & METRICS CARDS ───────────────────────── */}
        <AnimatePresence>
          {!loading && results && (
            <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 🌟 HERO ACCURACY RATE BANNER */}
              <motion.div
                variants={fadeUp}
                className="card-precision"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-primary)', fontWeight: 700 }}>
                      Model Performance Summary
                    </span>
                    <span className={`badge-subtle ${results.accuracy_summary?.rating === 'Outstanding' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                      {results.accuracy_summary?.rating || 'Evaluated'}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {results.accuracy_summary?.headline || `${results.algorithm.toUpperCase()} Evaluation`}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                    Algorithm: <strong style={{ color: 'var(--text-primary)' }}>{results.algorithm}</strong> • Trained on {results.n_samples_train} samples • Tested on {results.n_samples_test} samples
                  </p>
                </div>

                {/* Big Accuracy Percentage Box */}
                <div style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  textAlign: 'center',
                  minWidth: '160px'
                }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                    {results.problem_type === 'regression' ? 'Variance Explained (R²)' : 'Overall Accuracy'}
                  </span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '-0.02em' }}>
                    {results.accuracy_summary?.overall_accuracy_pct != null ? `${results.accuracy_summary.overall_accuracy_pct}%` : 'N/A'}
                  </div>
                  {results.problem_type === 'regression' && results.accuracy_summary?.within_10pct_accuracy != null && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--status-success)', fontWeight: 600 }}>
                      {results.accuracy_summary.within_10pct_accuracy}% within ±10% error
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Detailed Metrics Grid & Feature Importance */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                
                {/* Metrics Breakdown Card */}
                <motion.div variants={fadeUp} className="card-precision" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <CheckCircle2 size={18} color="var(--status-success)" />
                    <h3 style={{ fontSize: '0.96rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                      Detailed Evaluation Metrics
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                    {Object.entries(results.metrics || {})
                      .filter(([k]) => k !== 'confusion_matrix' && k !== 'roc_curve')
                      .map(([key, value]: [string, any]) => {
                        const isPercentage = key.includes('accuracy') || key.includes('precision') || key.includes('recall') || key.includes('f1') || key.includes('r2');
                        return (
                          <div key={key} style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                              {key.replace('_', ' ')}
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {typeof value === 'number'
                                ? (isPercentage ? `${(value * 100).toFixed(2)}%` : value.toFixed(4))
                                : String(value)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>

                {/* Feature Importance Card */}
                {results.feature_importances && results.feature_importances.length > 0 && (
                  <motion.div variants={fadeUp} className="card-precision" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <TrendingUp size={18} color="var(--accent-primary)" />
                      <h3 style={{ fontSize: '0.96rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                        Feature Importance (Impact Drivers)
                      </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {results.feature_importances.slice(0, 7).map((item: any) => {
                        const pct = (item.importance * 100).toFixed(1);
                        return (
                          <div key={item.feature}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '3px' }}>
                              <span style={{ fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.feature}
                              </span>
                              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{pct}%</span>
                            </div>
                            <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

              </div>

              {/* ── 🔍 ACTUAL VS. PREDICTED PREVIEW TABLE ─────────────────────── */}
              {results.predictions_preview && results.predictions_preview.length > 0 && (
                <motion.div variants={fadeUp} className="card-precision" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Table size={18} color="var(--accent-primary)" />
                      <h3 style={{ fontSize: '0.96rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                        Actual vs. Predicted Sample Results
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Showing {results.predictions_preview.length} sample records from holdout test dataset
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>#</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>Actual Ground Truth</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>Model Predicted</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>
                            {results.problem_type === 'regression' ? 'Absolute Difference' : 'Match Status'}
                          </th>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>Accuracy Status</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600 }}>Input Features Snapshot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.predictions_preview.map((row: any) => (
                          <tr
                            key={row.row_id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: row.row_id % 2 === 0 ? 'var(--bg-canvas)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{row.row_id}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {String(row.actual)}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                              {String(row.predicted)}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {row.difference !== undefined ? (
                                <span style={{ color: row.difference > 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                                  {row.difference > 0 ? `+${row.difference}` : row.difference}
                                </span>
                              ) : (
                                row.status
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                className={`badge-subtle ${row.is_correct ? 'badge-success' : 'badge-danger'}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.72rem',
                                }}
                              >
                                {row.is_correct ? <Check size={11} /> : <X size={11} />}
                                {row.is_correct ? 'Accurate' : (row.error_pct ? `${row.error_pct}% off` : 'Incorrect')}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              {Object.entries(row.features)
                                .slice(0, 3)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MODEL COMPARISON RESULTS ──────────────────────────────────────── */}
        <AnimatePresence>
          {!loading && comparisonResults && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card-precision"
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <BarChart2 size={20} color="var(--accent-primary)" />
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                    Model Accuracy & Performance Benchmark
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '2px 0 0 0' }}>
                    Ranked by {problemType?.problem_type === 'regression' ? 'R² Variance Explained %' : 'Overall Accuracy %'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {comparisonResults.comparison
                  .filter((r: any) => !r.error)
                  .sort((a: any, b: any) => {
                    const metricA = problemType?.problem_type === 'regression' ? (a.metrics?.r2_score ?? 0) : (a.metrics?.accuracy ?? 0);
                    const metricB = problemType?.problem_type === 'regression' ? (b.metrics?.r2_score ?? 0) : (b.metrics?.accuracy ?? 0);
                    return metricB - metricA;
                  })
                  .map((r: any, idx: number) => {
                    const isReg = problemType?.problem_type === 'regression';
                    const metricName = isReg ? 'R² Variance Explained' : 'Overall Accuracy';
                    const metricVal = isReg ? r.metrics?.r2_score : r.metrics?.accuracy;
                    const pct = Math.max(0, Math.min(100, (metricVal ?? 0) * 100));
                    const algoName = problemType?.recommended_algorithms?.find((a: any) => a.id === r.algorithm)?.name || r.algorithm;

                    return (
                      <div
                        key={r.algorithm}
                        style={{
                          background: idx === 0 ? 'var(--accent-primary-light)' : 'var(--bg-canvas)',
                          border: `1px solid ${idx === 0 ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                          borderRadius: '8px',
                          padding: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {idx === 0 && (
                              <span className="badge-subtle badge-success" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                                BEST
                              </span>
                            )}
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{algoName}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.92rem' }}>
                            {metricName}: {pct.toFixed(2)}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: idx === 0 ? 'var(--status-success)' : 'var(--accent-primary)',
                              borderRadius: '3px',
                            }}
                          />
                        </div>

                        {/* Secondary Metrics */}
                        <div style={{ display: 'flex', gap: '14px', fontSize: '0.74rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          {Object.entries(r.metrics || {})
                            .filter(([k]) => k !== (isReg ? 'r2_score' : 'accuracy') && k !== 'confusion_matrix' && k !== 'roc_curve')
                            .slice(0, 4)
                            .map(([k, v]: [string, any]) => (
                              <span key={k}>
                                <strong style={{ color: 'var(--text-primary)' }}>{k.replace('_', ' ')}:</strong>{' '}
                                {typeof v === 'number' ? (v < 1 && v > 0 ? `${(v * 100).toFixed(1)}%` : v.toFixed(3)) : v}
                              </span>
                            ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
