import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Sparkles,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Send,
  Trash2,
  RefreshCw,
  BookOpen,
  X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getAIInsights, askQuestion, getDataDictionary } from '../services/api';
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

// ─── Suggested questions ─────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What are the key patterns in this dataset?',
  'Which columns have the most missing data?',
  'What are the top correlations?',
  'Suggest which column to use as target for ML',
];

// ─── Typing indicator ────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}
  >
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--accent-primary-light)',
        color: 'var(--accent-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Sparkles size={14} />
    </div>
    <div
      style={{
        background: 'var(--bg-surface-raised)',
        border: '1px solid var(--border-default)',
        borderRadius: '0 10px 10px 10px',
        padding: '10px 14px',
        display: 'flex',
        gap: '5px',
        alignItems: 'center',
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', display: 'block' }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
        />
      ))}
    </div>
  </motion.div>
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
  const { activeDataset, chatHistory, addChatMessage, clearChat } = useStore();

  // Insights state
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [activeInsightTab, setActiveInsightTab] = useState<'general' | 'stats' | 'ml'>('general');

  // Data dictionary state
  const [dataDictionary, setDataDictionary] = useState<DataDictionary | null>(null);
  const [isLoadingDict, setIsLoadingDict] = useState(false);
  const [showDictionary, setShowDictionary] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // ── Chat ───────────────────────────────────────────────────────────────────

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isAiResponding]);

  const sendMessage = async (text: string) => {
    const question = text.trim();
    if (!question || !activeDataset || isAiResponding) return;

    addChatMessage('user', question);
    setChatInput('');
    setIsAiResponding(true);

    try {
      const response = (await askQuestion(activeDataset.id, question)) as any;
      addChatMessage('ai', response.answer);
    } catch {
      toast.error('Failed to get AI response. Please try again.');
      addChatMessage('ai', 'Sorry, I encountered an error processing your question. Please try again.');
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput);
    }
  };

  const handleSuggestion = (q: string) => {
    sendMessage(q);
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
          Automated Insights &amp; Copilot
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
          Real-time dataset intelligence and analytical dialogue for <strong style={{ color: 'var(--text-primary)' }}>{activeDataset.filename}</strong>
        </p>
      </div>

      {/* Two-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* ── LEFT: Auto Insights ───────────────────────────────────────────── */}
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
                            gap: '6px',
                            padding: '8px 10px',
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: '1px' }}>•</span>
                          {item}
                        </div>
                      ))}
                    </div>
                  </InsightCard>

                  {/* Anomalies */}
                  {insights.anomalies && insights.anomalies.length > 0 && (
                    <InsightCard
                      icon={<AlertCircle size={16} />}
                      title="Anomalies Detected"
                      delay={0.24}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {insights.anomalies.map((anomaly, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '6px',
                              padding: '8px 10px',
                              background: 'var(--status-danger-bg, rgba(239, 68, 68, 0.08))',
                              border: '1px solid var(--border-default)',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: 'var(--status-danger)',
                            }}
                          >
                            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                            {anomaly}
                          </div>
                        ))}
                      </div>
                    </InsightCard>
                  )}
                </>
              )}

              {/* TAB 2: Stats & Cleaning */}
              {activeInsightTab === 'stats' && (
                <>
                  {/* Risk Factors */}
                  <InsightCard
                    icon={<AlertCircle size={16} />}
                    title="Statistical Risk Factors"
                    delay={0}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {insights.risk_factors && insights.risk_factors.length > 0 ? (
                        insights.risk_factors.map((item: string, i: number) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '6px',
                              padding: '8px 10px',
                              background: 'var(--status-danger-bg, rgba(239, 68, 68, 0.08))',
                              border: '1px solid var(--border-default)',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: 'var(--status-danger)',
                            }}
                          >
                            <span style={{ flexShrink: 0, marginTop: '1px' }}>•</span>
                            {item}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No significant statistical risk factors found.</div>
                      )}
                    </div>
                  </InsightCard>

                  {/* Recommendations */}
                  <InsightCard
                    icon={<TrendingUp size={16} />}
                    title="Cleaning & Imputation Recommendations"
                    delay={0.08}
                  >
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {insights.recommendations?.map((rec: string, i: number) => (
                        <li key={i} style={{ color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </InsightCard>
                </>
              )}

              {/* TAB 3: ML Readiness */}
              {activeInsightTab === 'ml' && (
                <>
                  {insights.ml_readiness ? (
                    <InsightCard
                      icon={<Sparkles size={16} />}
                      title="Machine Learning Readiness"
                      delay={0}
                    >
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                        <div
                          style={{
                            width: 68,
                            height: 68,
                            borderRadius: '50%',
                            border: '3px solid var(--accent-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: 'var(--accent-primary-light)',
                          }}
                        >
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {insights.ml_readiness.score}%
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                            GRADE {insights.ml_readiness.grade}
                          </span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span
                              className={`badge-subtle ${insights.ml_readiness.is_ready ? 'badge-success' : 'badge-warning'}`}
                              style={{ fontSize: '0.72rem' }}
                            >
                              {insights.ml_readiness.is_ready ? 'Ready for ML' : 'Action Required'}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            {insights.ml_readiness.is_ready
                              ? 'This dataset is structured properly and ready to train predictive machine learning models.'
                              : 'Data cleaning or feature transformations are recommended before training models.'}
                          </p>
                        </div>
                      </div>

                      {/* Diagnostics notes */}
                      {insights.ml_readiness.notes && insights.ml_readiness.notes.length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <h4 style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            Readiness Diagnostics
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {insights.ml_readiness.notes.map((note: string, i: number) => (
                              <div
                                key={i}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.76rem',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                                {note}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested models */}
                      {insights.ml_readiness.suggested_models && insights.ml_readiness.suggested_models.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            Recommended Model Architectures
                          </h4>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {insights.ml_readiness.suggested_models.map((model: string, i: number) => (
                              <span
                                key={i}
                                className="badge-subtle badge-info"
                                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                              >
                                {model}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </InsightCard>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                      ML Readiness score is not available for this dataset.
                    </div>
                  )}
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

        {/* ── RIGHT: Chat Interface ─────────────────────────────────────────── */}
        <div
          className="card-precision"
          style={{
            height: 'calc(100vh - 180px)',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            position: 'sticky',
            top: '20px',
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <MessageSquare size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Dataset Assistant
                </h3>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Gemini Data Copilot
                </p>
              </div>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat history"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'var(--bg-canvas)',
            }}
          >
            {chatHistory.length === 0 && !isAiResponding ? (
              /* Suggested questions */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: 'var(--accent-primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <Sparkles size={22} color="var(--accent-primary)" />
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center' }}>
                  Ask questions about trends, distributions, or predictive features
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '6px' }}>
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(q)}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {chatHistory.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        marginBottom: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        {/* AI avatar */}
                        {msg.role === 'ai' && (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'var(--accent-primary-light)',
                              color: 'var(--accent-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '2px',
                            }}
                          >
                            <Sparkles size={12} />
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          style={{
                            maxWidth: '82%',
                            padding: '10px 14px',
                            borderRadius:
                              msg.role === 'user'
                                ? '12px 12px 2px 12px'
                                : '2px 12px 12px 12px',
                            background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                            border: msg.role === 'user' ? 'none' : '1px solid var(--border-default)',
                            color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                            fontSize: '0.82rem',
                            lineHeight: 1.5,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          marginLeft: msg.role === 'ai' ? '30px' : 0,
                        }}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing indicator */}
                <AnimatePresence>{isAiResponding && <TypingIndicator />}</AnimatePresence>

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-default)',
              flexShrink: 0,
              background: 'var(--bg-surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-end',
                background: 'var(--bg-canvas)',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
                padding: '8px 10px',
              }}
            >
              <textarea
                ref={textareaRef}
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your data... (Enter to send, Shift+Enter for newline)"
                disabled={isAiResponding}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => sendMessage(chatInput)}
                disabled={!chatInput.trim() || isAiResponding}
                className="btn-primary"
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: chatInput.trim() && !isAiResponding ? 1 : 0.4,
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsightsPage;
