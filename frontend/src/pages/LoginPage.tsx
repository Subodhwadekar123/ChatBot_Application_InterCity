import React from 'react';
import { motion } from 'framer-motion';
import AuthForm from '../components/auth/AuthForm';

const LoginPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="card-precision"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px',
          zIndex: 1,
        }}
      >
        <AuthForm initialMode="login" />
      </motion.div>
    </div>
  );
};

export default LoginPage;
