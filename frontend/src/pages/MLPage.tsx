import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import {
  analyzeTarget,
  trainModelV2,
  compareModels,
  tuneModel,
  predictCustom,
  savePipeline
} from '../services/api';
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
  Settings,
  Filter,
  Layers,
  Cpu,
  ChevronRight,
  Save,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MLPage() {
  const { activeDataset } = useStore();
  
  // Step navigation
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Target Variable & Analysis
  const [targetCol, setTargetCol] = useState('');
  const [targetAnalysis, setTargetAnalysis] = useState<any>(null);
  const [problemType, setProblemType] = useState<'classification' | 'regression'>('classification');
  const [detectReason, setDetectReason] = useState('');

  // Step 2: Preprocessing & Split Settings
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [scalingMethod, setScalingMethod] = useState('auto');
  const [imputationStrategy, setImputationStrategy] = useState('median');
  const [stratifySplit, setStratifySplit] = useState(true);
  const [categoricalEncoding, setCategoricalEncoding] = useState('onehot');
  const [testSize, setTestSize] = useState(0.2);

  // Step 3: Model Selection & Comparison
  const [algorithm, setAlgorithm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [comparisonResults, setComparisonResults] = useState<any>(null);
  const [primaryMetric, setPrimaryMetric] = useState('accuracy');

  // Step 4: Tuning & Improvement
  const [tuningLoading, setTuningLoading] = useState(false);
  const [tunedResults, setTunedResults] = useState<any>(null);

  // Step 5: Save & Predict
  const [savedPipelinePath, setSavedPipelinePath] = useState('');
  const [predictInputs, setPredictInputs] = useState<Record<string, string>>({});
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predictLoading, setPredictLoading] = useState(false);

  // List all columns
  const numericCols = activeDataset?.dataset_info?.column_types?.numeric ?? [];
  const categoricalCols = activeDataset?.dataset_info?.column_types?.categorical ?? [];
  const booleanCols = activeDataset?.dataset_info?.column_types?.boolean ?? [];
  const allCols = [...numericCols, ...categoricalCols, ...booleanCols];

  // Set default features when dataset is loaded
  useEffect(() => {
    if (activeDataset) {
      setSelectedFeatures(allCols);
    }
  }, [activeDataset?.id]);

  if (!activeDataset) return <EmptyState />;

  // ── Handlers ─────────────────────────────────────────────────────────────

  // Analyze Target Column
  const handleAnalyzeTarget = async () => {
    if (!targetCol) return;
    try {
      setLoading(true);
      const res = await analyzeTarget(activeDataset.id, targetCol);
      setTargetAnalysis(res);
      setProblemType(res.problem_type);
      setDetectReason(res.reason);
      setPrimaryMetric(res.problem_type === 'regression' ? 'r2_score' : 'accuracy');
      
      // Auto-select recommended algorithm
      if (res.recommended_algorithms && res.recommended_algorithms.length > 0) {
        setAlgorithm(res.recommended_algorithms[0].id);
      }
      
      // Filter out target column from selected features
      setSelectedFeatures(allCols.filter(c => c !== targetCol));
      
      toast.success(`Analyzed target variable: '${targetCol}'`);
      setCurrentStep(2);
    } catch (err: any) {
      toast.error(err.message || 'Target analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // Train Model
  const handleTrainModel = async () => {
    if (!targetCol || !algorithm) return;
    try {
      setLoading(true);
      setResults(null);
      setComparisonResults(null);
      setTunedResults(null);
      setPredictionResult(null);

      const res = await trainModelV2(activeDataset.id, {
        target_column: targetCol,
        algorithm: algorithm,
        feature_columns: selectedFeatures,
        test_size: testSize,
        scaling_method: scalingMethod,
        imputation_strategy: imputationStrategy,
        stratify_split: stratifySplit,
        categorical_encoding: categoricalEncoding
      });

      setResults(res);
      toast.success(`Trained ${algorithm} successfully!`);
      setCurrentStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Model training failed');
    } finally {
      setLoading(false);
    }
  };

  // Compare All Models
  const handleCompareAll = async () => {
    if (!targetCol || !targetAnalysis) return;
    try {
      setLoading(true);
      setComparisonResults(null);
      const algos = targetAnalysis.recommended_algorithms.map((a: any) => a.id);
      
      const res = await compareModels(activeDataset.id, {
        target_column: targetCol,
        algorithms: algos,
        test_size: testSize
      });
      
      setComparisonResults(res);
      toast.success('Model benchmarking completed!');
    } catch (err: any) {
      toast.error(err.message || 'Model benchmarking failed');
    } finally {
      setLoading(false);
    }
  };

  // Tune Hyperparameters
  const handleTuneModel = async () => {
    if (!targetCol || !algorithm) return;
    try {
      setTuningLoading(true);
      const res = await tuneModel(activeDataset.id, {
        target_column: targetCol,
        algorithm: algorithm,
        feature_columns: selectedFeatures,
        test_size: testSize,
        scaling_method: scalingMethod,
        imputation_strategy: imputationStrategy,
        stratify_split: stratifySplit,
        categorical_encoding: categoricalEncoding
      });
      setTunedResults(res);
      toast.success('Hyperparameter tuning completed!');
    } catch (err: any) {
      toast.error(err.message || 'Hyperparameter tuning failed');
    } finally {
      setTuningLoading(false);
    }
  };

  // Save Pipeline
  const handleSavePipeline = async () => {
    const activeExperimentId = tunedResults?.experiment_id || results?.experiment_id;
    if (!activeExperimentId) return;
    try {
      const res = await savePipeline(activeDataset.id, activeExperimentId);
      setSavedPipelinePath(res.model_path);
      toast.success('Preprocessing + Model pipeline saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save pipeline');
    }
  };

  // Custom Predictions
  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeExperimentId = tunedResults?.experiment_id || results?.experiment_id;
    if (!activeExperimentId) return;
    try {
      setPredictLoading(true);
      const res = await predictCustom(activeDataset.id, activeExperimentId, predictInputs);
      setPredictionResult(res);
      toast.success(`Predicted outcome: ${res.prediction}`);
    } catch (err: any) {
      toast.error(err.message || 'Prediction failed');
    } finally {
      setPredictLoading(false);
    }
  };

  const currentActiveResults = tunedResults || results;

  return (
    <div style={{ paddingBottom: '60px', maxWidth: '1600px', margin: '0 auto' }}>
      <SectionHeader
        title="Machine Learning & Prediction Studio"
        subtitle="End-to-End Predictive Pipelines: Define variables, customize preprocessing, benchmark algorithms, optimize parameters, and generate predictions."
        icon={<Brain />}
      />

      {/* ── PIPELINE STEPS NAVIGATION ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { step: 1, label: '1. Target Definition', active: currentStep >= 1 },
          { step: 2, label: '2. Preprocessing & Split', active: currentStep >= 2 },
          { step: 3, label: '3. Model Benchmark & Fit', active: currentStep >= 3 },
          { step: 4, label: '4. Optimization (Tuning)', active: currentStep >= 3 && currentActiveResults },
          { step: 5, label: '5. Pipeline Export & Predict', active: currentStep >= 3 && currentActiveResults }
        ].map((item, idx) => (
          <button
            key={item.step}
            onClick={() => item.active && setCurrentStep(item.step)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: currentStep === item.step ? 'var(--accent-primary-light)' : (item.active ? 'var(--bg-surface)' : 'var(--bg-canvas)'),
              color: currentStep === item.step ? 'var(--accent-primary)' : (item.active ? 'var(--text-primary)' : 'var(--text-muted)'),
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: item.active ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            disabled={!item.active}
          >
            {item.label}
            {idx < 4 && <ChevronRight size={12} />}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>

        {/* ── STEP 1: TARGET VARIABLE DEFINITION & ANALYSIS ────────────────── */}
        {currentStep === 1 && (
          <div className="card-precision" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              🎯 Define Target Variable to Predict
            </h3>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={{ flex: '1 1 300px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600 }}>
                  Select Target Column
                </label>
                <select
                  className="input-precision"
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  style={{ width: '100%', height: '38px', fontSize: '0.82rem' }}
                >
                  <option value="">-- Select target variable --</option>
                  {allCols.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  className="btn-primary"
                  onClick={handleAnalyzeTarget}
                  disabled={!targetCol || loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 16px', fontSize: '0.82rem' }}
                >
                  <Sparkles size={14} /> Analyze Target
                </button>
              </div>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Brain className="animate-spin" size={24} style={{ color: 'var(--accent-primary)', margin: '0 auto 8px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Analyzing column properties...</span>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: PREPROCESSING & SPLIT CONFIGURATION ──────────────────── */}
        {currentStep === 2 && (
          <div className="card-precision" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚙️ Preprocessing & Data Splits Setup
            </h3>

            {/* Target Column Analysis Summary */}
            {targetAnalysis && (
              <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  Target Variable Summary: '{targetCol}'
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Problem Type:</span>{' '}
                    <strong style={{ textTransform: 'uppercase', color: 'var(--text-primary)' }}>{problemType}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Datatype:</span>{' '}
                    <strong>{targetAnalysis.datatype}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Missing Values:</span>{' '}
                    <strong style={{ color: targetAnalysis.missing_count > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {targetAnalysis.missing_count} ({targetAnalysis.missing_pct}%)
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Unique Labels:</span>{' '}
                    <strong>{targetAnalysis.unique_count}</strong>
                  </div>
                </div>

                {targetAnalysis.is_imbalanced && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '6px', marginTop: '12px', color: 'var(--status-danger)', fontSize: '0.76rem' }}>
                    <AlertTriangle size={14} />
                    <span><strong>Imbalanced Target Detected:</strong> Minority class ratio is {targetAnalysis.imbalance_ratio}. Stratification split is recommended.</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              {/* Preprocessing Controls */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Preprocessing Options</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Numeric Scaling Method</label>
                    <select className="input-precision" value={scalingMethod} onChange={(e) => setScalingMethod(e.target.value)} style={{ width: '100%', fontSize: '0.78rem', height: '32px' }}>
                      <option value="auto">Auto (Scaling only for distance/linear models) ⭐</option>
                      <option value="standard">StandardScaler (Mean = 0, Std = 1)</option>
                      <option value="robust">RobustScaler (Median, robust to outliers)</option>
                      <option value="minmax">MinMaxScaler (Scales to [0, 1])</option>
                      <option value="none">None (No scaling applied)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Missing Values Imputation</label>
                    <select className="input-precision" value={imputationStrategy} onChange={(e) => setImputationStrategy(e.target.value)} style={{ width: '100%', fontSize: '0.78rem', height: '32px' }}>
                      <option value="median">Median Imputation (Recommended)</option>
                      <option value="mean">Mean Imputation</option>
                      <option value="most_frequent">Most Frequent (Mode)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Categorical Encoding</label>
                    <select className="input-precision" value={categoricalEncoding} onChange={(e) => setCategoricalEncoding(e.target.value)} style={{ width: '100%', fontSize: '0.78rem', height: '32px' }}>
                      <option value="onehot">One-Hot Encoding (Default)</option>
                      <option value="ordinal">Ordinal Encoding (Index mapping)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Split Controls */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Data Split Options</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Holdout Test Dataset Size: {Math.round(testSize * 100)}%</label>
                    <input
                      type="range"
                      min={0.1}
                      max={0.4}
                      step={0.05}
                      value={testSize}
                      onChange={(e) => setTestSize(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                    />
                  </div>

                  {problemType === 'classification' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <input
                        type="checkbox"
                        id="stratify-split"
                        checked={stratifySplit}
                        onChange={(e) => setStratifySplit(e.target.checked)}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      <label htmlFor="stratify-split" style={{ fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        Stratify train-test split (maintain target class distribution)
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Feature Selection Checklist */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Select Feature Columns to include:</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', cursor: 'pointer' }} onClick={() => setSelectedFeatures(allCols.filter(c => c !== targetCol))}>Reset to all</span>
              </h4>
              <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {allCols.filter(c => c !== targetCol).map(c => {
                  const isSel = selectedFeatures.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedFeatures(prev => isSel ? prev.filter(f => f !== c) : [...prev, c])}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        border: `1px solid ${isSel ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                        background: isSel ? 'var(--accent-primary-light)' : 'var(--bg-surface)',
                        color: isSel ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', gap: '10px' }}>
              <div style={{ flex: '1 1 260px' }}>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600 }}>Choose Baseline Model</label>
                <select className="input-precision" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} style={{ width: '100%', fontSize: '0.82rem', height: '36px' }}>
                  {targetAnalysis?.recommended_algorithms?.map((algo: any) => (
                    <option key={algo.id} value={algo.id}>{algo.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <button
                  className="btn-primary"
                  onClick={handleTrainModel}
                  disabled={loading || !algorithm}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px', fontSize: '0.82rem' }}
                >
                  <Play size={14} /> Train baseline
                </button>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    await handleCompareAll();
                    setCurrentStep(3);
                  }}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
                >
                  <BarChart2 size={14} /> Benchmark All
                </button>
              </div>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '20px', marginTop: '14px', color: 'var(--accent-primary)' }}>
                <Brain className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
                <span style={{ fontSize: '0.8rem' }}>Fitting leak-proof preprocessing + model Pipeline...</span>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: BENCHMARK & PERFORMANCE RESULTS ──────────────────────── */}
        {currentStep === 3 && currentActiveResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Model Summary Hero */}
            <div className="card-precision" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-primary)', fontWeight: 700 }}>
                  Active Model fit summary
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0' }}>
                  {currentActiveResults.accuracy_summary?.headline || `${currentActiveResults.algorithm.toUpperCase()} Pipeline`}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '4px 0 0' }}>
                  Scaling: <strong style={{ color: 'var(--text-primary)' }}>{currentActiveResults.scaling_method}</strong> • Imputer: <strong>{currentActiveResults.imputation_strategy}</strong> • Test samples: {currentActiveResults.n_samples_test}
                </p>
              </div>

              <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '10px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {currentActiveResults.problem_type === 'regression' ? 'R² Score' : 'Overall Accuracy'}
                </span>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {currentActiveResults.accuracy_summary?.overall_accuracy_pct}%
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              
              {/* Detailed Metrics */}
              <div className="card-precision" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} color="var(--status-success)" /> Detailed Metrics
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {Object.entries(currentActiveResults.metrics || {})
                    .filter(([k]) => k !== 'confusion_matrix' && k !== 'roc_plot' && k !== 'residuals_plot')
                    .map(([key, value]: [string, any]) => (
                      <div key={key} style={{ background: 'var(--bg-canvas)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.66rem', textTransform: 'uppercase' }}>{key.replace('_', ' ')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {typeof value === 'number' ? value.toFixed(4) : String(value)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Feature Importance Drivers */}
              {currentActiveResults.feature_importances && currentActiveResults.feature_importances.length > 0 && (
                <div className="card-precision" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} color="var(--accent-primary)" /> Feature Importance (Drivers)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentActiveResults.feature_importances.slice(0, 5).map((item: any) => {
                      const pct = (item.importance * 100).toFixed(1);
                      return (
                        <div key={item.feature}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.feature}</span>
                            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{pct}%</span>
                          </div>
                          <div style={{ height: '5px', background: 'var(--border-subtle)', borderRadius: '2.5px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-primary)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Model benchmarking comparison table */}
            {comparisonResults && (
              <div className="card-precision" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    📊 Multi-Model Accuracy Benchmark
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Sort by Metric:</span>
                    <select
                      className="input-precision"
                      value={primaryMetric}
                      onChange={(e) => setPrimaryMetric(e.target.value)}
                      style={{ fontSize: '0.72rem', height: '26px', padding: '0 6px' }}
                    >
                      {problemType === 'classification' ? (
                        <>
                          <option value="accuracy">Accuracy</option>
                          <option value="f1_score">F1-Score</option>
                          <option value="precision">Precision</option>
                          <option value="recall">Recall</option>
                        </>
                      ) : (
                        <>
                          <option value="r2_score">R² Score</option>
                          <option value="mae">MAE (L1 Error)</option>
                          <option value="rmse">RMSE (L2 Error)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px 14px' }}>Algorithm Name</th>
                        <th style={{ padding: '10px 14px' }}>Accuracy / Fit Score</th>
                        {problemType === 'classification' ? (
                          <>
                            <th style={{ padding: '10px 14px' }}>Precision</th>
                            <th style={{ padding: '10px 14px' }}>Recall</th>
                            <th style={{ padding: '10px 14px' }}>F1-Score</th>
                          </>
                        ) : (
                          <>
                            <th style={{ padding: '10px 14px' }}>MAE</th>
                            <th style={{ padding: '10px 14px' }}>RMSE</th>
                          </>
                        )}
                        <th style={{ padding: '10px 14px' }}>Cross-Val Mean</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonResults.comparison
                        .filter((r: any) => !r.error)
                        .sort((a: any, b: any) => {
                          const valA = a.metrics?.[primaryMetric] ?? 0;
                          const valB = b.metrics?.[primaryMetric] ?? 0;
                          // If MAE or RMSE, lower is better
                          if (primaryMetric === 'mae' || primaryMetric === 'rmse') {
                            return valA - valB;
                          }
                          return valB - valA;
                        })
                        .map((r: any, idx: number) => {
                          const isBest = idx === 0;
                          return (
                            <tr key={r.algorithm} style={{ borderBottom: '1px solid var(--border-subtle)', background: isBest ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                                {r.algorithm.replace('_', ' ').toUpperCase()}
                                {isBest && <span className="badge-subtle badge-success" style={{ marginLeft: '8px', fontSize: '0.62rem' }}>Recommended Best</span>}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                {r.accuracy_summary?.overall_accuracy_pct}%
                              </td>
                              {problemType === 'classification' ? (
                                <>
                                  <td style={{ padding: '10px 14px' }}>{r.metrics?.precision?.toFixed(4)}</td>
                                  <td style={{ padding: '10px 14px' }}>{r.metrics?.recall?.toFixed(4)}</td>
                                  <td style={{ padding: '10px 14px' }}>{r.metrics?.f1_score?.toFixed(4)}</td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: '10px 14px' }}>{r.metrics?.mae?.toFixed(4)}</td>
                                  <td style={{ padding: '10px 14px' }}>{r.metrics?.rmse?.toFixed(4)}</td>
                                </>
                              )}
                              <td style={{ padding: '10px 14px' }}>{r.cv_mean ? r.cv_mean.toFixed(4) : 'N/A'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Preprocessing, split info, evaluation charts and model improvement */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              
              {/* Optional Model Improvement */}
              <div className="card-precision" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                  🚀 Optimization & Tuning (GridSearch)
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Tune hyperparameters dynamically using GridSearch cross-validation to search for optimal estimators.
                </p>

                <button
                  className="btn-primary"
                  onClick={handleTuneModel}
                  disabled={tuningLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', height: '32px' }}
                >
                  {tuningLoading ? 'Searching Parameters...' : 'Run Hyperparameter Tuning'}
                </button>

                {tunedResults && (
                  <div style={{ marginTop: '14px', background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '10px', fontSize: '0.74rem' }}>
                    <div style={{ marginBottom: '4px', color: 'var(--status-success)', fontWeight: 600 }}>✓ Hyperparameter search complete:</div>
                    <div><strong>Best Hyperparameters:</strong></div>
                    <pre style={{ margin: '4px 0', fontSize: '0.72rem', background: 'var(--bg-surface)', padding: '6px', borderRadius: '4px', overflowX: 'auto' }}>
                      {JSON.stringify(tunedResults.best_params, null, 2)}
                    </pre>
                    <div style={{ marginTop: '4px' }}>Tuned CV Score: <strong>{tunedResults.best_cv_score?.toFixed(4)}</strong></div>
                  </div>
                )}
              </div>

              {/* Evaluation Visualizations */}
              <div className="card-precision" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                  📈 Evaluation Plots
                </h3>
                
                {problemType === 'classification' && currentActiveResults.metrics?.roc_plot && (
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>ROC Curve (Receiver Operating Characteristic):</span>
                    {/* Tiny representation or text confirmation */}
                    <div style={{ border: '1px solid var(--border-default)', padding: '10px', borderRadius: '6px', background: 'var(--bg-canvas)', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ROC-AUC Plot Points generated ({currentActiveResults.metrics.roc_plot.length} points)</span>
                    </div>
                  </div>
                )}

                {problemType === 'regression' && currentActiveResults.metrics?.residuals_plot && (
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Residual Plot (Actual vs Residuals):</span>
                    <div style={{ border: '1px solid var(--border-default)', padding: '10px', borderRadius: '6px', background: 'var(--bg-canvas)', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Residual scatter points calculated ({currentActiveResults.metrics.residuals_plot.length} residuals)</span>
                    </div>
                  </div>
                )}

                {!currentActiveResults.metrics?.roc_plot && !currentActiveResults.metrics?.residuals_plot && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>No evaluation plots available for this algorithm.</span>
                )}
              </div>
            </div>

            {/* Save Pipeline & Make Predictions */}
            <div className="card-precision" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> Export Pipeline & Generate Live Predictions
                </h3>
                <button
                  className="btn-primary"
                  onClick={handleSavePipeline}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', height: '30px' }}
                >
                  Save Pipeline
                </button>
              </div>

              {savedPipelinePath && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px', color: 'var(--status-success)', fontSize: '0.76rem' }}>
                  <Check size={14} />
                  <span>Pipeline successfully saved to disk! Path: <code>{savedPipelinePath}</code></span>
                </div>
              )}

              {/* Live Predictor form */}
              <form onSubmit={handlePredict}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Live Inference Simulator</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                  {currentActiveResults.feature_columns.slice(0, 10).map((col: string) => (
                    <div key={col}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '3px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{col}</label>
                      <input
                        type="text"
                        placeholder="nan (empty)"
                        className="input-precision"
                        value={predictInputs[col] || ''}
                        onChange={(e) => setPredictInputs(prev => ({ ...prev, [col]: e.target.value }))}
                        style={{ height: '28px', fontSize: '0.76rem', width: '100%' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={predictLoading}
                    style={{ fontSize: '0.78rem', height: '32px' }}
                  >
                    {predictLoading ? 'Calculating Prediction...' : 'Generate Prediction'}
                  </button>

                  {predictionResult && (
                    <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '6px 14px', fontSize: '0.82rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Predicted Outcome:</span>
                      <strong style={{ color: 'var(--accent-primary)', fontSize: '0.94rem' }}>{predictionResult.prediction}</strong>
                    </div>
                  )}
                </div>
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
