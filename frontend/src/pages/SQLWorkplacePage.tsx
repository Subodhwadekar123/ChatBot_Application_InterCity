import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import DataTable from '../components/ui/DataTable';
import {
  executeSqlQuery,
  getSqlSuggestions,
  undoCleaning,
  resetDataset,
  getCleaningHistory,
  getDataset,
  detectProblemType,
  trainModel,
} from '../services/api';
import {
  Database,
  Play,
  Undo2,
  RotateCcw,
  Code,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Terminal,
  BarChart4,
  Cpu,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';

export default function SQLWorkplacePage() {
  const navigate = useNavigate();
  const { activeDataset, addDataset } = useStore();
  const [query, setQuery] = useState('');
  const [applySelect, setApplySelect] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState<number>(0);
  const [lastActionDesc, setLastActionDesc] = useState<string>('');

  // Tab state for query results view
  const [resultsTab, setResultsTab] = useState<'table' | 'visualizer'>('table');

  // Visualization options
  const [chartType, setChartType] = useState<'bar' | 'line' | 'scatter' | 'pie'>('bar');
  const [xAxisCol, setXAxisCol] = useState('');
  const [yAxisCol, setYAxisCol] = useState('');

  // AutoML State
  const [mlTargetCol, setMlTargetCol] = useState('');
  const [mlDetecting, setMlDetecting] = useState(false);
  const [mlProblemInfo, setMlProblemInfo] = useState<any>(null);
  const [mlTraining, setMlTraining] = useState(false);
  const [mlResults, setMlResults] = useState<any>(null);

  useEffect(() => {
    if (activeDataset) {
      loadSuggestions();
      loadHistoryStatus();
      setQuery('SELECT * FROM dataset LIMIT 10;');
      // Reset ML states
      setMlTargetCol('');
      setMlProblemInfo(null);
      setMlResults(null);
    }
  }, [activeDataset?.id]);

  // Set default axis keys once results are returned
  useEffect(() => {
    if (results?.columns && results.columns.length > 0) {
      setXAxisCol(results.columns[0]);
      if (results.columns.length > 1) {
        setYAxisCol(results.columns[1]);
      } else {
        setYAxisCol(results.columns[0]);
      }
    }
  }, [results]);

  // Automatically detect problem type when target column changes
  useEffect(() => {
    if (mlTargetCol && activeDataset) {
      detectMLProblem();
    } else {
      setMlProblemInfo(null);
      setMlResults(null);
    }
  }, [mlTargetCol]);

  const loadSuggestions = async () => {
    if (!activeDataset) return;
    try {
      setSuggestionsLoading(true);
      const res = await getSqlSuggestions(activeDataset.id);
      setSuggestions(res.suggestions || []);
    } catch (err: any) {
      console.error('Failed to load SQL suggestions', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const loadHistoryStatus = async () => {
    if (!activeDataset) return;
    try {
      const res = await getCleaningHistory(activeDataset.id);
      setUndoCount(res.undo_count || 0);
      setLastActionDesc(res.last_action?.action || '');
    } catch (err: any) {
      console.error('Failed to fetch history status', err);
    }
  };

  const refreshActiveDataset = async () => {
    if (!activeDataset) return;
    try {
      const fullDetails = await getDataset(activeDataset.id);
      const mapped = {
        ...activeDataset,
        dataset_info: fullDetails.dataset_info,
        preview: fullDetails.preview,
      };
      addDataset(mapped);
      // Reset target options if columns changed
      setMlTargetCol('');
      setMlProblemInfo(null);
      setMlResults(null);
    } catch (err) {
      console.error('Failed to refresh dataset state', err);
    }
  };

  const handleExecute = async () => {
    if (!activeDataset || !query.trim()) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      setResults(null);
      setResultsTab('table');

      const res = await executeSqlQuery(activeDataset.id, query, applySelect);
      setResults(res);

      if (res.applied) {
        toast.success(res.message || 'Dataset updated successfully.');
        await refreshActiveDataset();
        await loadHistoryStatus();
      } else {
        toast.success('Query executed successfully (preview mode).');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute query');
      toast.error('SQL Execution Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!activeDataset || undoCount === 0) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      setResults(null);

      await undoCleaning(activeDataset.id);
      toast.success('Last SQL operation undone.');
      await refreshActiveDataset();
      await loadHistoryStatus();
    } catch (err: any) {
      toast.error(err.message || 'Failed to undo action.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!activeDataset) return;
    if (!window.confirm('Are you sure you want to revert all SQL changes and data modifications? This cannot be undone.')) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      setResults(null);

      await resetDataset(activeDataset.id);
      toast.success('Dataset reset to original upload state.');
      await refreshActiveDataset();
      await loadHistoryStatus();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset dataset.');
    } finally {
      setLoading(false);
    }
  };

  const detectMLProblem = async () => {
    if (!activeDataset || !mlTargetCol) return;
    try {
      setMlDetecting(true);
      setMlResults(null);
      const res = await detectProblemType(activeDataset.id, mlTargetCol);
      setMlProblemInfo(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to detect problem type');
    } finally {
      setMlDetecting(false);
    }
  };

  const handleTrainML = async () => {
    if (!activeDataset || !mlTargetCol || !mlProblemInfo) return;
    try {
      setMlTraining(true);
      const recommendedAlgo = mlProblemInfo.recommended_algorithms?.[0]?.id || '';
      
      const res = await trainModel(activeDataset.id, {
        target_column: mlTargetCol,
        algorithm: recommendedAlgo,
        test_size: 0.2,
      });

      setMlResults(res);
      toast.success(`Trained ${res.algorithm} successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to train model');
    } finally {
      setMlTraining(false);
    }
  };

  const selectSuggestion = (q: string) => {
    setQuery(q);
    toast.success('Query populated in editor');
  };

  if (!activeDataset) return <EmptyState />;

  const datasetInfo = activeDataset.dataset_info || {};
  const columnTypes = datasetInfo.column_types || {};

  const cols = [
    ...(columnTypes.numeric || []),
    ...(columnTypes.categorical || []),
    ...(columnTypes.boolean || []),
  ];

  // Group columns for Schema viewer
  const numCols = columnTypes.numeric || [];
  const catCols = columnTypes.categorical || [];
  const dtCols = columnTypes.datetime || [];
  const boolCols = columnTypes.boolean || [];

  // Transform query preview data for Recharts
  const chartData: { name: string; value: number }[] = results?.preview
    ? results.preview.map((row: any) => ({
        name: String(row[xAxisCol] ?? ''),
        value: Number(row[yAxisCol]) || 0,
      }))
    : [];

  const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'];

  return (
    <div style={{ paddingBottom: '40px', maxWidth: '1450px', margin: '0 auto' }}>
      <SectionHeader
        title="SQL Query Workplace"
        subtitle="Write raw SQLite queries to search, aggregate, filter, and preprocess your dataset directly."
        icon={<Terminal size={18} />}
      />

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Left Side: Schema Explorer */}
        <div
          className="card-precision"
          style={{
            width: '300px',
            flexShrink: 0,
            padding: '20px',
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
            position: 'sticky',
            top: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Table Schema</h3>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Table Name: <code style={{ backgroundColor: 'var(--bg-canvas)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, color: 'var(--accent-primary)' }}>dataset</code>
          </div>

          {/* Numeric Columns */}
          {numCols.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Numeric Fields ({numCols.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {numCols.map((col) => (
                  <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', backgroundColor: 'var(--bg-canvas)', borderRadius: '6px', fontSize: '0.78rem' }} title={`Column: ${col}`}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{col}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 700, backgroundColor: 'var(--accent-primary-light)', padding: '1px 5px', borderRadius: '4px' }}># num</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categorical Columns */}
          {catCols.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Categorical Fields ({catCols.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {catCols.map((col) => (
                  <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', backgroundColor: 'var(--bg-canvas)', borderRadius: '6px', fontSize: '0.78rem' }} title={`Column: ${col}`}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{col}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-amber, #d97706)', fontWeight: 700, backgroundColor: 'rgba(217, 119, 6, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>A text</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DateTime Columns */}
          {dtCols.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '6px' }}>
                DateTime Fields ({dtCols.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dtCols.map((col) => (
                  <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', backgroundColor: 'var(--bg-canvas)', borderRadius: '6px', fontSize: '0.78rem' }} title={`Column: ${col}`}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{col}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-purple, #7c3aed)', fontWeight: 700, backgroundColor: 'rgba(124, 58, 237, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>date</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Boolean Columns */}
          {boolCols.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Boolean Fields ({boolCols.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {boolCols.map((col) => (
                  <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', backgroundColor: 'var(--bg-canvas)', borderRadius: '6px', fontSize: '0.78rem' }} title={`Column: ${col}`}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{col}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-success, #10b981)', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>bool</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Editor & Results & ML Trainer */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Suggestions Panel */}
          <div className="card-precision" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Suggested Queries</h4>
            </div>

            {suggestionsLoading ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px 0' }}>Generating analytics queries...</div>
            ) : suggestions.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {suggestions.map((sug, i) => (
                  <div
                    key={i}
                    onClick={() => selectSuggestion(sug.query)}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-canvas)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sug.title}</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Click to Use
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{sug.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No suggestions available.</div>
            )}
          </div>

          {/* Editor Card */}
          <div className="card-precision" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={15} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>SQL Editor</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                <span>Table: <code>dataset</code></span>
                <span>Dialect: SQLite</span>
              </div>
            </div>

            {/* Custom Monospace Code Editor UI */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                fontFamily: 'var(--font-family-mono, monospace)',
                minHeight: '200px',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-canvas)',
              }}
            >
              {/* Line numbers column */}
              <div
                style={{
                  width: '42px',
                  backgroundColor: 'var(--bg-surface-raised, rgba(0,0,0,0.02))',
                  borderRight: '1px solid var(--border-default)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: '12px',
                  fontSize: '11px',
                  userSelect: 'none',
                  lineHeight: '20px',
                  fontFamily: 'monospace',
                }}
              >
                {Array.from({ length: Math.max(8, query.split('\n').length) }).map((_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
              {/* Monospace Input Area */}
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="-- Write SQLite queries here&#10;SELECT * FROM dataset LIMIT 10;"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  resize: 'vertical',
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-family-mono, monospace)',
                  fontSize: '13px',
                  lineHeight: '20px',
                  minHeight: '200px',
                }}
              />
            </div>

            {/* Execution Controls bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {/* Preprocessing toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
                title="If checked, executing SELECT queries will filter/prune columns and overwrite the workspace dataset state."
              >
                <input
                  type="checkbox"
                  checked={applySelect}
                  onChange={(e) => setApplySelect(e.target.checked)}
                  style={{
                    width: '14px',
                    height: '14px',
                    accentColor: 'var(--accent-primary)',
                    cursor: 'pointer',
                  }}
                />
                Apply SELECT results directly to dataset (Preprocessing)
              </label>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setQuery('')}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Clear query editor"
                >
                  <Trash2 size={13} />
                  Clear
                </button>

                <button
                  onClick={handleReset}
                  className="btn-secondary"
                  disabled={loading}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Discard all changes and reset dataset"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>

                <button
                  onClick={handleUndo}
                  className="btn-secondary"
                  disabled={undoCount === 0 || loading}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    opacity: undoCount === 0 ? 0.5 : 1,
                    cursor: undoCount === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title={undoCount > 0 ? `Revert last query (${lastActionDesc || `${undoCount} states available`})` : 'No operations to undo'}
                >
                  <Undo2 size={13} />
                  Undo {undoCount > 0 && `(${undoCount})`}
                </button>

                <button
                  onClick={handleExecute}
                  disabled={loading || !query.trim()}
                  className="btn-primary"
                  style={{
                    padding: '6px 16px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Play size={13} fill="#ffffff" />
                  Execute Query
                </button>
              </div>
            </div>
          </div>

          {/* Results Block */}
          {loading && <LoadingSpinner text="Executing SQL query and compiling results..." />}

          {errorMsg && (
            <div
              className="card-precision animate-fade-in"
              style={{
                padding: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderLeft: '4px solid var(--color-danger, #ef4444)',
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={18} style={{ color: 'var(--color-danger, #ef4444)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {errorMsg && (
                    errorMsg.toLowerCase().includes('syntax') || errorMsg.toLowerCase().includes('near "') 
                      ? 'SQL Syntax Error' 
                      : errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('no such')
                      ? 'Database Resource Error'
                      : errorMsg.toLowerCase().includes('denied') || errorMsg.toLowerCase().includes('unauthorized')
                      ? 'Access Control Error'
                      : 'SQL Execution Error'
                  )}
                </h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{errorMsg}</p>
              </div>
            </div>
          )}

          {results && (
            <div className="card-precision animate-fade-in" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                
                {/* Tabs selection */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setResultsTab('table')}
                    className={`btn-${resultsTab === 'table' ? 'primary' : 'secondary'}`}
                    style={{ padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Code size={13} />
                    Data Table
                  </button>
                  <button
                    onClick={() => setResultsTab('visualizer')}
                    className={`btn-${resultsTab === 'visualizer' ? 'primary' : 'secondary'}`}
                    style={{ padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                    disabled={!results.preview || results.preview.length === 0}
                  >
                    <BarChart4 size={13} />
                    Chart Visualizer
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="badge-subtle badge-info" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                    Columns: {results.columns?.length || 0}
                  </span>
                  <span className="badge-subtle badge-success" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                    Rows: {results.rows_count || 0}
                  </span>
                </div>
              </div>

              {results.message && (
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    backgroundColor: results.applied ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-canvas)',
                    border: `1px solid ${results.applied ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-default)'}`,
                    borderRadius: '6px',
                    color: results.applied ? 'var(--color-success, #10b981)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    marginBottom: '14px',
                  }}
                >
                  {results.message}
                </div>
              )}

              {/* Data Table View */}
              {resultsTab === 'table' && (
                results.preview && results.preview.length > 0 ? (
                  <div style={{ marginTop: '10px' }}>
                    <DataTable
                      columns={results.columns || []}
                      data={results.preview || []}
                      pageSize={10}
                    />
                    {results.rows_count > 100 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', fontStyle: 'italic' }}>
                        Previewing first 100 rows. Complete dataset operations were executed on all {results.rows_count} rows.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', backgroundColor: 'var(--bg-canvas)', borderRadius: '8px' }}>
                    Query executed successfully. No rows were returned (common for DDL/DML update queries).
                  </div>
                )
              )}

              {/* Chart Visualizer View */}
              {resultsTab === 'visualizer' && results.preview && results.preview.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                  
                  {/* Visualizer Configuration Bar */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-canvas)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, marginRight: '6px' }}>Chart Type:</span>
                      <select
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value as any)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="line">Line Chart</option>
                        <option value="scatter">Scatter Plot</option>
                        <option value="pie">Pie Chart</option>
                      </select>
                    </div>

                    <div>
                      <span style={{ fontWeight: 600, marginRight: '6px' }}>X-Axis (Label):</span>
                      <select
                        value={xAxisCol}
                        onChange={(e) => setXAxisCol(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}
                      >
                        {results.columns.map((col: string) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span style={{ fontWeight: 600, marginRight: '6px' }}>Y-Axis (Value):</span>
                      <select
                        value={yAxisCol}
                        onChange={(e) => setYAxisCol(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}
                      >
                        {results.columns.map((col: string) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Render Chart Container */}
                  <div style={{ height: '320px', width: '100%', padding: '10px 0' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                          <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                          <RechartsTooltip />
                          <Bar dataKey="value" fill="var(--accent-primary)" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : chartType === 'line' ? (
                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                          <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                          <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                          <RechartsTooltip />
                          <Line type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      ) : chartType === 'scatter' ? (
                        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                          <CartesianGrid stroke="var(--border-subtle)" />
                          <XAxis type="category" dataKey="name" name={xAxisCol} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                          <YAxis type="number" dataKey="value" name={yAxisCol} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                          <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Scatter name="SQL Query Data" data={chartData} fill="var(--accent-primary)" />
                        </ScatterChart>
                      ) : (
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent = 0 }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.72rem' }}>
                    <button
                      onClick={() => navigate('/dashboard/visualization')}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Open in Advanced Visualizations Studio <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AutoML Sandbox Card */}
          <div className="card-precision" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Cpu size={16} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>🤖 SQL-Driven AutoML Predictor</h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '16px' }}>
              Directly train a Machine Learning model using the columns and data produced by your SQL preprocessing. 
              Simply select your target variable to initiate automated model tournament training.
            </p>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Target Variable:</span>
                <select
                  value={mlTargetCol}
                  onChange={(e) => setMlTargetCol(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)',
                    fontSize: '0.8rem',
                    minWidth: '200px',
                  }}
                >
                  <option value="">-- Select Target Column --</option>
                  {cols.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {mlDetecting && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '20px' }}>
                  <LoadingSpinner size="sm" /> Analyzing target parameters...
                </div>
              )}

              {mlProblemInfo && !mlDetecting && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '16px' }}>
                  <div style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Problem Type:</span>{' '}
                    <strong style={{ color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                      {mlProblemInfo.problem_type}
                    </strong>
                  </div>
                  
                  <button
                    onClick={handleTrainML}
                    disabled={mlTraining || !mlTargetCol}
                    className="btn-primary"
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: 'var(--accent-primary)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: mlTraining ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {mlTraining ? 'Training Models...' : 'Quick Train Model'}
                  </button>
                </div>
              )}
            </div>

            {/* AutoML training results view */}
            {mlTraining && (
              <div style={{ padding: '20px 0' }}>
                <LoadingSpinner text="Executing training tournament across multiple models (Random Forest, Linear, XGBoost)..." />
              </div>
            )}

            {mlResults && !mlTraining && (
              <div
                className="animate-fade-in"
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  marginTop: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <CheckCircle2 size={15} style={{ color: 'var(--color-success, #10b981)' }} />
                    Model Trained Successfully
                  </div>
                  <span className="badge-subtle badge-info" style={{ fontSize: '0.7rem' }}>
                    {mlResults.algorithm}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div style={{ backgroundColor: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Target Column</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{mlResults.target_column}</div>
                  </div>
                  
                  {mlResults.accuracy_summary?.overall_accuracy_pct !== undefined ? (
                    <div style={{ backgroundColor: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Accuracy</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-success, #10b981)' }}>
                        {mlResults.accuracy_summary.overall_accuracy_pct.toFixed(2)}%
                      </div>
                    </div>
                  ) : mlResults.r2_score !== undefined ? (
                    <div style={{ backgroundColor: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>R² Score</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        {mlResults.r2_score.toFixed(4)}
                      </div>
                    </div>
                  ) : null}

                  {mlResults.mse !== undefined && (
                    <div style={{ backgroundColor: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Mean Squared Error</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {mlResults.mse.toFixed(4)}
                      </div>
                    </div>
                  )}

                  {mlResults.rmse !== undefined && (
                    <div style={{ backgroundColor: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RMSE</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {mlResults.rmse.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => navigate('/dashboard/ml')}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    Open in Advanced AutoML Studio <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
