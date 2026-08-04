import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps {
  columns: string[];
  data: Record<string, any>[];
  pageSize?: number;
  loading?: boolean;
}

const TRUNCATE_LEN = 60;

function truncate(val: any): string {
  const str = val === null || val === undefined ? '—' : String(val);
  if (str.length > TRUNCATE_LEN) return str.slice(0, TRUNCATE_LEN) + '…';
  return str;
}

const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td
        key={i}
        style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div
          className="skeleton-shimmer"
          style={{
            height: 14,
            width: `${50 + (i % 3) * 18}%`,
          }}
        />
      </td>
    ))}
  </tr>
);

const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  pageSize = 10,
  loading = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 10,
          border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <table
          className="data-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            minWidth: 400,
          }}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-canvas)',
                    borderBottom: '1px solid var(--border-default)',
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '36px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  No rows found in this view
                </td>
              </tr>
            ) : (
              pageData.map((row, rowIdx) => (
                <motion.tr
                  key={startIdx + rowIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: rowIdx * 0.015, duration: 0.15 }}
                  style={{
                    backgroundColor:
                      rowIdx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-canvas)',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      'var(--accent-primary-light)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      rowIdx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-canvas)';
                  }}
                >
                  {columns.map((col) => {
                    const isNum = typeof row[col] === 'number';
                    return (
                      <td
                        key={col}
                        title={String(row[col] ?? '')}
                        style={{
                          padding: '9px 14px',
                          borderBottom: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontFamily: isNum ? 'var(--font-family-mono)' : 'inherit',
                          fontSize: isNum ? 12 : 13,
                          maxWidth: 240,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {truncate(row[col])}
                      </td>
                    );
                  })}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          {loading
            ? 'Loading dataset preview…'
            : `Showing ${data.length === 0 ? 0 : startIdx + 1}–${Math.min(
                startIdx + pageSize,
                data.length
              )} of ${data.length} records`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handlePrev}
            disabled={currentPage === 1 || loading}
            className="btn-secondary"
            style={{
              width: 30,
              height: 30,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              opacity: currentPage === 1 ? 0.4 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={14} />
          </button>

          <span
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              fontWeight: 600,
              minWidth: 50,
              textAlign: 'center',
            }}
          >
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={handleNext}
            disabled={currentPage === totalPages || loading}
            className="btn-secondary"
            style={{
              width: 30,
              height: 30,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              opacity: currentPage === totalPages ? 0.4 : 1,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
