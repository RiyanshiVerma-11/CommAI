import React, { useState, useEffect, useCallback, useRef } from 'react';
import GlassCard from '../components/GlassCard';

const OperatorChat = ({ user, backendUrl, headers }) => {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState('general');
  const [staffMembers, setStaffMembers] = useState([]);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const publicChannels = [
    { id: 'general', label: '💬 #general-ops', desc: 'General internal coordination & team updates' },
    { id: 'emergency', label: '🚨 #emergency-triage', desc: 'Urgent emergency alert responses & state signals' },
    { id: 'campaigns', label: '📋 #campaign-approvals', desc: 'Campaign wizard reviews & maker-checker sign-offs' },
  ];

  // Fetch available staff members (Admins & Managers) for 1-on-1 private DMs
  const fetchStaff = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/operator-chat/staff`, { headers });
      if (response.ok) {
        const data = await response.json();
        setStaffMembers(data);
      }
    } catch (err) {
      console.error('Error fetching staff list for DMs:', err);
    }
  }, [backendUrl, headers]);

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/operator-chat/messages?channel=${encodeURIComponent(channel)}`, { headers });
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

  // Initial fetch staff
  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Fetch messages on channel change or initial load + background 5s fallback poll
  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Listen for real-time WebSocket events from App.jsx without requiring refresh
  useEffect(() => {
    const handleWsMsg = (e) => {
      const newMsg = e.detail;
      if (!newMsg) return;
      if (newMsg.channel === channel) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    };

    const handleWsDelete = (e) => {
      const delData = e.detail;
      if (delData && delData.id) {
        setMessages(prev => prev.filter(m => m.id !== delData.id));
      }
    };

    window.addEventListener('commai_operator_chat_msg', handleWsMsg);
    window.addEventListener('commai_operator_chat_delete', handleWsDelete);
    return () => {
      window.removeEventListener('commai_operator_chat_msg', handleWsMsg);
      window.removeEventListener('commai_operator_chat_delete', handleWsDelete);
    };
  }, [channel]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectChannel = (chId) => {
    setActiveDmUser(null);
    setChannel(chId);
  };

  const handleStartDm = (staff) => {
    if (!user || !staff) return;
    const sortedIds = [user.id, staff.id].sort();
    const dmChannelId = `dm:${sortedIds[0]}:${sortedIds[1]}`;
    setActiveDmUser(staff);
    setChannel(dmChannelId);
  };

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

      const createdMsg = await response.json();
      setMessages(prev => {
        if (prev.some(m => m.id === createdMsg.id)) return prev;
        return [...prev, createdMsg];
      });
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

  const otherStaff = staffMembers.filter(s => s.id !== user?.id);
  const filteredStaff = otherStaff.filter(staff => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase().trim();
    return (
      staff.full_name?.toLowerCase().includes(q) ||
      staff.email?.toLowerCase().includes(q) ||
      staff.role?.toLowerCase().includes(q) ||
      staff.designation?.toLowerCase().includes(q)
    );
  });
  const currentPublicChannelObj = publicChannels.find(c => c.id === channel);

  const getHeaderInfo = () => {
    if (currentPublicChannelObj) {
      return {
        label: currentPublicChannelObj.label,
        desc: currentPublicChannelObj.desc
      };
    }
    if (activeDmUser) {
      return {
        label: `🔒 Private DM with ${activeDmUser.full_name}`,
        desc: `Private end-to-end encrypted staff conversation with ${activeDmUser.full_name} (${activeDmUser.role === 'admin' ? 'Admin' : 'Campaign Manager'})`
      };
    }
    return {
      label: '🔒 Private Staff Direct Message',
      desc: 'Private 1-on-1 staff conversation between operators'
    };
  };

  const headerInfo = getHeaderInfo();

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
        justifyContent: 'space-between',
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
              Private communication workspace strictly between <strong>Admins</strong> and <strong>Campaign Managers</strong> with real-time WebSocket delivery and 1-on-1 private messaging.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'hsl(var(--accent))', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            ● Encrypted Staff Session
          </span>
        </div>
      </div>

      {/* Channel & Private DM Switcher */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', letterSpacing: '0.05em', marginRight: '4px' }}>
            Channels:
          </span>
          {publicChannels.map(ch => (
            <button
              key={ch.id}
              type="button"
              onClick={() => handleSelectChannel(ch.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: channel === ch.id ? '1px solid hsl(var(--primary))' : '1px solid var(--border-color-glass)',
                background: channel === ch.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: channel === ch.id ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                fontWeight: channel === ch.id ? '700' : '500',
                cursor: 'pointer',
                fontSize: '0.86rem',
                transition: 'all 0.2s ease'
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Private Direct Messages with Staff Section */}
        {otherStaff.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0, 0, 0, 0.18)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', color: 'hsl(270, 95%, 75%)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🔒 Private Staff DMs ({otherStaff.length}):
              </span>
              
              {/* Search Filter Input Bar */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search staff (e.g. Ramesh, Palak)..."
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 28px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '0.82rem',
                    outline: 'none',
                    transition: 'border 0.2s ease'
                  }}
                />
                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '0.8rem' }}>🔍</span>
                {staffSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setStaffSearchQuery('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {filteredStaff.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic', padding: '4px 0' }}>
                  No staff members found matching "{staffSearchQuery}"
                </span>
              ) : (
                filteredStaff.map(staff => {
                  const dmId = `dm:${[user?.id, staff.id].sort().join(':')}`;
                  const isSelected = channel === dmId;
                  return (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => handleStartDm(staff)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: isSelected ? '1px solid rgba(236, 72, 153, 0.8)' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isSelected ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: isSelected ? '#ec4899' : 'hsl(var(--text-secondary))',
                        fontWeight: isSelected ? '700' : '500',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: staff.role === 'admin' ? '#a855f7' : '#3b82f6', display: 'inline-block' }} />
                      <span>{staff.full_name} ({staff.role === 'admin' ? 'Admin' : 'Manager'})</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Box Container */}
      <GlassCard style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '580px', overflow: 'hidden' }}>
        
        {/* Chat Header Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color-glass)',
          background: channel.startsWith('dm:') ? 'linear-gradient(90deg, rgba(236, 72, 153, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)' : 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{headerInfo.label}</span>
              {channel.startswith?.('dm:') || channel.startsWith('dm:') ? (
                <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.4)', fontSize: '0.72rem' }}>
                  PRIVATE DM
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
              {headerInfo.desc}
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
              <div style={{ fontWeight: '600', fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>
                {channel.startsWith('dm:') ? `No private messages with ${activeDmUser?.full_name || 'this staff member'} yet` : 'No messages in this channel yet'}
              </div>
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
            placeholder={activeDmUser ? `Private DM with ${activeDmUser.full_name}...` : `Message #${headerInfo.label.split(' ')[0]} (Admins & Managers)...`}
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
