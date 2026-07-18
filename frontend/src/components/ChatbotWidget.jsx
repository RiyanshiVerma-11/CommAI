import React, { useState, useRef, useEffect } from 'react';

const ChatbotWidget = ({ user, backendUrl, token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your CommAI Assistant. Ask me anything!",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Escalation state
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [escalateSubject, setEscalateSubject] = useState('');
  const [escalateMessage, setEscalateMessage] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalationSuccess, setEscationSuccess] = useState(false);
  const [feedbackGivenIndex, setFeedbackGivenIndex] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user) {
      const isAudience = user.role === 'audience';
      const initialGreeting = isAudience
        ? `Hello ${user.full_name || 'there'}! I'm your CommAI Assistant. Ask me anything about emergency warnings, campaign alerts, sharing feedback, or seeking assistance!`
        : `Hello ${user.full_name || 'there'}! I'm your CommAI Assistant. Ask me anything about creating campaigns, reaching your audience, translating messages, or navigating the platform!`;

      setMessages([
        {
          role: 'assistant',
          content: initialGreeting,
          timestamp: new Date(),
        }
      ]);
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, showEscalateForm]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setInputValue('');
    
    // Add user message
    const updatedMessages = [
      ...messages,
      { role: 'user', content: userText, timestamp: new Date() }
    ];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Map history to backend format
      const history = updatedMessages.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const res = await fetch(`${backendUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userText,
          history: history.slice(-6) // Send last 6 messages for context
        })
      });

      if (!res.ok) throw new Error('API communication error');

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, timestamp: new Date(), showFeedback: true }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "Sorry, I'm having trouble connecting to my service right now. Please try again.", timestamp: new Date() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (actionText) => {
    setInputValue(actionText);
  };

  const handleFeedback = (index, satisfied) => {
    setFeedbackGivenIndex(index);
    if (!satisfied) {
      // Pre-fill the escalation query with the last user prompt and bot response
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      setEscalateSubject(`Confusion regarding: ${lastUserMsg?.content.slice(0, 40) || 'Platform Help'}...`);
      setEscalateMessage(`User confusion prompt: "${lastUserMsg?.content || ''}"\n\nAI reply was not satisfactory. Please help.`);
      setShowEscalateForm(true);
    } else {
      // Mark feedback as finished
      setMessages(prev => prev.map((msg, i) => i === index ? { ...msg, showFeedback: false } : msg));
      alert("Thank you for your feedback! Glad I could help.");
    }
  };

  const handleEscalationSubmit = async (e) => {
    e.preventDefault();
    if (!escalateSubject.trim() || !escalateMessage.trim()) return;

    setEscalating(true);
    try {
      const res = await fetch(`${backendUrl}/api/queries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: escalateSubject,
          message: escalateMessage
        })
      });

      if (!res.ok) throw new Error('Failed to submit support query');

      setEscationSuccess(true);
      setTimeout(() => {
        setShowEscalateForm(false);
        setEscationSuccess(false);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: "I have successfully submitted your query to our Campaign Managers. You can track this in your queries history or wait for a reply.",
            timestamp: new Date()
          }
        ]);
      }, 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, fontFamily: 'var(--font-body)' }}>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 100%)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(76, 140, 252, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'rotate(180deg) scale(0.95)' : 'scale(1)'
        }}
        title="Help Chatbot"
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '24px', height: '24px' }}>
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '26px', height: '26px' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>

      {/* Glassmorphic Chat Window */}
      {isOpen && (
        <div
          className="glass-card"
          style={{
            position: 'absolute',
            bottom: '72px',
            right: '0',
            width: '360px',
            height: '480px',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--glass-shadow)',
            border: '1.5px solid #000000',
            background: 'hsl(var(--bg-card) / 94%)',
            backdropFilter: 'blur(20px)',
            animation: 'animate-slide-up 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            color: 'hsl(var(--text-primary))'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color-glass)',
              background: 'linear-gradient(90deg, rgba(76, 140, 252, 0.1) 0%, rgba(177, 140, 255, 0.05) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(76, 140, 252, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                    <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </div>
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: '9px', height: '9px', borderRadius: '50%', backgroundColor: 'hsl(var(--accent))', border: '2px solid hsl(var(--bg-card))' }}></span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>CommAI Assistant</h3>
                <span style={{ fontSize: '0.72rem', color: 'hsl(var(--accent))', fontWeight: 600 }}>Active Online</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '4px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>

          {/* Scrollable messages area */}
          <div
            style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {messages.map((msg, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user' ? 'hsl(var(--primary))' : 'rgba(128, 128, 128, 0.12)',
                    color: msg.role === 'user' ? '#ffffff' : 'hsl(var(--text-primary))',
                    fontSize: '0.86rem',
                    lineHeight: '1.4',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-color-glass)',
                    boxShadow: msg.role === 'user' ? '0 4px 12px rgba(76, 140, 252, 0.15)' : 'none'
                  }}
                >
                  {msg.content}
                </div>
                
                {/* Feedback satisfaction block */}
                {msg.role === 'assistant' && msg.showFeedback && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>Was this helpful?</span>
                    <button
                      onClick={() => handleFeedback(index, true)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color-glass)',
                        background: 'rgba(34, 197, 94, 0.08)',
                        color: 'hsl(var(--accent))',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      👍 Yes
                    </button>
                    <button
                      onClick={() => handleFeedback(index, false)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color-glass)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: 'hsl(var(--danger))',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      👎 No
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '12px 16px', borderRadius: '18px', background: 'rgba(128, 128, 128, 0.12)', border: '1px solid var(--border-color-glass)' }}>
                <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: 'hsl(var(--text-muted))', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.4s infinite' }}></span>
                <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: 'hsl(var(--text-muted))', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.4s infinite 0.2s' }}></span>
                <span className="dot" style={{ width: '6px', height: '6px', backgroundColor: 'hsl(var(--text-muted))', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.4s infinite 0.4s' }}></span>
              </div>
            )}

            {/* Quick Actions Suggestions */}
            {messages.length === 1 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Quick Actions:</span>
                {(user?.role === 'audience'
                  ? [
                      "How do I submit an emergency request?",
                      "How do I share feedback on a campaign?",
                      "How do I update my language preferences?"
                    ]
                  : [
                      "How do I create a new campaign?",
                      "What channels does CommAI support?",
                      "How does audience segmentation work?"
                    ]
                ).map((act, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(act)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: 'hsl(var(--primary) / 4%)',
                      border: '1px solid hsl(var(--primary) / 15%)',
                      color: 'hsl(var(--primary))',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      outline: 'none'
                    }}
                    onMouseOver={(e) => e.target.style.background = 'hsl(var(--primary) / 8%)'}
                    onMouseOut={(e) => e.target.style.background = 'hsl(var(--primary) / 4%)'}
                  >
                    💡 {act}
                  </button>
                ))}
              </div>
            )}

            {/* Support query escalation form */}
            {showEscalateForm && (
              <div
                className="glass-card animate-fade-in"
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(239, 68, 68, 0.03)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  marginTop: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--danger))' }}>Escalate Support Request</h4>
                  <button
                    type="button"
                    onClick={() => setShowEscalateForm(false)}
                    style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Cancel
                  </button>
                </div>
                
                {escalationSuccess ? (
                  <div style={{ color: 'hsl(var(--accent))', fontSize: '0.82rem', fontWeight: 600 }}>
                    ✓ Escalation submitted. Campaign managers have been notified!
                  </div>
                ) : (
                  <form onSubmit={handleEscalationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Subject</label>
                      <input
                        type="text"
                        value={escalateSubject}
                        onChange={(e) => setEscalateSubject(e.target.value)}
                        required
                        minLength={5}
                        placeholder="Brief summary of confusion..."
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--input-border)',
                          background: 'var(--input-bg)',
                          color: 'hsl(var(--text-primary))',
                          fontSize: '0.8rem'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Details</label>
                      <textarea
                        value={escalateMessage}
                        onChange={(e) => setEscalateMessage(e.target.value)}
                        required
                        minLength={10}
                        rows={3}
                        placeholder="Provide details about the issue..."
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--input-border)',
                          background: 'var(--input-bg)',
                          color: 'hsl(var(--text-primary))',
                          fontSize: '0.8rem',
                          resize: 'none'
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={escalating}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, hsl(var(--danger)) 0%, #b91c1c 100%)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      {escalating ? 'Submitting query...' : '✉ Send to Campaign Manager'}
                    </button>
                  </form>
                )}
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form at bottom */}
          {!showEscalateForm && (
            <form
              onSubmit={handleSend}
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color-glass)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(8, 10, 15, 0.1)'
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about CommAI..."
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'hsl(var(--text-primary))',
                  fontSize: '0.85rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'hsl(var(--primary))',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  transition: 'background 0.2s',
                  opacity: inputValue.trim() ? 1 : 0.6
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatbotWidget;
