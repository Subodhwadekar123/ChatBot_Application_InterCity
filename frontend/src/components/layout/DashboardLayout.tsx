import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import { useStore } from '../../store/useStore';
import { listDatasets, getDataset } from '../../services/api';

const DashboardLayout: React.FC = () => {
  const { sidebarCollapsed, datasets, activeDataset, addDataset, setActiveDataset } = useStore();
  const location = useLocation();

  React.useEffect(() => {
    const syncDatasets = async () => {
      try {
        const res = await listDatasets();
        const backendList = res.datasets || [];
        
        // Load details for datasets not present in local store
        for (const item of backendList) {
          const alreadyStored = datasets.some(d => d.id === item.id);
          if (!alreadyStored) {
            try {
              const fullDetails = await getDataset(item.id);
              const mapped: any = {
                id: fullDetails.dataset_id,
                filename: fullDetails.filename,
                file_size_mb: item.file_size_mb,
                file_type: fullDetails.file_type,
                dataset_info: fullDetails.dataset_info,
                preview: fullDetails.preview,
                uploaded_at: fullDetails.created_at,
              };
              addDataset(mapped);
            } catch (err) {
              console.error(`Failed to fetch details for dataset ${item.id}`, err);
            }
          }
        }

        // Set active dataset if not set and datasets are available
        if (!activeDataset && backendList.length > 0) {
          try {
            const firstId = backendList[0].id;
            const fullDetails = await getDataset(firstId);
            const mapped: any = {
              id: fullDetails.dataset_id,
              filename: fullDetails.filename,
              file_size_mb: backendList[0].file_size_mb,
              file_type: fullDetails.file_type,
              dataset_info: fullDetails.dataset_info,
              preview: fullDetails.preview,
              uploaded_at: fullDetails.created_at,
            };
            setActiveDataset(mapped);
          } catch (err) {
            console.error("Failed to auto-set active dataset", err);
          }
        }
      } catch (err) {
        console.error("Failed to sync datasets list from backend", err);
      }
    };
    syncDatasets();
  }, []); // Run once on layout mount

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
