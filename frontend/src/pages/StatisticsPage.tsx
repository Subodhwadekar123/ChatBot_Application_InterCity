import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getStatistics } from '../services/api';
import { Calculator, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import HeatmapComponent from '../components/charts/HeatmapComponent';

export default function StatisticsPage() {
  const { activeDataset } = useStore();
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'descriptive' | 'hypothesis' | 'normality' | 'confidence' | 'correlation'>('descriptive');

  useEffect(() => {
    if (activeDataset) {
      loadStats();
    }
  }, [activeDataset]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getStatistics(activeDataset!.id);
      setStatsData(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (!activeDataset) return <EmptyState />;

  const tabs = [
    { id: 'descriptive', label: 'Descriptive' },
    { id: 'hypothesis', label: 'Hypothesis Tests' },
    { id: 'normality', label: 'Normality' },
    { id: 'confidence', label: 'Confidence Intervals' },
    { id: 'correlation', label: 'Correlation Matrix' },
  ];

  return (
    <div style={{ paddingBottom: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <SectionHeader 
        title="Statistical Inference &amp; Distributions" 
        subtitle="Rigorous mathematical properties, hypothesis tests, and parametric distributions."
        icon={<Calculator size={18} />}
      />

      {/* Tabs */}
      <div style={{ 
        display: 'flex',
        gap: '4px',
        overflowX: 'auto',
        marginBottom: '20px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '3px',
        width: 'fit-content'
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingSpinner text="Computing statistics..." />
      ) : statsData ? (
        <div>
          {/* Descriptive */}
          {activeTab === 'descriptive' && (
             <div className="card-precision" style={{ padding: '16px', overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                 <thead>
                   <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                     <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Metric</th>
                     {Object.keys(statsData.descriptive || {}).map(col => (
                       <th key={col} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{col}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {statsData.descriptive && Object.keys(Object.values(statsData.descriptive)[0] as any || {}).map(metric => (
                     <tr key={metric} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                       <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{metric}</td>
                       {Object.keys(statsData.descriptive).map(col => (
                         <td key={`${col}-${metric}`} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                           {typeof statsData.descriptive[col][metric] === 'number' 
                             ? statsData.descriptive[col][metric].toFixed(4) 
                             : statsData.descriptive[col][metric]}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}

          {/* Hypothesis Tests */}
          {activeTab === 'hypothesis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {statsData.hypothesis_tests?.length > 0 ? (
                statsData.hypothesis_tests.map((test: any, i: number) => (
                  <div key={i} className="card-precision" style={{ padding: '18px', borderLeft: `3px solid ${test.significant ? 'var(--status-success)' : 'var(--border-default)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 700 }}>{test.test_type}</h3>
                      <span className={`badge-subtle ${test.significant ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.72rem' }}>
                        {test.significant ? 'Significant (Reject H₀)' : 'Not Significant (Fail to Reject)'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px', lineHeight: 1.45 }}>{test.hypothesis}</p>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.78rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Test Statistic:</span> <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{test.test_statistic?.toFixed(4) || 'N/A'}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>P-Value:</span> <strong style={{ color: 'var(--accent-primary)', marginLeft: 4 }}>{test.p_value?.toExponential(4) || 'N/A'}</strong></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card-precision" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No automated hypothesis tests could be generated (requires a mix of categorical and numeric columns).
                </div>
              )}
            </div>
          )}

          {/* Normality */}
          {activeTab === 'normality' && (
            <div className="card-precision" style={{ padding: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Feature Column</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Shapiro-Wilk P-Value</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>KS Test P-Value</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Normal Dist (α=0.05)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsData.normality_tests || {}).map(([col, results]: [string, any]) => (
                    <tr key={col} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{col}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{results.shapiro_wilk?.p_value?.toExponential(4) || 'N/A'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{results.kolmogorov_smirnov?.p_value?.toExponential(4) || 'N/A'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span className={`badge-subtle ${results.consensus?.is_normal ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                          {results.consensus?.is_normal ? 'Yes (Gaussian)' : 'No (Skewed)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Confidence Intervals */}
          {activeTab === 'confidence' && (
            <div className="card-precision" style={{ padding: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Feature Column</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Sample Mean</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Lower Bound (95% CI)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Upper Bound (95% CI)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Margin of Error</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsData.confidence_intervals || {}).map(([col, ci]: [string, any]) => (
                    <tr key={col} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{col}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ci.mean?.toFixed(4)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 600 }}>{ci.lower_bound?.toFixed(4)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 600 }}>{ci.upper_bound?.toFixed(4)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>±{ci.margin_of_error?.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Correlation */}
          {activeTab === 'correlation' && (
            <div className="card-precision" style={{ padding: '18px' }}>
              <div style={{ height: '520px', display: 'flex', flexDirection: 'column' }}>
                <p style={{ margin: '0 0 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pearson Correlation Matrix
                </p>
                {statsData.correlation_matrix?.pearson?.matrix ? (
                  (() => {
                    const pearson = statsData.correlation_matrix.pearson;
                    const columns = pearson.columns || [];
                    const matrix = columns.map((row: string) => 
                      columns.map((col: string) => pearson.matrix[row]?.[col] ?? 0)
                    );
                    return <HeatmapComponent columns={columns} matrix={matrix} height={460} />;
                  })()
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Need at least 2 numeric columns to compute correlations.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
