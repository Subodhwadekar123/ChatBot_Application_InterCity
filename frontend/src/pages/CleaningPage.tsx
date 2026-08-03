import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import { 
  handleMissingValues, 
  removeDuplicates, 
  renameColumns,
  dropColumns, 
  convertDtype, 
  handleOutliers, 
  normalizeData, 
  encodeColumn,
  handleSkewness,
  removeConstants,
  exportCleaned,
  getDataset,
  undoCleaning,
  getCleaningHistory,
  resetDataset
} from '../services/api';
import toast from 'react-hot-toast';
import { 
  Brush, Download, Trash2, Edit3, Settings2, 
  ShieldAlert, Activity, Sliders, 
  Sparkles, Layers, Type, AlertCircle,
  Undo2, RotateCcw
} from 'lucide-react';
import DataTable from '../components/ui/DataTable';

type CleanTab = 
  | 'missing' 
  | 'duplicates' 
  | 'rename' 
  | 'columns' 
  | 'dtypes' 
  | 'outliers' 
  | 'normalize' 
  | 'encode' 
  | 'skewness' 
  | 'constants';

export default function CleaningPage() {
  const { activeDataset, setActiveDataset } = useStore();
  const [loading, setLoading] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [undoCount, setUndoCount] = useState<number>(0);
  const [lastActionDesc, setLastActionDesc] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CleanTab>('missing');
  const [selectedCol, setSelectedCol] = useState('');
  
  // Tab-specific form states
  const [missingStrategy, setMissingStrategy] = useState('drop_rows');
  const [missingColScope, setMissingColScope] = useState<'all' | 'specific'>('all');
  const [fillConstantVal, setFillConstantVal] = useState('');

  const [renameNewName, setRenameNewName] = useState('');

  const [targetDtype, setTargetDtype] = useState('numeric');

  const [outlierMethod, setOutlierMethod] = useState<'iqr' | 'zscore'>('iqr');
  const [outlierStrategy, setOutlierStrategy] = useState<'remove' | 'cap' | 'replace_mean' | 'replace_median'>('remove');
  const [outlierThreshold, setOutlierThreshold] = useState<number>(1.5);

  const [normMethod, setNormMethod] = useState<'minmax' | 'zscore' | 'robust'>('minmax');
  const [normColScope, setNormColScope] = useState<'all' | 'specific'>('all');

  const [encodeMethod, setEncodeMethod] = useState<'label' | 'onehot' | 'ordinal'>('label');
  const [ordinalCategories, setOrdinalCategories] = useState('');

  const [skewMethod, setSkewMethod] = useState<'log' | 'sqrt' | 'boxcox' | 'yeo_johnson'>('log');

  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');

  // Fetch undo and history state
  const fetchHistory = async () => {
    const currentId = activeDataset?.id;
    if (!currentId) return;
    try {
      const res = await getCleaningHistory(currentId);
      if (res && res.data) {
        setUndoCount(res.data.undo_count || 0);
        if (res.data.last_action) {
          const act = res.data.last_action;
          setLastActionDesc(String(act.action).replace(/_/g, ' '));
        } else {
          setLastActionDesc(null);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [activeDataset?.id]);

  // Refresh dataset data after cleaning
  const refreshDataset = async () => {
    const currentId = activeDataset?.id;
    if (!currentId) return;
    try {
      const data = await getDataset(currentId);
      if (data) {
        setActiveDataset({
          ...activeDataset,
          ...data,
          id: data.id || data.dataset_id || currentId,
        });
      }
      await fetchHistory();
    } catch (err) {
      console.error("Failed to refresh dataset after cleaning:", err);
    }
  };

  if (!activeDataset) return <EmptyState />;

  const numericCols = activeDataset.dataset_info.column_types.numeric || [];
  const catCols = activeDataset.dataset_info.column_types.categorical || [];
  const allCols = [
    ...numericCols, 
    ...catCols, 
    ...(activeDataset.dataset_info.column_types.datetime || []), 
    ...(activeDataset.dataset_info.column_types.boolean || [])
  ];

  const handleCleanAction = async (action: () => Promise<any>, successMsg: string) => {
    try {
      setLoading(true);
      await action();
      toast.success(successMsg);
      await refreshDataset();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    const currentId = activeDataset?.id;
    if (!currentId || undoCount === 0 || undoing || loading) return;
    try {
      setUndoing(true);
      const res = await undoCleaning(currentId);
      const reverted = res.data?.reverted_action?.action;
      const label = reverted ? reverted.replace(/_/g, ' ') : 'last cleaning operation';
      toast.success(`Successfully reverted ${label}`);
      await refreshDataset();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to undo change');
    } finally {
      setUndoing(false);
    }
  };

  const handleReset = async () => {
    const currentId = activeDataset?.id;
    if (!currentId || undoCount === 0 || resetting || loading) return;
    if (!window.confirm("Are you sure you want to reset all cleaning changes back to the original uploaded dataset?")) return;
    try {
      setResetting(true);
      await resetDataset(currentId);
      toast.success("Dataset successfully reset to original state");
      await refreshDataset();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to reset dataset');
    } finally {
      setResetting(false);
    }
  };

  const handleExport = () => {
    window.open(exportCleaned(activeDataset.id, exportFormat), '_blank');
  };

  const tabs: { id: CleanTab; label: string; icon: any; desc: string }[] = [
    { id: 'missing', label: 'Missing Values', icon: ShieldAlert, desc: 'Impute or drop missing data' },
    { id: 'duplicates', label: 'Duplicates', icon: Edit3, desc: 'Identify and remove duplicate records' },
    { id: 'rename', label: 'Rename Columns', icon: Type, desc: 'Rename dataset features' },
    { id: 'columns', label: 'Drop Columns', icon: Trash2, desc: 'Remove redundant columns' },
    { id: 'dtypes', label: 'Convert Types', icon: Settings2, desc: 'Cast numeric, dates, and categories' },
    { id: 'outliers', label: 'Outlier Handling', icon: AlertCircle, desc: 'Detect & treat extreme values' },
    { id: 'normalize', label: 'Normalization', icon: Sliders, desc: 'MinMax, Z-Score, Robust scaling' },
    { id: 'encode', label: 'Encoding', icon: Layers, desc: 'One-Hot, Label, Ordinal encoders' },
    { id: 'skewness', label: 'Handle Skewness', icon: Activity, desc: 'Log, Sqrt, Box-Cox, Yeo-Johnson' },
    { id: 'constants', label: 'Constant Features', icon: Sparkles, desc: 'Drop zero-variance columns' },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <SectionHeader 
          title="Data Cleaning & Preprocessing" 
          subtitle="Clean, transform, normalize, encode, and prepare your dataset for machine learning."
          icon={<Brush />}
        />
        
        {/* Action Controls Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Undo Button */}
          <button
            onClick={handleUndo}
            disabled={undoCount === 0 || undoing || loading}
            title={undoCount > 0 ? `Undo last operation (${lastActionDesc || `${undoCount} steps available`})` : "No changes to undo"}
            style={{
              height: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: undoCount === 0 || undoing || loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              border: undoCount > 0 ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255,255,255,0.08)',
              background: undoCount > 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.03)',
              color: undoCount > 0 ? '#a5b4fc' : '#64748b',
              opacity: undoCount === 0 ? 0.5 : 1,
              boxShadow: undoCount > 0 ? '0 0 12px rgba(99, 102, 241, 0.15)' : 'none'
            }}
          >
            <Undo2 size={16} style={{ transform: undoing ? 'rotate(-180deg)' : 'none', transition: 'transform 0.3s ease' }} />
            <span>{undoing ? 'Undoing...' : 'Undo'}</span>
            {undoCount > 0 && (
              <span style={{
                background: '#6366f1',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '10px',
                lineHeight: 1
              }}>
                {undoCount}
              </span>
            )}
          </button>

          {/* Reset to Original Button */}
          {undoCount > 0 && (
            <button
              onClick={handleReset}
              disabled={resetting || loading || undoing}
              title="Revert all changes back to original uploaded file"
              style={{
                height: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 12px',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '0.85rem',
                cursor: resetting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#f87171'
              }}
            >
              <RotateCcw size={15} style={{ animation: resetting ? 'spin 1s linear infinite' : 'none' }} />
              <span>{resetting ? 'Resetting...' : 'Reset'}</span>
            </button>
          )}

          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          <select 
            className="input" 
            style={{ width: '100px', height: '40px', padding: '0 8px' }}
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="json">JSON</option>
          </select>
          <button className="btn-primary" onClick={handleExport} style={{ height: '40px' }}>
            <Download size={16} /> Export Cleaned
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Sidebar - Operations */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px', paddingLeft: '8px' }}>
            Transformations
          </h3>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedCol('');
                }}
                style={{
                  padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px',
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: isActive ? '#818cf8' : '#94a3b8',
                  border: `1px solid ${isActive ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', fontWeight: isActive ? 600 : 500
                }}
              >
                <Icon size={18} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem' }}>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Content - Operation Form & Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', fontWeight: 600, marginBottom: '4px' }}>
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {tabs.find(t => t.id === activeTab)?.desc}
              </p>
            </div>

            {/* 1. MISSING VALUES */}
            {activeTab === 'missing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Scope
                    </label>
                    <select 
                      className="input" 
                      value={missingColScope} 
                      onChange={(e) => setMissingColScope(e.target.value as any)}
                    >
                      <option value="all">Apply to All Columns</option>
                      <option value="specific">Apply to Specific Column</option>
                    </select>
                  </div>

                  {missingColScope === 'specific' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                        Target Column
                      </label>
                      <select 
                        className="input" 
                        value={selectedCol} 
                        onChange={(e) => setSelectedCol(e.target.value)}
                      >
                        <option value="">Select a column...</option>
                        {allCols.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Imputation Strategy
                    </label>
                    <select 
                      className="input" 
                      value={missingStrategy} 
                      onChange={(e) => setMissingStrategy(e.target.value)}
                    >
                      <option value="drop_rows">Drop Rows with Missing Values</option>
                      <option value="drop_cols">Drop Columns with Missing Values</option>
                      <option value="fill_mean">Fill with Mean (Numeric only)</option>
                      <option value="fill_median">Fill with Median (Numeric only)</option>
                      <option value="fill_mode">Fill with Mode (Most frequent)</option>
                      <option value="interpolate">Linear Interpolation (Numeric)</option>
                      <option value="ffill">Forward Fill (ffill)</option>
                      <option value="bfill">Backward Fill (bfill)</option>
                      <option value="fill_constant">Fill with Constant Value</option>
                    </select>
                  </div>

                  {missingStrategy === 'fill_constant' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                        Constant Fill Value
                      </label>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="e.g. 0 or Unknown" 
                        value={fillConstantVal}
                        onChange={(e) => setFillConstantVal(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <button 
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                  disabled={loading || (missingColScope === 'specific' && !selectedCol)}
                  onClick={() => {
                    const payload: any = { strategy: missingStrategy };
                    if (missingColScope === 'specific' && selectedCol) {
                      payload.columns = [selectedCol];
                    }
                    if (missingStrategy === 'fill_constant') {
                      payload.fill_value = fillConstantVal;
                    }
                    handleCleanAction(() => handleMissingValues(activeDataset.id, payload), `Missing values handled with ${missingStrategy}`);
                  }}
                >
                  Apply Missing Value Handling
                </button>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid #2d2f3e', marginTop: '8px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>Missing values summary:</p>
                  {Object.entries(activeDataset.dataset_info.missing_info).map(([col, info]: [string, any]) => (
                    <div key={col} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                      <span style={{ color: '#e2e8f0' }}>{col}</span>
                      <span style={{ color: '#f59e0b' }}>{info.count} missing ({info.percentage.toFixed(1)}%)</span>
                    </div>
                  ))}
                  {Object.keys(activeDataset.dataset_info.missing_info).length === 0 && (
                    <span style={{ color: '#10b981', fontSize: '0.85rem' }}>✓ No missing values found in this dataset!</span>
                  )}
                </div>
              </div>
            )}

            {/* 2. DUPLICATES */}
            {activeTab === 'duplicates' && (
              <div>
                <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '0.95rem' }}>
                  Your dataset has <strong>{activeDataset.dataset_info.duplicate_rows}</strong> duplicate rows ({activeDataset.dataset_info.duplicate_percentage}%).
                </p>
                <button 
                  className="btn-primary"
                  disabled={loading || activeDataset.dataset_info.duplicate_rows === 0}
                  onClick={() => handleCleanAction(() => removeDuplicates(activeDataset.id), 'Duplicate rows removed')}
                >
                  Remove All Duplicate Rows
                </button>
              </div>
            )}

            {/* 3. RENAME COLUMNS */}
            {activeTab === 'rename' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Select Column
                    </label>
                    <select className="input" onChange={(e) => setSelectedCol(e.target.value)} value={selectedCol}>
                      <option value="">Select column...</option>
                      {allCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      New Column Name
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. customer_age" 
                      value={renameNewName} 
                      onChange={(e) => setRenameNewName(e.target.value)} 
                    />
                  </div>
                </div>
                <button 
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={loading || !selectedCol || !renameNewName.trim()}
                  onClick={() => {
                    handleCleanAction(
                      () => renameColumns(activeDataset.id, { [selectedCol]: renameNewName.trim() }),
                      `Renamed column ${selectedCol} to ${renameNewName}`
                    );
                    setRenameNewName('');
                  }}
                >
                  Rename Column
                </button>
              </div>
            )}

            {/* 4. DROP COLUMNS */}
            {activeTab === 'columns' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Select Column to Drop
                  </label>
                  <select className="input" onChange={(e) => setSelectedCol(e.target.value)} value={selectedCol}>
                    <option value="">Select a column to drop...</option>
                    {allCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button 
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start', background: '#ef4444' }}
                  disabled={loading || !selectedCol}
                  onClick={() => handleCleanAction(() => dropColumns(activeDataset.id, [selectedCol]), `Dropped column ${selectedCol}`)}
                >
                  Drop Column
                </button>
              </div>
            )}

            {/* 5. CONVERT DTYPES */}
            {activeTab === 'dtypes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Column
                    </label>
                    <select className="input" onChange={(e) => setSelectedCol(e.target.value)} value={selectedCol}>
                      <option value="">Select a column...</option>
                      {allCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Target Type
                    </label>
                    <select 
                      className="input" 
                      value={targetDtype} 
                      onChange={(e) => setTargetDtype(e.target.value)}
                    >
                      <option value="numeric">Numeric (Float)</option>
                      <option value="integer">Integer (Nullable Int64)</option>
                      <option value="string">String / Text</option>
                      <option value="category">Categorical</option>
                      <option value="datetime">Datetime</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                </div>
                <button 
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={loading || !selectedCol}
                  onClick={() => handleCleanAction(() => convertDtype(activeDataset.id, selectedCol, targetDtype), `Converted ${selectedCol} to ${targetDtype}`)}
                >
                  Convert Data Type
                </button>
              </div>
            )}

            {/* 6. OUTLIERS */}
            {activeTab === 'outliers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Numeric Column
                  </label>
                  <select className="input" onChange={(e) => setSelectedCol(e.target.value)} value={selectedCol}>
                    <option value="">Select numeric column...</option>
                    {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Detection Method
                    </label>
                    <select className="input" value={outlierMethod} onChange={(e) => setOutlierMethod(e.target.value as any)}>
                      <option value="iqr">IQR (Interquartile Range)</option>
                      <option value="zscore">Z-Score (Standard Deviations)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Handling Strategy
                    </label>
                    <select className="input" value={outlierStrategy} onChange={(e) => setOutlierStrategy(e.target.value as any)}>
                      <option value="remove">Remove Outlier Rows</option>
                      <option value="cap">Cap Values (Winsorize / Clip)</option>
                      <option value="replace_mean">Replace with Mean</option>
                      <option value="replace_median">Replace with Median</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Threshold ({outlierMethod === 'iqr' ? 'IQR Multiplier, e.g. 1.5' : 'Z-Score Std, e.g. 3.0'})
                    </label>
                    <input 
                      type="number" 
                      step="0.1" 
                      className="input" 
                      value={outlierThreshold}
                      onChange={(e) => setOutlierThreshold(parseFloat(e.target.value) || 1.5)}
                    />
                  </div>
                </div>
                <button 
                  className="btn-primary" style={{ alignSelf: 'flex-start' }}
                  disabled={loading || !selectedCol}
                  onClick={() => {
                    handleCleanAction(
                      () => handleOutliers(activeDataset.id, { 
                        column: selectedCol, 
                        method: outlierMethod, 
                        strategy: outlierStrategy,
                        threshold: outlierThreshold 
                      }), 
                      `Handled outliers in ${selectedCol}`
                    );
                  }}
                >
                  Apply Outlier Handling
                </button>
              </div>
            )}

            {/* 7. NORMALIZE */}
            {activeTab === 'normalize' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Scaling Method
                    </label>
                    <select className="input" value={normMethod} onChange={(e) => setNormMethod(e.target.value as any)}>
                      <option value="minmax">Min-Max Scaling (Scale 0 to 1)</option>
                      <option value="zscore">Standard Scaling (Mean 0, Std 1)</option>
                      <option value="robust">Robust Scaling (Median & IQR based)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Columns Scope
                    </label>
                    <select className="input" value={normColScope} onChange={(e) => setNormColScope(e.target.value as any)}>
                      <option value="all">All Numeric Columns</option>
                      <option value="specific">Specific Column</option>
                    </select>
                  </div>
                </div>

                {normColScope === 'specific' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Select Column
                    </label>
                    <select className="input" value={selectedCol} onChange={(e) => setSelectedCol(e.target.value)}>
                      <option value="">Select numeric column...</option>
                      {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                <button 
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={loading || (normColScope === 'specific' && !selectedCol)}
                  onClick={() => {
                    const payload: any = { method: normMethod };
                    if (normColScope === 'specific' && selectedCol) {
                      payload.columns = [selectedCol];
                    }
                    handleCleanAction(() => normalizeData(activeDataset.id, payload), `Normalized data using ${normMethod}`);
                  }}
                >
                  Normalize Features
                </button>
              </div>
            )}

            {/* 8. ENCODE */}
            {activeTab === 'encode' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Categorical Column
                    </label>
                    <select className="input" onChange={(e) => setSelectedCol(e.target.value)} value={selectedCol}>
                      <option value="">Select categorical column...</option>
                      {catCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Encoding Method
                    </label>
                    <select className="input" value={encodeMethod} onChange={(e) => setEncodeMethod(e.target.value as any)}>
                      <option value="label">Label Encoding (0, 1, 2...)</option>
                      <option value="onehot">One-Hot Encoding (Binary dummy columns)</option>
                      <option value="ordinal">Ordinal Encoding (Custom order)</option>
                    </select>
                  </div>
                </div>

                {encodeMethod === 'ordinal' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Ordered Categories (Comma-separated from lowest to highest)
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. Low, Medium, High" 
                      value={ordinalCategories} 
                      onChange={(e) => setOrdinalCategories(e.target.value)} 
                    />
                  </div>
                )}

                <button 
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={loading || !selectedCol || (encodeMethod === 'ordinal' && !ordinalCategories.trim())}
                  onClick={() => {
                    const payload: any = { column: selectedCol, method: encodeMethod };
                    if (encodeMethod === 'ordinal') {
                      payload.categories = ordinalCategories.split(',').map(s => s.trim()).filter(Boolean);
                    }
                    handleCleanAction(() => encodeColumn(activeDataset.id, payload), `Encoded ${selectedCol} using ${encodeMethod}`);
                  }}
                >
                  Encode Column
                </button>
              </div>
            )}

            {/* 9. SKEWNESS */}
            {activeTab === 'skewness' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Numeric Column
                    </label>
                    <select className="input" onChange={(e) => setSelectedCol(e.target.value)} value={selectedCol}>
                      <option value="">Select numeric column...</option>
                      {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                      Transformation Method
                    </label>
                    <select className="input" value={skewMethod} onChange={(e) => setSkewMethod(e.target.value as any)}>
                      <option value="log">Log Transformation (Log1p)</option>
                      <option value="sqrt">Square Root Transformation</option>
                      <option value="boxcox">Box-Cox (Strictly Positive)</option>
                      <option value="yeo_johnson">Yeo-Johnson (Supports +/- / zero)</option>
                    </select>
                  </div>
                </div>
                <button 
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={loading || !selectedCol}
                  onClick={() => {
                    handleCleanAction(
                      () => handleSkewness(activeDataset.id, { column: selectedCol, method: skewMethod }),
                      `Reduced skewness in ${selectedCol} using ${skewMethod}`
                    );
                  }}
                >
                  Apply Skewness Transformation
                </button>
              </div>
            )}

            {/* 10. REMOVE CONSTANT FEATURES */}
            {activeTab === 'constants' && (
              <div>
                <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '0.95rem' }}>
                  Constant features (columns where every row has the identical value) add zero predictive information to ML models and increase dimensionality.
                </p>
                <button 
                  className="btn-primary"
                  disabled={loading}
                  onClick={() => handleCleanAction(() => removeConstants(activeDataset.id), 'Removed constant features')}
                >
                  Detect & Remove Constant Features
                </button>
              </div>
            )}
          </div>

          {/* Live Preview Table */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#e2e8f0', fontWeight: 600 }}>Live Dataset Preview</h3>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {activeDataset.dataset_info.rows} rows × {activeDataset.dataset_info.columns} columns
              </span>
            </div>
            <DataTable columns={activeDataset.preview.columns} data={activeDataset.preview.records} />
          </div>

        </div>
      </div>
    </div>
  );
}
