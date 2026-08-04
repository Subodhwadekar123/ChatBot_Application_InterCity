/**
 * Password Strength Meter Component
 * Animated, color-coded strength indicator with requirement checklist.
 */

import React, { useMemo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
}

interface Requirement {
  label: string;
  met: boolean;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Very Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Weak', color: '#f97316' };
  if (score <= 3) return { score, label: 'Fair', color: '#eab308' };
  if (score <= 4) return { score, label: 'Good', color: '#84cc16' };
  if (score <= 5) return { score, label: 'Strong', color: '#22c55e' };
  return { score, label: 'Very Strong', color: '#10b981' };
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showRequirements = true,
}) => {
  const strength = useMemo(() => getStrength(password), [password]);

  const requirements: Requirement[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'Number (0-9)', met: /[0-9]/.test(password) },
    { label: 'Special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  if (!password) return null;

  const pct = Math.min((strength.score / 6) * 100, 100);

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Strength Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <div
          style={{
            flex: 1,
            height: '6px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: strength.color,
              borderRadius: '999px',
              transition: 'width 0.4s ease, background 0.4s ease',
            }}
          />
        </div>
        <span style={{ fontSize: '11px', color: strength.color, fontWeight: 700, minWidth: '70px', textAlign: 'right' }}>
          {strength.label}
        </span>
      </div>

      {/* Requirements */}
      {showRequirements && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 12px',
            marginTop: '8px',
          }}
        >
          {requirements.map((req) => (
            <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {req.met ? (
                <CheckCircle size={12} color="#22c55e" />
              ) : (
                <XCircle size={12} color="#ef4444" style={{ opacity: 0.5 }} />
              )}
              <span
                style={{
                  fontSize: '11px',
                  color: req.met ? '#86efac' : '#94a3b8',
                  transition: 'color 0.2s',
                }}
              >
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
