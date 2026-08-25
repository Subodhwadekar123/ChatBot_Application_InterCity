/**
 * HomePage — InterCity Real-Estate AI Chatbot
 * Comprehensive Property AI Chat Workspace for Dealers and Brokers.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Brain, BarChart2, Upload, Zap, Shield, TrendingUp,
  ChevronRight, Star, Play, Database, Sparkles,
  PieChart, GitMerge, Activity, X, Lock, CheckCircle, ArrowUpRight, UserPlus,
  MessageSquare, Filter, Building, PhoneCall, Search
} from 'lucide-react';
import { useStore } from '../store/useStore';
import InteractiveBackground from '../components/layout/InteractiveBackground';

const fadeUp: any = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger: any = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const FEATURES = [
  { icon: MessageSquare, title: 'Natural Language Search', description: 'Search properties in natural conversational English. Find listings by BHK, location, price, and furnishings.', color: '#6366f1' },
  { icon: Sparkles, title: 'Gemini AI Integration', description: 'Intelligent answers, correlation metrics of properties, and grounded catalog responses powered by Gemini.', color: '#8b5cf6' },
  { icon: Filter, title: 'Dynamic Search Filtering', description: 'Autodetect price ranges, locations, and rooms. Instantly filters the live properties database.', color: '#a855f7' },
  { icon: Shield, title: 'Role-Based Access Control', description: 'Contact information is automatically masked for regular clients but fully visible to brokers, dealers, and admins.', color: '#ec4899' },
  { icon: Upload, title: 'Easy Catalog Ingestion', description: 'Admins can upload an Excel sheet catalog of properties. Automatically parsed, normalized, and made queryable.', color: '#14b8a6' },
  { icon: Database, title: 'Database Persistence', description: 'Secure SQLite storage of property listings, audit logging, and active user logins.', color: '#f59e0b' },
  { icon: Lock, title: 'Unified Auth Security', description: 'JWT tokens, active sessions viewer, device revocation, and strength-metered password reset support.', color: '#10b981' },
  { icon: CheckCircle, title: 'Direct Enquiries', description: 'Allows users to immediately enquire about properties. Prompts brokers and dealers for follow-ups.', color: '#3b82f6' },
];

const STATS = [
  { value: '10K+', label: 'Verified Listings' },
  { value: '1.2s', label: 'Response Latency' },
  { value: '100%', label: 'RBAC Protected' },
  { value: '24/7', label: 'AI Availability' },
];

const TESTIMONIALS = [
  {
    name: 'Rajesh Sharma',
    role: 'Managing Partner @ Pune Realty',
    avatar: 'RS',
    text: 'This chatbot is a game-changer for our property sales. Clients can type exactly what they want in natural English and get correct, masked listings instantly. When they log in as a verified agent, they get broker details.',
    rating: 5,
  },
  {
    name: 'Marcus D\'Souza',
    role: 'Independent Broker',
    avatar: 'MD',
    text: 'I uploaded our properties spreadsheet and within seconds the AI chatbot was answering questions about our portfolio. No complex search forms needed for my clients anymore.',
    rating: 5,
  },
  {
    name: 'Priya Mehta',
    role: 'Property Agent @ InterCity Homes',
    avatar: 'PM',
    text: 'The role-based security is brilliant. It protects our contact numbers from scrapers and unregistered users, while allowing verified buyers to reach out to us directly.',
    rating: 5,
  },
];


export default function HomePage() {
  const navigate = useNavigate();
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const { token, user } = useStore();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Dynamic Cursor Glowing Orbit Field */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.03) 45%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Interactive Background Canvas */}
      <InteractiveBackground />

      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--bg-header)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          height: '68px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/logo.jpg"
            alt="Logo"
            style={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              objectFit: 'cover',
              mixBlendMode: 'normal',
            }}
          />
          <div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              InterCity Portal
            </span>
            <span
              style={{
                marginLeft: '8px',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              Property Chatbot
            </span>
          </div>
        </div>

        {/* Quick Nav Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to={token ? '/dashboard' : '/login'}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
            }}
          >
            {token ? 'Open Chatbot' : 'Sign In'} <ChevronRight size={15} />
          </Link>
        </div>

      </nav>

      {/* ── Hero Section (with Login/Register CTA Panel) ───────────────────── */}
      <section
        style={{
          paddingTop: '110px',
          paddingBottom: '70px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 'calc(100vh - 68px)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Ambient Glows */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '20%',
            width: '500px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)',
            filter: 'blur(70px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '15%',
            width: '450px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 32px',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '48px',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  marginBottom: '20px',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#a5b4fc',
                  letterSpacing: '0.04em',
                }}
              >
                <Sparkles size={13} color="#818cf8" />
                AI-POWERED REAL-ESTATE PORTAL
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              style={{
                fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)',
                fontWeight: 900,
                lineHeight: 1.15,
                marginBottom: '20px',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.02em',
              }}
            >
              Find Properties.{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Chat in Real-Time.
              </span>{' '}
              Close Deals Faster.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              style={{
                fontSize: '1.05rem',
                color: 'var(--text-secondary)',
                maxWidth: '560px',
                lineHeight: 1.7,
                marginBottom: '28px',
              }}
            >
              The intelligent AI property assistant for property dealers and brokers. Search, filter, 
              and compare catalogs instantly using simple natural-language conversations.
            </motion.p>

            {/* Feature Pills */}
            <motion.div
              variants={fadeUp}
              style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}
            >
              {[
                { icon: Search, label: 'Natural Language Search' },
                { icon: Sparkles, label: 'AI Powered' },
                { icon: Filter, label: 'Dynamic Filters' },
                { icon: Shield, label: 'Secure RBAC' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-default)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Icon size={13} color="var(--accent-primary)" /> {label}
                </span>
              ))}
            </motion.div>

            {/* Quick Metrics Bar */}
            <motion.div
              variants={fadeUp}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                maxWidth: '500px',
              }}
            >
              {[
                { label: 'Search Time', val: '< 1.0s', sub: 'Instant Matches' },
                { label: 'Catalog Upload', val: '1-Click', sub: 'Excel Import' },
                { label: 'Access Control', val: 'Secure RBAC', sub: 'Masked Contacts' },
              ].map(({ label, val, sub }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{val}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '2px' }}>{label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sub}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>


          {/* Right Column: Login / Register CTA Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <div
              className="glow-card"
              style={{
                backdropFilter: 'blur(24px)',
                borderRadius: '24px',
                padding: '32px',
                boxShadow: 'var(--shadow-xl)',
                maxWidth: '420px',
                width: '100%',
                textAlign: 'center',
                position: 'relative',
                zIndex: 10,
                boxSizing: 'border-box',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 16px',
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
                }}
              >
                <Zap size={30} color="white" />
              </div>

              <h3 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {token && user ? 'Welcome Back!' : 'Get Started Today'}
              </h3>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {token && user
                  ? 'Your property workspace is ready. Continue searching, filtering, and communicating.'
                  : 'Sign in to search properties, view builder details, and connect with dealers instantly.'}
              </p>

              {/* Primary CTA */}
              <Link
                to={token ? '/dashboard' : '/login'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 6px 20px rgba(79,70,229,0.45)',
                  transition: 'all 0.2s ease',
                  marginBottom: '12px',
                }}
              >
                {token && user ? 'Open Property Chat' : 'Sign In to Workspace'}
                <ChevronRight size={18} />
              </Link>

              {/* Secondary CTA */}
              {!(token && user) && (
                <Link
                  to="/register"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '13px',
                    borderRadius: '12px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <UserPlus size={18} color="var(--accent-primary)" />
                  Create Free Account
                </Link>
              )}

              {/* Divider */}
              <div style={{ position: 'relative', textAlign: 'center', margin: '22px 0 16px' }}>
                <div style={{ borderTop: '1px solid var(--border-default)', position: 'absolute', top: '50%', left: 0, right: 0 }} />
                <span style={{ background: 'var(--bg-surface)', padding: '0 10px', fontSize: '11px', color: 'var(--text-muted)', position: 'relative', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick Launchers
                </span>
              </div>

              {/* Quick Launcher Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <Link
                  to="/dashboard"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px',
                    borderRadius: '10px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <MessageSquare size={14} color="var(--accent-primary)" /> Chatbot
                </Link>
              </div>

            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Interactive Capability Showcase Grid ───────────────────────────── */}
      <section
        style={{
          padding: '40px 32px 80px',
          maxWidth: '1280px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: '0 0 12px' }}>
              Explore Platform Capabilities
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              Direct access to all analytical modules from one unified workspace
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            {FEATURES.map(({ icon: Icon, title, description, color }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className="glow-card"
                style={{
                  backdropFilter: 'blur(12px)',
                  borderRadius: '16px',
                  padding: '24px',
                  transition: 'all 0.25s ease',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    background: `${color}18`,
                    border: `1px solid ${color}35`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', background: 'var(--bg-app)', borderTop: '1px solid var(--border-default)' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif", marginBottom: '12px' }}>
              Trusted by Data Teams Worldwide
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>From independent analysts to high-scale enterprise departments.</p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {TESTIMONIALS.map(({ name, role, avatar, text, rating }) => (
              <motion.div
                key={name}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className="glow-card"
                style={{
                  borderRadius: '16px',
                  padding: '26px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={15} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '18px', fontStyle: 'italic', fontSize: '13px' }}>
                  "{text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--border-default)',
          padding: '36px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          maxWidth: '1280px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: 22, height: 22, borderRadius: '6px', objectFit: 'cover', mixBlendMode: 'normal' }} />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>InterCity AI</span>
          <span style={{ color: 'var(--border-strong)', margin: '0 8px' }}>|</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>AI-Powered Real-Estate Chatbot Portal for Dealers & Brokers</span>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <Link to="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px' }}>Sign In</Link>
          <Link to="/register" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px' }}>Register</Link>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
          © {new Date().getFullYear()} InterCity AI Property Portal. All rights reserved.
        </p>

      </footer>
    </div>
  );
}
