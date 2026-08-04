import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet, FileCode, FileType } from 'lucide-react';

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  isUploading: boolean;
  progress: number;
}

const ACCEPTED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/json': ['.json'],
};

const MAX_SIZE_MB = 200;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const DropZone: React.FC<DropZoneProps> = ({ onFileDrop, isUploading, progress }) => {
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [rejected, setRejected] = useState<FileRejection[]>([]);
  const [isDragAccept, setIsDragAccept] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setRejected(rejections);
      if (accepted.length > 0) {
        const file = accepted[0];
        setDroppedFile(file);
        setRejected([]);
        onFileDrop(file);
      }
    },
    [onFileDrop],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: MAX_SIZE_BYTES,
    multiple: false,
    disabled: isUploading,
    onDragEnter: () => { setIsDragAccept(true); setIsDragReject(false); },
    onDragLeave: () => { setIsDragAccept(false); setIsDragReject(false); },
    onDropAccepted: () => { setIsDragAccept(false); },
    onDropRejected: () => { setIsDragReject(true); setIsDragAccept(false); },
  });

  const borderColor = isDragReject || rejected.length > 0
    ? 'var(--color-danger)'
    : isDragAccept || isDragActive
      ? 'var(--accent-primary)'
      : droppedFile && !isUploading
        ? 'var(--color-success)'
        : 'var(--border-strong)';

  return (
    <div style={{ width: '100%' }}>
      <motion.div
        {...(getRootProps() as any)}
        animate={{
          borderColor,
        }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'relative',
          border: `2px dashed ${borderColor}`,
          borderRadius: '12px',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          backgroundColor: isDragActive ? 'var(--accent-primary-light)' : 'var(--bg-surface)',
          overflow: 'hidden',
          transition: 'background-color 0.15s ease',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}
            >
              <div style={{ position: 'relative', width: 44, height: 44 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '3px solid var(--border-default)',
                    borderTopColor: 'var(--accent-primary)',
                  }}
                />
              </div>
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>
                  Ingesting <span style={{ color: 'var(--accent-primary)' }}>{droppedFile?.name}</span>…
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>
                  Parsing schema and computing initial statistical profiling
                </p>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: 320,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--border-default)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.2 }}
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    background: 'var(--accent-primary)',
                  }}
                />
              </div>
              <p style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', margin: 0, fontWeight: 700 }}>
                {Math.round(progress)}%
              </p>
            </motion.div>
          ) : rejected.length > 0 ? (
            <motion.div
              key="rejected"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
            >
              <AlertCircle size={36} color="var(--color-danger)" />
              <p style={{ color: 'var(--color-danger)', fontWeight: 700, margin: 0, fontSize: '0.92rem' }}>File Rejected</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                {rejected[0]?.errors?.[0]?.message ?? 'Invalid file format. Please upload CSV, XLSX, or JSON.'}
              </p>
              <p style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                Click or drop a valid file to retry
              </p>
            </motion.div>
          ) : droppedFile && !isUploading ? (
            <motion.div
              key="accepted"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
            >
              <CheckCircle2 size={36} color="var(--color-success)" />
              <p style={{ color: 'var(--color-success)', fontWeight: 700, margin: 0, fontSize: '0.92rem' }}>Dataset Ready</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: 0 }}>{droppedFile.name}</p>
              <p style={{ color: 'var(--accent-primary)', fontSize: '0.78rem', margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                Drop another file to replace
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--accent-primary-light)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UploadCloud size={24} />
              </div>

              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.98rem', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                  {isDragActive ? 'Release dataset to ingest' : 'Drop dataset files here or browse'}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                  Supports structured <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>CSV, Excel (.xlsx, .xls), and JSON</span> up to 200 MB
                </p>
              </div>

              {/* Supported Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div className="badge-subtle badge-info" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px' }}>
                  <FileType size={12} />
                  <span>CSV</span>
                </div>
                <div className="badge-subtle badge-success" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px' }}>
                  <FileSpreadsheet size={12} />
                  <span>Excel (.xlsx)</span>
                </div>
                <div className="badge-subtle badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px' }}>
                  <FileCode size={12} />
                  <span>JSON</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DropZone;
