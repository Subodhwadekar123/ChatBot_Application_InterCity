import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import InteractiveBackground from './InteractiveBackground';
import { useStore } from '../../store/useStore';

const DashboardLayout: React.FC = () => {
  const { sidebarCollapsed } = useStore();
  const location = useLocation();


  const mainMarginLeft = sidebarCollapsed ? 64 : 230;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        fontFamily: "var(--font-family-sans)",
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* Interactive Background Canvas */}
      <InteractiveBackground />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Workspace */}
      <motion.div
        animate={{ marginLeft: mainMarginLeft }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Header Bar */}
        <Header />

        {/* Page Main Content */}
        <main
          style={{
            flex: 1,
            padding: '24px 28px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ minHeight: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  );
};

export default DashboardLayout;
