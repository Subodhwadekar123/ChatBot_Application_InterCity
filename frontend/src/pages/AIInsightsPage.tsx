import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Sparkles,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  BookOpen,
  X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getAIInsights, getDataDictionary } from '../services/api';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AIInsights {
  executive_summary: string;
  key_findings: string[];
  recommendations: string[];
  data_quality_insights?: string[];
  data_quality_issues?: string[];
  anomalies?: string[];
  ml_readiness?: {
    score: number;
    grade: string;
    is_ready: boolean;
    notes: string[];
    suggested_models: string[];
  };
  risk_factors?: string[];
}

interface DataDictColumn {
  name: string;
  dtype: string;
  description: string;
  statistics: Record<string, unknown>;
}

interface DataDictionary {
  columns: DataDictColumn[];
}

// ─── Skeleton shimmer ────────────────────────────────────────────────────────

const SkeletonBlock: React.FC<{ height?: string }> = ({ height = '120px' }) => (
  <div style={{
    height,
    borderRadius: '10px',
    marginBottom: '14px',
    background: 'var(--bg-surface-raised)',
    border: '1px solid var(--border-default)',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
  }} />
);

// ─── Insight section card ─────────────────────────────────────────────────────

interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay?: number;
}

const InsightCard: React.FC<InsightCardProps> = ({ icon, title, children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className="card-precision"
    style={{ marginBottom: '14px', padding: '16px' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <div
        style={{
          width: 30,
          height: 30,
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
      <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
    </div>
    {children}
  </motion.div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const AIInsightsPage: React.FC = () => {
  const { activeDataset } = useStore();

  // Insights state
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [activeInsightTab, setActiveInsightTab] = useState<'general' | 'stats' | 'ml'>('general');

  // Data dictionary state
  const [dataDictionary, setDataDictionary] = useState<DataDictionary | null>(null);
  const [isLoadingDict, setIsLoadingDict] = useState(false);
  const [showDictionary, setShowDictionary] = useState(false);

  // ── Load insights ──────────────────────────────────────────────────────────

  const loadInsights = useCallback(async () => {
    if (!activeDataset) return;
    setIsLoadingInsights(true);
    try {
      const data = await getAIInsights(activeDataset.id);
      setInsights(data);
    } catch {
      toast.error('Failed to load AI insights.');
    } finally {
      setIsLoadingInsights(false);
    }
  }, [activeDataset]);

  useEffect(() => {
    setInsights(null);
    setDataDictionary(null);
    setShowDictionary(false);
    loadInsights();
  }, [activeDataset?.id]);

  // ── Data dictionary ────────────────────────────────────────────────────────

  const handleLoadDictionary = async () => {
    if (!activeDataset) return;
    if (dataDictionary) {
      setShowDictionary((s) => !s);
      return;
    }
    setIsLoadingDict(true);
    try {
      const data = await getDataDictionary(activeDataset.id);
      setDataDictionary(data);
      setShowDictionary(true);
    } catch {
      toast.error('Failed to load data dictionary.');
    } finally {
      setIsLoadingDict(false);
    }
  };

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!activeDataset) {
    return (
      <EmptyState
        title="No Dataset Selected"
        description="Upload or select a dataset to unlock AI-powered insights and chat."
        actionText="Upload Dataset"
        actionLink="/dashboard/upload"
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Automated Insights & Executive Brief
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
          Real-time dataset intelligence for <strong style={{ color: 'var(--text-primary)' }}>{activeDataset.filename}</strong>
        </p>
      </div>

      {/* Auto Insights */}
      <div>
        {/* Refresh & Tabs Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            padding: '3px',
            gap: '3px'
          }}>
            {[
              { id: 'general', label: 'Overview' },
              { id: 'stats', label: 'Stats & Risks' },
              { id: 'ml', label: 'ML Readiness' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveInsightTab(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeInsightTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                  color: activeInsightTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            className="btn-secondary"
            onClick={loadInsights}
            disabled={isLoadingInsights}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={12} className={isLoadingInsights ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {isLoadingInsights ? (
          <>
            <SkeletonBlock height="120px" />
            <SkeletonBlock height="160px" />
            <SkeletonBlock height="140px" />
          </>
        ) : insights ? (
          <>
            {/* TAB 1: General Overview & Quality */}
            {activeInsightTab === 'general' && (
              <>
                {/* Executive Summary */}
                <InsightCard
                  icon={<Sparkles size={16} />}
                  title="Executive Synthesis"
                  delay={0}
                >
                  <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.6, fontSize: '0.82rem' }}>
                    {insights.executive_summary}
                  </p>
                </InsightCard>

                {/* Key Findings */}
                <InsightCard
                  icon={<CheckCircle size={16} />}
                  title="Key Statistical Findings"
                  delay={0.08}
                >
                  <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {insights.key_findings?.map((finding: string, i: number) => (
                      <li
                        key={i}
                        style={{ color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.5 }}
                      >
                        {finding}
                      </li>
                    ))}
                  </ol>
                </InsightCard>

                {/* Data Quality Insights */}
                <InsightCard
                  icon={<AlertCircle size={16} />}
                  title="Data Quality Assessment"
                  delay={0.16}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(insights.data_quality_insights || insights.data_quality_issues)?.map((item: string, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--bg-surface-raised)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'var(--status-warning)',
                            marginTop: 5,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </InsightCard>

                {/* Recommendations */}
                <InsightCard
                  icon={<TrendingUp size={16} />}
                  title="Recommended Actions"
                  delay={0.24}
                >
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {insights.recommendations?.map((rec: string, i: number) => (
                      <li
                        key={i}
                        style={{ color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.5 }}
                      >
                        {rec}
                      </li>
                    ))}
                  </ul>
                </InsightCard>
              </>
            )}

            {/* TAB 2: Stats & Risks */}
            {activeInsightTab === 'stats' && (
              <>
                <InsightCard
                  icon={<AlertCircle size={16} />}
                  title="Anomalies Detected"
                  delay={0}
                >
                  {insights.anomalies && insights.anomalies.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {insights.anomalies.map((anomaly: string, i: number) => (
                        <li
                          key={i}
                          style={{ color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.5 }}
                        >
                          {anomaly}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                      No anomalies detected in this dataset.
                    </div>
                  )}
                </InsightCard>

                <InsightCard
                  icon={<TrendingUp size={16} />}
                  title="Risk Factors"
                  delay={0.08}
                >
                  {insights.risk_factors && insights.risk_factors.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {insights.risk_factors.map((risk: string, i: number) => (
                        <li
                          key={i}
                          style={{ color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.5 }}
                        >
                          {risk}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                      No significant risk factors identified.
                    </div>
                  )}
                </InsightCard>
              </>
            )}

            {/* TAB 3: ML Readiness */}
            {activeInsightTab === 'ml' && (
              <>
                <InsightCard
                  icon={<TrendingUp size={16} />}
                  title="ML Readiness Score"
                  delay={0}
                >
                  {insights.ml_readiness ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            background: insights.ml_readiness.is_ready
                              ? 'var(--color-success)'
                              : 'var(--status-warning)',
                          }}
                        >
                          {insights.ml_readiness.score}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Grade: {insights.ml_readiness.grade}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {insights.ml_readiness.is_ready
                              ? 'Dataset is ready for machine learning.'
                              : 'Dataset needs preparation before ML.'}
                          </div>
                        </div>
                      </div>

                      {insights.ml_readiness.notes && insights.ml_readiness.notes.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Notes
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {insights.ml_readiness.notes.map((note: string, i: number) => (
                              <li key={i} style={{ color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insights.ml_readiness.suggested_models && insights.ml_readiness.suggested_models.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Suggested Models
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {insights.ml_readiness.suggested_models.map((model: string, i: number) => (
                              <span
                                key={i}
                                className="badge-subtle badge-info"
                                style={{ fontSize: '0.72rem' }}
                              >
                                {model}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                      ML Readiness score is not available for this dataset.
                    </div>
                  )}
                </InsightCard>
              </>
            )}

            {/* Data Dictionary toggle */}
            <div>
              <button
                className="btn-secondary"
                onClick={handleLoadDictionary}
                disabled={isLoadingDict}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center', height: '36px', fontSize: '0.82rem', marginBottom: '14px' }}
              >
                {isLoadingDict ? <LoadingSpinner /> : <BookOpen size={14} />}
                {showDictionary ? 'Hide Data Dictionary' : 'View Data Dictionary'}
              </button>

              <AnimatePresence>
                {showDictionary && dataDictionary && (
                  <motion.div
                    key="dict"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="card-precision" style={{ padding: '14px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <BookOpen size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--accent-primary)' }} />
                          Data Dictionary Schema
                        </h3>
                        <button
                          onClick={() => setShowDictionary(false)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Column</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dataDictionary.columns.map((col, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '6px 10px' }}>
                                  <code style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>{col.name}</code>
                                </td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span className="badge-subtle badge-info" style={{ fontSize: '0.68rem' }}>{col.dtype}</span>
                                </td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{col.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
            <Sparkles size={32} color="var(--border-default)" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: '0.82rem' }}>No insights loaded. Click Refresh Insights.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsightsPage;