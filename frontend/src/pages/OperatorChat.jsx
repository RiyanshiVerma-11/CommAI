import React, { useState, useEffect, useCallback, useRef } from 'react';
import GlassCard from '../components/GlassCard';

const OperatorChat = ({ user, backendUrl, headers }) => {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState('general');
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const channelsList = [
    { id: 'general', label: '💬 #general-ops', desc: 'General internal coordination & team updates' },
    { id: 'emergency', label: '🚨 #emergency-triage', desc: 'Urgent emergency alert responses & state signals' },
    { id: 'campaigns', label: '📋 #campaign-approvals', desc: 'Campaign wizard reviews & maker-checker sign-offs' },
  ];

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/operator-chat/messages?channel=${channel}`, { headers });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access Restricted: Operator Staff Chat is strictly for Admins & Campaign Managers.');
        }
        throw new Error('Failed to load operator chat messages.');
      }
      const data = await response.json();
      setMessages(data);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading messages');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [backendUrl, headers, channel]);

  // Initial fetch and auto-polling
  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMsg.trim() || sending) return;

    const textToSend = inputMsg.trim();
    setInputMsg('');
    setSending(true);

    try {
      const response = await fetch(`${backendUrl}/api/operator-chat/messages`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          channel: channel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to send message');
      }

      await fetchMessages(false);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error sending message');
      setInputMsg(textToSend); // Restore on error
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      const response = await fetch(`${backendUrl}/api/operator-chat/messages/${msgId}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to delete message');
      }
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      alert(err.message);
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.16)', color: 'hsl(270, 95%, 75%)', border: '1px solid rgba(168, 85, 247, 0.35)', fontSize: '0.7rem', padding: '2px 8px' }}>
          🛡️ ADMIN
        </span>
      );
    }
    return (
      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.16)', color: 'hsl(217, 91%, 70%)', border: '1px solid rgba(59, 130, 246, 0.35)', fontSize: '0.7rem', padding: '2px 8px' }}>
        👔 MANAGER
      </span>
    );
  };

  const getInitials = (name) => {
    if (!name) return 'OP';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      
      {/* Privacy & Scope Disclaimer Banner */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '1.4rem' }}>🔒</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'hsl(var(--text-primary))' }}>
              Internal Staff & Operator Command Channel
            </div>
            <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
              Private communication workspace strictly between <strong>Admins</strong> and <strong>Campaign Managers</strong>. Audience members & citizens cannot see or access this chat.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'hsl(var(--accent))', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            ● Encrypted Staff Session
          </span>
        </div>
      </div>

      {/* Channel Switcher */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {channelsList.map(ch => (
          <button
            key={ch.id}
            type="button"
            onClick={() => setChannel(ch.id)}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: channel === ch.id ? '1px solid hsl(var(--primary))' : '1px solid var(--border-color-glass)',
              background: channel === ch.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: channel === ch.id ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
              fontWeight: channel === ch.id ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.88rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{ch.label}</span>
          </button>
        ))}
      </div>

      {/* Main Chat Box Container */}
      <GlassCard style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '580px', overflow: 'hidden' }}>
        
        {/* Chat Header Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color-glass)',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>
              {channelsList.find(c => c.id === channel)?.label}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
              {channelsList.find(c => c.id === channel)?.desc}
            </div>
          </div>
          <button
            type="button"
            className="pill-chip"
            onClick={() => fetchMessages(true)}
            style={{ fontSize: '0.78rem', padding: '6px 12px', background: 'rgba(255, 255, 255, 0.06)' }}
          >
            🔄 Sync Chat
          </button>
        </div>

        {/* Messages List Area */}
        <div style={{ flexGrow: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
              Loading operator messages...
            </div>
          ) : error ? (
            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: 'hsl(var(--danger))', fontSize: '0.9rem' }}>
              ⚠️ {error}
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.5 }}>💬</div>
              <div style={{ fontWeight: '600', fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>No messages in this channel yet</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Be the first operator to start the conversation!</div>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    flexDirection: isSelf ? 'row-reverse' : 'row'
                  }}
                >
                  {/* Sender Avatar */}
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: msg.sender_role === 'admin' ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}>
                    {getInitials(msg.sender_name)}
                  </div>

                  {/* Message Bubble Card */}
                  <div style={{
                    maxWidth: '75%',
                    background: isSelf ? 'rgba(59, 130, 246, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isSelf ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-color-glass)'}`,
                    borderRadius: isSelf ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'hsl(var(--text-primary))' }}>
                        {msg.sender_name}
                      </span>
                      {getRoleBadge(msg.sender_role)}
                      <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginLeft: 'auto' }}>
                        {formatTimestamp(msg.created_at)}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.92rem', color: 'hsl(var(--text-primary))', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.message}
                    </div>

                    {/* Delete action for owner or admin */}
                    {(isSelf || user?.role === 'admin') && (
                      <div style={{ alignSelf: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'hsl(var(--text-muted))',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            opacity: 0.7
                          }}
                          onMouseEnter={(e) => e.target.style.color = 'hsl(var(--danger))'}
                          onMouseLeave={(e) => e.target.style.color = 'hsl(var(--text-muted))'}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Operators Presets */}
        <div style={{ padding: '8px 16px', background: 'rgba(0, 0, 0, 0.15)', borderTop: '1px solid var(--border-color-glass)', display: 'flex', gap: '8px', overflowX: 'auto', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: '600', flexShrink: 0 }}>Quick Actions:</span>
          {[
            { label: '🚨 Shift Alert: Flood Warning', text: '🚨 Shift Alert: Heavy flood warning triggered. Please review Emergency Bulletins.' },
            { label: '✅ Campaign Approved', text: '✅ Campaign draft has been reviewed and approved for delivery.' },
            { label: '📊 Shift Handover', text: '📊 Shift handover update: All active queues cleared for the hour.' },
            { label: '🤖 AI Template Check', text: '🤖 Please verify AI Poster Studio templates before broadcasting.' }
          ].map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className="pill-chip"
              onClick={() => setInputMsg(preset.text)}
              style={{ fontSize: '0.75rem', padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSendMessage} style={{ padding: '14px 18px', background: 'rgba(0, 0, 0, 0.25)', borderTop: '1px solid var(--border-color-glass)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder={`Message #${channelsList.find(c => c.id === channel)?.label.split(' ')[1]} (Admins & Managers)...`}
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            style={{ borderRadius: '10px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.04)' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!inputMsg.trim() || sending}
            style={{ padding: '12px 24px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            {sending ? 'Sending...' : 'Send 🚀'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
};

export default OperatorChat;
