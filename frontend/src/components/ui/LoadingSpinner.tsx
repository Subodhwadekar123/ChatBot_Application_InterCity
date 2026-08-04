import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

const sizeMap = {
  sm: 20,
  md: 36,
  lg: 52,
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  fullScreen = false,
}) => {
  const px = sizeMap[size];

  const spinner = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Precision Circular Spinner */}
      <div style={{ position: 'relative', width: px, height: px }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${size === 'sm' ? 2 : 2.5}px solid var(--border-default)`,
          }}
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${size === 'sm' ? 2 : 2.5}px solid transparent`,
            borderTopColor: 'var(--accent-primary)',
          }}
        />
      </div>

      {/* Text */}
      {text && (
        <p
          style={{
            margin: 0,
            fontSize: size === 'sm' ? 11 : size === 'lg' ? 14 : 12.5,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            letterSpacing: '0.01em',
          }}
        >
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            padding: '24px 32px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-default)',
          }}
        >
          {spinner}
        </div>
      </motion.div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {spinner}
    </div>
  );
};

export default LoadingSpinner;
