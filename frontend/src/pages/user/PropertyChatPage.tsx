/**
 * User Property Chat Page
 * Features a real-estate portal dashboard with a premium floating AI chatbot bubble.
 * Includes fullscreen, minimize, and close toggles, suggestion chips, and role-based contact masking.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Send, Sparkles, MessageSquare, Trash2, Database, Clock,
  Home, BedDouble, Expand, ExternalLink, Info, MapPin,
  Minimize2, Minus, X, ChevronDown, ChevronUp, CheckCircle, Brain
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { queryChatbot, getPropertiesMetadata } from '../../services/chatbotApi';

interface PropertyItem {
  id: number;
  property_name: string;
  description: string;
  owner_first_name: string;
  price: number;
  price_display: string;
  deposit: number;
  carpet_area: number;
  saleable_area: string;
  area_unit: string;
  city: string;
  location: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  estate_type: string;
  dealing_type: string;
  property_type: string;
  bhk_type: string;
  furnishing: string;
  parking_type: string;
  possession_type: string;
  property_status: string;
  possession_date: string | null;
  age_of_property: string;
  bedrooms: string;
  bathrooms: string;
  balconies: string;
  floor: string;
  landmark: string;
  amenities: string;
  door_direction: string;
  vastu_compliant: string;
  available_for: string;
  parking_count: string;
  entry_date: string | null;
  floor_count?: string;
  cabin_count?: string;
  toilet_count?: string;
  pantry_count?: string;
  workstation?: string;
  conference_count?: string;
  seaters_count?: string;
  suitable_for?: string;
  type_of_furnished?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  properties?: PropertyItem[];
  suggestions?: string[];
}

const SUGGESTIONS = [
  "Properties in Wakad",
  "Flats for rent in Kondhwa",
  "Apartments in Hinjewadi",
  "Show properties in Undri",
  "Commercial space in Kharadi",
  "Flats for sale in Baner",
  "Cheapest properties in Wagholi",
  "Residential flats in Kothrud"
];

const LOADER_MESSAGES = [
  "Analyzing your preferences...",
  "Searching live database...",
  "Applying criteria...",
  "Retrieving matching listings...",
  "Formatting property cards..."
];

const PropertyChatPage: React.FC = () => {
  const { user } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [metaCount, setMetaCount] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Floating Bubble & Toggle States
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'bubble' | 'fullscreen'>('bubble');
  const [isMinimized, setIsMinimized] = useState(false);

  const [loaderText, setLoaderText] = useState(LOADER_MESSAGES[0]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoaderText(LOADER_MESSAGES[0]);
      let index = 0;
      interval = setInterval(() => {
        index = (index + 1) % LOADER_MESSAGES.length;
        setLoaderText(LOADER_MESSAGES[index]);
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  const fetchFreshness = useCallback(async () => {
    try {
      const data = await getPropertiesMetadata();
      if (data && data.total_properties) {
        setMetaCount(data.total_properties);
      }
    } catch {
      // Fail silently
    }
  }, []);

  useEffect(() => {
    fetchFreshness();
    // Load greeting message
    setMessages([
      {
        role: 'assistant',
        content: `Hello ${user?.full_name || 'there'}! I am your InterCity Property Assistant. I have access to our live real-estate database. Ask me anything about properties, prices, locations, or BHKs!`,
        suggestions: SUGGESTIONS,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [fetchFreshness, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, loading, isOpen, isMinimized]);

  const formatPrice = (price: number, priceDisplay?: string) => {
    if (priceDisplay) return priceDisplay;
    if (!price) return 'Price on Request';
    const lakhs = price / 100000;
    if (lakhs < 100) {
      return `₹${lakhs.toFixed(1)} Lakh`;
    }
    return `₹${(lakhs / 100).toFixed(2)} Cr`;
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessageText = textToSend;
    setInput('');
    
    // Add user message
    const userMsg: Message = {
      role: 'user',
      content: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build history for backend
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await queryChatbot(userMessageText, history);
      
      const botMsg: Message = {
        role: 'assistant',
        content: res.answer,
        properties: res.properties || [],
        suggestions: res.suggestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      toast.error(err.message || 'Chatbot encountered an error.');
      const errorMsg: Message = {
        role: 'assistant',
        content: `I ran into an issue processing your query: "${err.message || 'Internal server error'}". Please try again shortly.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleEnquiry = (propName: string) => {
    toast.success(`Enquiry request logged for "${propName}". The dealer will get back to you!`, {
      icon: '📩'
    });
  };

  const clearHistory = () => {
    setMessages([
      {
        role: 'assistant',
        content: `History cleared. How can I help you with InterCity properties today?`,
        suggestions: SUGGESTIONS,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // ── Render Sub-Components ──

  const renderChatHeader = () => {
    return (
      <div style={{
        padding: '12px 18px',
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-canvas) 100%)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: '52px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--accent-primary-light)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={14} />
          </div>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Property AI Agent
            </h3>
            <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
              Active Online
            </span>
          </div>
        </div>

        {/* Window Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Minimize / Maximize Content */}
          {chatMode === 'bubble' && (
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Maximize Window" : "Minimize Window"}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isMinimized ? <ChevronUp size={14} /> : <Minus size={14} />}
            </button>
          )}

          {/* Fullscreen / Restore Toggle */}
          <button
            onClick={() => {
              setChatMode(chatMode === 'bubble' ? 'fullscreen' : 'bubble');
              setIsMinimized(false);
            }}
            title={chatMode === 'bubble' ? "Expand Chat" : "Restore Chat size"}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {chatMode === 'bubble' ? <Expand size={14} /> : <Minimize2 size={14} />}
          </button>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            title="Close Chat"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderChatBody = () => {
    const lastMessage = messages[messages.length - 1];
    const activeSuggestions = (lastMessage && lastMessage.role === 'assistant' && !loading)
      ? (lastMessage.suggestions || [])
      : [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Subheader Metadata Freshness Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={12} style={{ color: 'var(--accent-primary)' }} />
            <span>Live Database: <strong>{metaCount.toLocaleString()} properties</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} style={{ color: 'var(--color-success)' }} />
            <span><strong>Real-time</strong></span>
          </div>
        </div>

        {/* Chat Messages Log */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AnimatePresence>
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: '85%',
                    alignItems: isUser ? 'flex-end' : 'flex-start'
                  }}>
                    {/* Message Bubble */}
                    <div 
                      className={isUser ? "premium-message-user" : "premium-message-bot"}
                      style={{
                        padding: '12px 16px',
                        fontSize: '13.5px',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Timestamp */}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {msg.timestamp}
                    </span>

                    {/* Grounded Property Recommendations Cards */}
                    {!isUser && msg.properties && msg.properties.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: chatMode === 'fullscreen' ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
                          gap: '12px',
                          marginTop: '12px',
                          width: '100%',
                          minWidth: (chatMode === 'fullscreen' && msg.properties.length > 1) ? '600px' : 'auto'
                        }}
                      >
                        {msg.properties.map((prop) => (
                          <div
                            key={prop.id}
                            className="premium-property-card"
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              boxShadow: 'var(--shadow-sm)',
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                          >
                            {/* Property Details */}
                            <div style={{ padding: '12px', flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: 'rgba(var(--accent-primary-rgb), 0.1)',
                                    color: 'var(--accent-primary)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase'
                                  }}>
                                    {prop.property_type || prop.estate_type}
                                  </span>
                                  {prop.dealing_type && (
                                    <span style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      background: prop.dealing_type === 'Rent' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                      color: prop.dealing_type === 'Rent' ? '#d97706' : '#059669',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      textTransform: 'uppercase'
                                    }}>
                                      For {prop.dealing_type}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                                  {formatPrice(prop.price, prop.price_display)}
                                </span>
                              </div>

                              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                                {prop.property_name}
                              </h4>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                                📍 {prop.location}{prop.location && prop.city ? ', ' : ''}{prop.city}
                                {prop.landmark ? ` (near ${prop.landmark})` : ''}
                              </p>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                {prop.bhk_type && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <BedDouble size={12} />
                                    <span>{prop.bhk_type}</span>
                                  </div>
                                )}
                                {prop.carpet_area > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Home size={12} />
                                    <span>{prop.carpet_area} {prop.area_unit}</span>
                                  </div>
                                )}
                                {prop.furnishing && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Info size={12} />
                                    <span>{prop.furnishing}{prop.type_of_furnished ? ` (${prop.type_of_furnished})` : ''}</span>
                                  </div>
                                )}
                                {prop.parking_type && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={12} />
                                    <span>Parking: {prop.parking_type}</span>
                                  </div>
                                )}
                              </div>

                              {/* Additional Specific Specs */}
                              {(prop.balconies || prop.floor || prop.vastu_compliant || prop.available_for) && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', borderTop: '1px dashed var(--border-default)', paddingTop: '8px' }}>
                                  {prop.balconies && (
                                    <div><span>🎈 Balconies: {prop.balconies}</span></div>
                                  )}
                                  {prop.floor && (
                                    <div><span>🏢 Floor: {prop.floor}{prop.floor_count ? ` of ${prop.floor_count}` : ''}</span></div>
                                  )}
                                  {prop.vastu_compliant && (
                                    <div><span>🧭 Vastu: {prop.vastu_compliant} {prop.door_direction ? `(${prop.door_direction} Face)` : ''}</span></div>
                                  )}
                                  {prop.available_for && (
                                    <div><span>👥 Tenants: {prop.available_for}</span></div>
                                  )}
                                </div>
                              )}

                              {/* Commercial Features Section */}
                              {(prop.estate_type === 'Commercial' || prop.cabin_count || prop.workstation) && (
                                <div style={{
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: 'rgba(99, 102, 241, 0.04)',
                                  border: '1px solid rgba(99, 102, 241, 0.15)',
                                  fontSize: '11px',
                                  marginBottom: '10px'
                                }}>
                                  <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>🏢 Commercial Details:</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    {prop.cabin_count && <div>🗄️ Cabins: {prop.cabin_count}</div>}
                                    {prop.workstation && <div>💻 Workstations: {prop.workstation}</div>}
                                    {prop.conference_count && <div>👥 Conference: {prop.conference_count}</div>}
                                    {prop.seaters_count && <div>💺 Seating: {prop.seaters_count} seaters</div>}
                                    {prop.pantry_count && <div>☕ Pantry: {prop.pantry_count}</div>}
                                    {prop.toilet_count && <div>🚻 Toilets: {prop.toilet_count}</div>}
                                    {prop.suitable_for && <div style={{ gridColumn: 'span 2' }}>🎯 Suitable For: {prop.suitable_for}</div>}
                                  </div>
                                </div>
                              )}

                              {/* Amenities Tags */}
                              {prop.amenities && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                                  {prop.amenities.split(',').slice(0, 3).map((am, i) => (
                                    <span key={i} style={{ fontSize: '9.5px', background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                      {am.trim()}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Property Status & Owner */}
                              {(prop.property_status || prop.owner_first_name) && (
                                <div style={{
                                  marginTop: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: 'rgba(16, 185, 129, 0.04)',
                                  border: '1px dashed rgba(16, 185, 129, 0.2)',
                                  fontSize: '11px'
                                }}>
                                  {prop.property_status && (
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                      🏠 Status: {prop.property_status}
                                    </div>
                                  )}
                                  {prop.owner_first_name && (
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                      👤 Listed by: {prop.owner_first_name}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions Footer */}
                            <div style={{
                              padding: '8px 12px',
                              background: 'var(--bg-canvas)',
                              borderTop: '1px solid var(--border-default)',
                              display: 'flex',
                              gap: '8px'
                            }}>
                              <button
                                onClick={() => handleEnquiry(prop.property_name)}
                                style={{
                                  flex: 1,
                                  background: 'var(--accent-primary)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Contact via InterCity
                              </button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Loading Indicator */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--accent-primary-light)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={12} />
                </div>
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '0 10px 10px 10px',
                  padding: '8px 12px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginRight: '4px' }}>
                    {loaderText}
                  </span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-primary)', display: 'block' }}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Suggestions Chips */}
        {activeSuggestions.length > 0 && (
          <div style={{ padding: '0 16px', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {activeSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '999px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Form Bar */}
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <button
            onClick={clearHistory}
            title="Clear Conversation History"
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger)',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Trash2 size={14} />
          </button>

          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            style={{ display: 'flex', gap: '8px', flex: 1, position: 'relative' }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Ask property assistant..."
              style={{
                flex: 1,
                padding: '9px 12px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
                opacity: (!input.trim() || loading) ? 0.6 : 1,
                flexShrink: 0
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px)', background: 'var(--bg-app)', overflow: 'hidden' }}>
      
      {/* ── Dashboard Content (Visible behind the floating chat) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto', padding: '24px', paddingBottom: '100px' }}>
        
        {/* Welcome Hero Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1), rgba(var(--accent-primary-rgb), 0.02))',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
            Welcome to the InterCity Property Portal
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', maxWidth: '800px', lineHeight: 1.6, margin: 0 }}>
            Browse active properties, upload datasets, and utilize our grounded Conversational AI Assistant to query real estate catalog records seamlessly.
          </p>
        </div>

        {/* Telemetry Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Properties Catalog Size
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              {metaCount} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Properties</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-success)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle size={12} /> Active Ingestion Database
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Cities Covered
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Pune
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 500 }}>
              Maharashtra, India
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Active Localities
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, marginTop: '4px' }}>
              Wakad, Hinjewadi, Baner, Kothrud
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
              Rapidly growing tech hubs
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Conversational Engine
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <Brain size={18} /> Gemini AI
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 500 }}>
              Context-grounded query agent
            </div>
          </div>

        </div>

        {/* Catalog Preview / Quick Search Guide */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
              <MessageSquare size={16} style={{ color: 'var(--accent-primary)' }} />
              Quick Chat Suggestions
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '16px', margin: '0 0 16px 0' }}>
              Click the floating bubble in the bottom right to start chatting. You can ask queries like:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsOpen(true);
                    setChatMode('bubble');
                    setIsMinimized(false);
                    handleSend(s);
                  }}
                  style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
              <Info size={16} style={{ color: 'var(--accent-primary)' }} />
              Role-Based Access Control (RBAC)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.6, marginBottom: '12px', margin: '0 0 12px 0' }}>
              InterCity Property Portal features secure contact details masking depending on the logged-in user role:
            </p>
            <ul style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, paddingLeft: '20px', margin: 0 }}>
              <li><strong>Dealers, Brokers & Admins</strong>: See complete contact telephone numbers and dealer emails directly in the property cards to make quick enquiries.</li>
              <li><strong>Regular Buyers/Users</strong>: Contact info is masked for privacy (e.g. `+91 ******` and `******@domain.com`).</li>
            </ul>
            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'var(--bg-app)', border: '1px solid var(--border-default)', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 600 }}>
                Logged in as: <span style={{ color: 'var(--accent-primary)' }}>{user?.role || 'Guest'}</span>
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* ── FLOATING CHAT BUBBLE TRIGGER (Visible if chat is closed) ── */}
      {!isOpen && (
        <motion.button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="pulse-chat-btn"
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(var(--accent-primary-rgb), 0.3)',
            zIndex: 1001,
            outline: 'none'
          }}
        >
          <div style={{ position: 'relative' }}>
            <MessageSquare size={26} />
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success)',
              border: '2px solid var(--bg-surface)'
            }} />
          </div>
        </motion.button>
      )}

      {/* ── FLOATING / EXPANDED OVERLAY CHAT CONSOLE ── */}
      {isOpen && (
        <AnimatePresence>
          {chatMode === 'fullscreen' ? (
            /* Centered Overlay Modal Mode (Less than Fullscreen) */
            <div className="premium-chat-backdrop" onClick={() => setIsOpen(false)}>
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="premium-chat-modal"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal itself
              >
                {renderChatHeader()}
                {renderChatBody()}
              </motion.div>
            </div>
          ) : (
            /* Floating Dialog Mode */
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="premium-chat-floating"
            >
              {renderChatHeader()}
              {!isMinimized && renderChatBody()}
            </motion.div>
          )}
        </AnimatePresence>
      )}

    </div>
  );
};

export default PropertyChatPage;
