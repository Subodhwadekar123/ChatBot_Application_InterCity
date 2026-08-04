import React, { useEffect, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
  trend?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = 'var(--accent-primary)',
  subtitle,
  trend,
}) => {
  const isNumeric = typeof value === 'number';
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { damping: 30, stiffness: 150 });
  const displayVal = useTransform(spring, (v) =>
    isNumeric ? Math.round(v).toLocaleString() : value
  );

  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isNumeric && !hasAnimated.current) {
      hasAnimated.current = true;
      motionVal.set(0);
      setTimeout(() => {
        motionVal.set(value as number);
      }, 100);
    }
  }, [isNumeric, value, motionVal]);

  const isPositiveTrend = trend !== undefined && trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="card-precision"
      style={{
        position: 'relative',
        padding: '18px 20px',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* Icon + Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 2,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color.startsWith('var') ? color : color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value & Trend */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            fontFamily: "var(--font-family-heading)",
          }}
        >
          {isNumeric ? (
            <motion.span>{displayVal}</motion.span>
          ) : (
            <span>{value}</span>
          )}
        </div>

        {trend !== undefined && (
          <div
            className={`badge-subtle ${isPositiveTrend ? 'badge-success' : 'badge-danger'}`}
            style={{
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {isPositiveTrend ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{isPositiveTrend ? `+${trend}%` : `${trend}%`}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;
