import React from 'react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* Left: Icon + Text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent-primary-light)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.015em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Action slot */}
      {action && (
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
};

export default SectionHeader;
