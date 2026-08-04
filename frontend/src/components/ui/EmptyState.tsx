import React from 'react';
import { FileSearch } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionLink?: string;
}

export default function EmptyState({
  title = 'No Dataset Selected',
  description = 'Upload or select a dataset from the header to analyze this workspace.',
  actionText = 'Ingest Dataset',
  actionLink = '/dashboard/upload'
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '380px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px dashed var(--border-strong)',
        borderRadius: '14px',
        padding: '40px 24px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'var(--accent-primary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '18px',
          border: '1px solid var(--border-default)',
        }}
      >
        <FileSearch size={30} color="var(--accent-primary)" />
      </motion.div>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '22px', fontSize: '13.5px', lineHeight: 1.5 }}>
        {description}
      </p>
      {actionLink && actionText && (
        <Link to={actionLink} style={{ textDecoration: 'none' }}>
          <button className="btn-primary">
            {actionText}
          </button>
        </Link>
      )}
    </div>
  );
}
