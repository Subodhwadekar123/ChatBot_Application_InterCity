import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Database, ChevronDown, RefreshCw, Plus, User, Shield, Sparkles, Palette } from 'lucide-react';
import { useStore } from '../../store/useStore';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Property AI Chat',
  '/dashboard/profile': 'Profile & Security',
};

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
  } = useStore();

  const pageTitle = routeTitles[location.pathname] ?? 'Property AI Portal';

  const handleRefresh = () => {
    window.location.reload();
  };


  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        height: 60,
        backgroundColor: 'var(--bg-header)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Page Title & Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <AnimatePresence mode="wait">
          <motion.h1
            key={pageTitle}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.15 }}
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.015em',
            }}
          >
            {pageTitle}
          </motion.h1>
        </AnimatePresence>
      </div>

      {/* Dataset Selector removed */}

      {/* Right Header Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Refresh Page */}
        <button
          onClick={handleRefresh}
          title="Refresh Data"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <RefreshCw size={14} />
        </button>

        {/* User Profile Pill */}
        {user && (
          <button
            onClick={() => navigate('/dashboard/profile')}
            title="Profile & Security Settings"
            style={{
              height: 34,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: user.is_admin ? 'var(--accent-amber)' : 'var(--accent-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {(user.full_name || user.email || 'U')[0].toUpperCase()}
            </div>
            <span>{user.full_name ? user.full_name.split(' ')[0] : 'Analyst'}</span>
          </button>
        )}

        {/* Active Dataset Indicator removed */}
      </div>
    </motion.header>
  );
};

export default Header;
