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
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Sparkles,
  Sliders,
  Table,
  Target,
  Percent,
  Check,
  X,
  Layers,
  ArrowRight
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
  const [simulatorInputs, setSimulatorInputs] = useState<Record<string, number>>({});
  const [simulatedPrediction, setSimulatedPrediction] = useState<any>(null);

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

  // Helper to get formatted accuracy percentage
  const getAccuracyRate = (res: any) => {
    if (!res) return null;
    if (res.accuracy_summary) return res.accuracy_summary;
    if (res.metrics?.accuracy !== undefined) {
      const pct = (res.metrics.accuracy * 100).toFixed(2);
      return { overall_accuracy_pct: Number(pct), headline: `${pct}% Accuracy`, rating: 'Evaluated' };
    }
    if (res.metrics?.r2_score !== undefined) {
      const pct = (Math.max(0, res.metrics.r2_score) * 100).toFixed(2);
      return { overall_accuracy_pct: Number(pct), headline: `${pct}% R² Variance Explained`, rating: 'Evaluated' };
    }
    return null;
  };

  return (
    <div style={{ paddingBottom: '60px', maxWidth: '1600px', margin: '0 auto' }}>
      <SectionHeader
        title="Machine Learning & Prediction Studio"
        subtitle="AutoML pipeline: Detect problem type, train models, inspect percentage accuracy, and explore actual predictions."
        icon={<Brain />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* ── STEP 1 & 2: SETUP & TRAINING ─────────────────────────────────── */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            
            {/* Target Selector */}
            <div style={{ flex: '1 1 320px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                1. Select Target Variable to Predict
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select
                  className="input"
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  style={{ flex: 1 }}
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={16} /> Detect
                </button>
              </div>
            </div>

            {/* Algorithm Selector & Actions */}
            {problemType && (
              <div style={{ flex: '2 1 450px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                  2. Select Algorithm ({problemType.problem_type.toUpperCase()} • {problemType.reason})
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <select
                    className="input"
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value)}
                    style={{ flex: '1 1 240px' }}
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
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Play size={16} /> Train & Predict
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleCompare}
                      disabled={loading}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <BarChart2 size={16} /> Compare All Models
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── LOADING ANIMATION ────────────────────────────────────────────── */}
        {loading && (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#818cf8' }}>
            <Brain size={52} className="animate-float" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: '#f8fafc' }}>
              Training & Evaluating ML Model...
            </h3>
            <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem' }}>
              Preprocessing features, performing 80/20 train-test split, fitting {algorithm}, calculating percentage accuracy, and computing actual prediction differences.
            </p>
          </div>
        )}

        {/* ── RESULTS: HERO ACCURACY & METRICS CARDS ───────────────────────── */}
        <AnimatePresence>
          {!loading && results && (
            <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* 🌟 HERO ACCURACY RATE BANNER */}
              <motion.div
                variants={fadeUp}
                className="card"
                style={{
                  padding: '24px 28px',
                  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '20px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#818cf8', fontWeight: 700 }}>
                      Model Performance Summary
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      background: results.accuracy_summary?.rating === 'Outstanding' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      color: results.accuracy_summary?.rating === 'Outstanding' ? '#34d399' : '#a5b4fc',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontWeight: 600
                    }}>
                      {results.accuracy_summary?.rating || 'Evaluated'}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    {results.accuracy_summary?.headline || `${results.algorithm.toUpperCase()} Evaluation`}
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '6px 0 0 0' }}>
                    Algorithm: <strong style={{ color: '#e2e8f0' }}>{results.algorithm}</strong> • Trained on {results.n_samples_train} samples • Tested on {results.n_samples_test} samples
                  </p>
                </div>

                {/* Big Accuracy Percentage Box */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '16px',
                  padding: '16px 28px',
                  textAlign: 'center',
                  minWidth: '180px'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                    {results.problem_type === 'regression' ? 'Variance Explained (R²)' : 'Overall Accuracy'}
                  </span>
                  <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.02em' }}>
                    {results.accuracy_summary?.overall_accuracy_pct != null ? `${results.accuracy_summary.overall_accuracy_pct}%` : 'N/A'}
                  </div>
                  {results.problem_type === 'regression' && results.accuracy_summary?.within_10pct_accuracy != null && (
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                      {results.accuracy_summary.within_10pct_accuracy}% within ±10% error
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Detailed Metrics Grid & Feature Importance */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
                
                {/* Metrics Breakdown Card */}
                <motion.div variants={fadeUp} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <CheckCircle2 size={20} color="#10b981" />
                    <h3 style={{ fontSize: '1.1rem', color: '#e2e8f0', margin: 0, fontWeight: 600 }}>
                      Detailed Evaluation Metrics
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {Object.entries(results.metrics || {})
                      .filter(([k]) => k !== 'confusion_matrix' && k !== 'roc_curve')
                      .map(([key, value]: [string, any]) => {
                        const isPercentage = key.includes('accuracy') || key.includes('precision') || key.includes('recall') || key.includes('f1') || key.includes('r2');
                        return (
                          <div key={key} style={{ background: '#1e293b', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                              {key.replace('_', ' ')}
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: isPercentage ? '#818cf8' : '#e2e8f0' }}>
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
                  <motion.div variants={fadeUp} className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                      <TrendingUp size={20} color="#a855f7" />
                      <h3 style={{ fontSize: '1.1rem', color: '#e2e8f0', margin: 0, fontWeight: 600 }}>
                        Feature Importance (Impact Drivers)
                      </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {results.feature_importances.slice(0, 7).map((item: any) => {
                        const pct = (item.importance * 100).toFixed(1);
                        return (
                          <div key={item.feature}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 500, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.feature}
                              </span>
                              <span style={{ fontWeight: 600, color: '#c084fc' }}>{pct}%</span>
                            </div>
                            <div className="progress-bar" style={{ height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                className="progress-bar-fill"
                                style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7, #ec4899)', borderRadius: '4px' }}
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
                <motion.div variants={fadeUp} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Table size={20} color="#38bdf8" />
                      <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', margin: 0, fontWeight: 600 }}>
                        Actual vs. Predicted Sample Results
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Showing {results.predictions_preview.length} sample records from the holdout test dataset
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                          <th style={{ padding: '10px 14px' }}>#</th>
                          <th style={{ padding: '10px 14px' }}>Actual Ground Truth</th>
                          <th style={{ padding: '10px 14px' }}>Model Predicted</th>
                          <th style={{ padding: '10px 14px' }}>
                            {results.problem_type === 'regression' ? 'Absolute Difference' : 'Match Status'}
                          </th>
                          <th style={{ padding: '10px 14px' }}>Accuracy Status</th>
                          <th style={{ padding: '10px 14px' }}>Input Features Snapshot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.predictions_preview.map((row: any) => (
                          <tr
                            key={row.row_id}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              background: row.row_id % 2 === 0 ? 'rgba(30, 41, 59, 0.2)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>{row.row_id}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#f8fafc' }}>
                              {String(row.actual)}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#818cf8' }}>
                              {String(row.predicted)}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                              {row.difference !== undefined ? (
                                <span style={{ color: row.difference > 0 ? '#34d399' : '#f87171' }}>
                                  {row.difference > 0 ? `+${row.difference}` : row.difference}
                                </span>
                              ) : (
                                row.status
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  background: row.is_correct ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: row.is_correct ? '#34d399' : '#f87171',
                                }}
                              >
                                {row.is_correct ? <Check size={12} /> : <X size={12} />}
                                {row.is_correct ? 'Accurate' : (row.error_pct ? `${row.error_pct}% off` : 'Incorrect')}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#94a3b8' }}>
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
              className="card"
              style={{ padding: '24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <BarChart2 size={22} color="#6366f1" />
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#e2e8f0', margin: 0, fontWeight: 600 }}>
                    Model Accuracy & Performance Benchmark
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                    Ranked by {problemType?.problem_type === 'regression' ? 'R² Variance Explained %' : 'Overall Accuracy %'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
                          background: idx === 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(30, 41, 59, 0.4)',
                          border: `1px solid ${idx === 0 ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: '10px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {idx === 0 && (
                              <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                BEST
                              </span>
                            )}
                            <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>{algoName}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '1.05rem' }}>
                            {metricName}: {pct.toFixed(2)}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: idx === 0 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #6366f1, #a855f7)',
                              borderRadius: '4px',
                            }}
                          />
                        </div>

                        {/* Secondary Metrics */}
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                          {Object.entries(r.metrics || {})
                            .filter(([k]) => k !== (isReg ? 'r2_score' : 'accuracy') && k !== 'confusion_matrix' && k !== 'roc_curve')
                            .slice(0, 4)
                            .map(([k, v]: [string, any]) => (
                              <span key={k}>
                                <strong style={{ color: '#cbd5e1' }}>{k.replace('_', ' ')}:</strong>{' '}
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
