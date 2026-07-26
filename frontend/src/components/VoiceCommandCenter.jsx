import React, { useState, useEffect, useRef } from 'react';

const VoiceCommandCenter = ({ user, backendUrl, token, onExecuteVoiceCommand }) => {
  const isManagerOrAdmin = user && (user.role === 'admin' || user.role === 'campaign_manager');
  if (!isManagerOrAdmin) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('Voice Cockpit Standby');
  // Wake-Word Listener State ("Hey Jarvis" / "Hey Jarvis AI")
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const wakeWordRecognitionRef = useRef(null);

  // Microphone permission popup state after login
  const [showMicBanner, setShowMicBanner] = useState(() => {
    return !sessionStorage.getItem('jarvis_mic_notice_shown');
  });

  // Background Wake-Word listener effect
  useEffect(() => {
    if (!isManagerOrAdmin || !wakeWordEnabled || isOpen) {
      if (wakeWordRecognitionRef.current) {
        try { wakeWordRecognitionRef.current.stop(); } catch (e) {}
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let isActive = true;
    const startWakeWordListener = () => {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = localStorage.getItem('comm_speech_lang') || 'en-IN';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript.toLowerCase();
            if (text.includes('jarvis') || text.includes('hey jarvis') || text.includes('ok jarvis') || text.includes('hello jarvis')) {
              try { recognition.stop(); } catch (e) {}
              // Wake word detected! Open Cockpit hands-free
              setIsOpen(true);
              const greeting = `Hello ${getDisplayName()}! Jarvis activated. I am listening to your command.`;
              setStatusMessage('⚡ Jarvis Activated • Listening...');
              speakAloud(greeting, true);
              break;
            }
          }
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          if (isActive && wakeWordEnabled && !isOpen) {
            setTimeout(() => {
              try { recognition.start(); } catch (e) {}
            }, 1000);
          }
        };

        wakeWordRecognitionRef.current = recognition;
        recognition.start();
      } catch (e) {}
    };

    startWakeWordListener();

    return () => {
      isActive = false;
      if (wakeWordRecognitionRef.current) {
        try { wakeWordRecognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [wakeWordEnabled, isOpen, isManagerOrAdmin]);

  // Active command result state
  const [activeResult, setActiveResult] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  
  // Interactive dropdown states
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedRecipients, setSelectedRecipients] = useState('All Citizens');
  const [locationsList, setLocationsList] = useState(['All Locations', 'Assam', 'Uttar Pradesh', 'Varanasi', 'Delhi', 'Maharashtra', 'Gujarat']);
  const [recipientsList, setRecipientsList] = useState(['All Citizens', 'Farmers', 'Healthcare Workers', 'Local Authorities']);

  const recognitionRef = useRef(null);

  const getDisplayName = () => {
    if (!user) return 'Manager';
    const roleTitle = user.role === 'admin' ? 'Admin' : 'Manager';
    const namePart = user.full_name ? user.full_name.split(' ')[0] : '';
    return namePart ? `${roleTitle} ${namePart}` : roleTitle;
  };

  const ttsTimeoutRef = useRef(null);
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Text-to-Speech playback helper with auto-listen callback
  const speakAloud = (text, autoListenAfter = false) => {
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }

    if (!('speechSynthesis' in window)) {
      if (autoListenAfter && isOpenRef.current) startListening();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      const speechLang = localStorage.getItem('comm_speech_lang') || 'en-IN';
      utterance.lang = speechLang;

      let triggered = false;
      const triggerListenOnce = () => {
        if (!triggered) {
          triggered = true;
          if (ttsTimeoutRef.current) {
            clearTimeout(ttsTimeoutRef.current);
            ttsTimeoutRef.current = null;
          }
          setIsSpeaking(false);
          if (autoListenAfter && isOpenRef.current) {
            setTimeout(() => {
              startListening();
            }, 300);
          }
        }
      };

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => triggerListenOnce();
      utterance.onerror = () => triggerListenOnce();

      // Dynamic safety timeout proportional to text length (never cut off active speech!)
      // Approx 10 characters per second + 4 seconds buffer, min 8 seconds
      const dynamicMs = Math.max(8000, Math.ceil((cleanText.length / 10) * 1000) + 4000);
      ttsTimeoutRef.current = setTimeout(() => {
        triggerListenOnce();
      }, dynamicMs);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis error:', e);
      if (autoListenAfter && isOpenRef.current) startListening();
    }
  };

  const stopSpeaking = () => {
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Toggle Cockpit Modal & Greeting
  const toggleCockpit = () => {
    if (!isOpen) {
      setIsOpen(true);
      const greeting = `Hello ${getDisplayName()}! Jarvis activated. I am listening to your command.`;
      setStatusMessage('⚡ Jarvis Active • Listening...');
      speakAloud(greeting, true);
    } else {
      setIsOpen(false);
      stopSpeaking();
      stopListening();
    }
  };

  // Speech Recognition Start/Stop
  const startListening = () => {
    // Cancel any active SpeechSynthesis so microphone channel is freed up
    stopSpeaking();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      const speechLang = localStorage.getItem('comm_speech_lang') || 'en-IN';
      recognition.lang = speechLang;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('🎙️ Listening to your voice command...');
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        if (event.results[0].isFinal && currentTranscript.trim()) {
          setIsListening(false);
          try { recognition.stop(); } catch(e) {}
          handleProcessVoiceCommand(currentTranscript);
        }
      };

      recognition.onerror = (e) => {
        console.warn("Voice recognition error:", e.error);
        setIsListening(false);
        if (e.error !== 'no-speech') {
          setStatusMessage('Listening paused. Click mic or speak again.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  // Send Spoken Command to Backend
  const handleProcessVoiceCommand = async (commandText) => {
    if (!commandText || !commandText.trim()) return;
    const cleanCmd = commandText.trim().toLowerCase();

    // Check if user is confirming or cancelling an active voice action
    const isTargetedSend = cleanCmd.includes('send to') || cleanCmd.includes('send this to') || cleanCmd.includes('send it to');
    if (pendingConfirmation && !isTargetedSend) {
      const confirmWords = ['yes', 'yeah', 'yep', 'sure', 'confirm', 'proceed', 'go ahead', 'do it', 'ok', 'okay'];
      const exactSendWords = ['send', 'send now', 'send alert', 'send message'];
      const editWords = ['no', 'edit', 'cancel', 'stop', 'modify', 'dont'];

      const isConfirm = confirmWords.some(w => cleanCmd === w || cleanCmd.startsWith(w + ' ') || cleanCmd.endsWith(' ' + w)) || exactSendWords.includes(cleanCmd);
      const isEdit = editWords.some(w => cleanCmd.includes(w));

      if (isConfirm) {
        if (pendingConfirmation.type === 'operator_chat') {
          window.dispatchEvent(new CustomEvent('commai_voice_send_operator_chat'));
          const targetName = pendingConfirmation.data?.target_manager || 'staff';
          const confirmText = `Confirmed ${getDisplayName()}! Message sent to ${targetName}. What would you like to do next?`;
          setStatusMessage(`🚀 Message Sent to ${targetName}`);
          setPendingConfirmation(null);
          speakAloud(confirmText, true);
          return;
        } else {
          handleProceedAction();
          setPendingConfirmation(null);
          return;
        }
      } else if (isEdit) {
        const cancelText = `Got it ${getDisplayName()}. You can edit the text directly on screen. What else can I help you with?`;
        setStatusMessage('✏️ Edit Mode Active');
        setPendingConfirmation(null);
        speakAloud(cancelText, true);
        return;
      }
    }

    // Otherwise, process as a new command with backend AI Intent Engine
    setLoading(true);
    setStatusMessage('🧠 AI Intent Engine analyzing command...');

    try {
      const response = await fetch(`${backendUrl}/api/ai/voice-command`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: commandText })
      });

      if (!response.ok) throw new Error('Voice command processing failed');

      const data = await response.json();
      setActiveResult(data);

      if (data.location_selected) setSelectedLocation(data.location_selected);
      if (data.locations_list && data.locations_list.length > 0) {
        setLocationsList(Array.from(new Set([data.location_selected, ...data.locations_list])));
      }
      if (data.recipients_selected) setSelectedRecipients(data.recipients_selected);
      if (data.recipients_list && data.recipients_list.length > 0) {
        setRecipientsList(Array.from(new Set([data.recipients_selected, ...data.recipients_list])));
      }

      setStatusMessage(`✅ Action Identified: ${data.action.replace('_', ' ').toUpperCase()}`);

      // Immediately execute action and redirect directly to UI page (WITHOUT closing Cockpit!)
      if (onExecuteVoiceCommand) {
        onExecuteVoiceCommand(data);
      }

      // Check if action requires voice confirmation (like sending chat msg or broadcasting campaign)
      if (data.requires_confirmation || ['create_campaign', 'emergency_broadcast', 'send_alert'].includes(data.action)) {
        const confType = (data.navigation_target === 'operator_chat') ? 'operator_chat' : 'campaign';
        setPendingConfirmation({ type: confType, data });
      } else {
        setPendingConfirmation(null);
      }

      // Speak back response to manager and auto-open microphone for next command / confirmation!
      if (data.spoken_response) {
        speakAloud(data.spoken_response, true);
      }
    } catch (err) {
      console.error('Voice Command Error:', err);
      const errReply = `Sorry ${getDisplayName()}, I couldn't process that command. Please try speaking again.`;
      setStatusMessage('⚠️ Processing Error');
      speakAloud(errReply, true);
    } finally {
      setLoading(false);
    }
  };

  // Manager Proceed / Confirm Action
  const handleProceedAction = () => {
    if (!activeResult) return;
    stopSpeaking();

    const updatedResult = {
      ...activeResult,
      location_selected: selectedLocation,
      recipients_selected: selectedRecipients,
      user_confirmed: true
    };

    const confirmSpeech = `Proceeding ${getDisplayName()}! Executing ${updatedResult.title || 'campaign'} for ${selectedLocation} targeting ${selectedRecipients}.`;
    speakAloud(confirmSpeech);

    if (onExecuteVoiceCommand) {
      onExecuteVoiceCommand(updatedResult);
    }

    setTimeout(() => {
      setIsOpen(false);
    }, 1200);
  };

  return (
    <>
      {/* Post-Login Microphone Permission Toast Banner */}
      {showMicBanner && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 99999,
            width: '380px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: 'var(--font-body)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🎙️</span>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Jarvis AI Voice Cockpit
              </span>
            </div>
            <button
              onClick={() => {
                setShowMicBanner(false);
                sessionStorage.setItem('jarvis_mic_notice_shown', 'true');
              }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ✕
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.4' }}>
            Make sure your <strong>microphone permission is allowed</strong> in the browser to use <strong>Jarvis AI</strong> hands-free (say <em>"Hey Jarvis"</em> anytime)!
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={() => {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                  navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(() => {
                      alert("Microphone permission granted! Jarvis AI is active and ready.");
                      setShowMicBanner(false);
                      sessionStorage.setItem('jarvis_mic_notice_shown', 'true');
                    })
                    .catch(() => {
                      alert("Please allow microphone access in your browser location settings.");
                    });
                } else {
                  alert("Microphone access is managed in your browser settings.");
                  setShowMicBanner(false);
                  sessionStorage.setItem('jarvis_mic_notice_shown', 'true');
                }
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              🎙️ Enable & Test Mic
            </button>

            <button
              onClick={() => {
                setShowMicBanner(false);
                sessionStorage.setItem('jarvis_mic_notice_shown', 'true');
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: '24px', right: '92px', zIndex: 1000, fontFamily: 'var(--font-body)' }}>
      {/* Dedicated Floating Voice Launcher Button */}
      <button
        onClick={toggleCockpit}
        style={{
          height: '56px',
          padding: '0 20px',
          borderRadius: '28px',
          background: isOpen 
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
            : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: isListening 
            ? '0 0 25px rgba(239, 68, 68, 0.8)' 
            : '0 8px 32px rgba(139, 92, 246, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'white',
          fontWeight: 700,
          fontSize: '0.9rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'scale(1.02)' : 'scale(1)',
          animation: isListening ? 'pulseGlowing 1.5s infinite ease-in-out' : 'none'
        }}
        title="Open AI Voice Command Cockpit (Admin / Manager)"
      >
        <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}>
          {isListening ? '🎙️' : '⚡'}
        </span>
        <span>{isOpen ? 'Close Cockpit' : 'Voice Cockpit'}</span>
        <span 
          style={{ 
            background: 'rgba(255, 255, 255, 0.25)', 
            padding: '2px 8px', 
            borderRadius: '10px', 
            fontSize: '0.68rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em' 
          }}
        >
          Jarvis AI
        </span>
      </button>

      {/* Voice Cockpit Modal Card */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '72px',
            right: '-68px',
            width: '420px',
            maxHeight: '620px',
            borderRadius: '24px',
            background: 'rgba(10, 14, 26, 0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'cockpitSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 20px',
              background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  boxShadow: '0 0 12px rgba(139, 92, 246, 0.5)'
                }}
              >
                🎙️
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
                  CommAI Voice Cockpit
                </h4>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: wakeWordEnabled ? '#22c55e' : '#64748b' }}></span>
                  {wakeWordEnabled ? 'Wake-Word Active ("Hey Jarvis")' : 'Manager Mode • Manual Mic'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                style={{
                  background: wakeWordEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  border: wakeWordEnabled ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: wakeWordEnabled ? '#4ade80' : '#94a3b8',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Toggle Background Wake-Word Detection ('Hey Jarvis')"
              >
                {wakeWordEnabled ? '👂 Wake-Word: ON' : '🔇 Wake-Word: OFF'}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#94a3b8',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            
            {/* Status & Speech Visualization */}
            <div 
              style={{ 
                background: 'rgba(255, 255, 255, 0.04)', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                borderRadius: '16px', 
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: '#cbd5e1' }}>
                <span>{statusMessage}</span>
                {isSpeaking && (
                  <span style={{ color: '#8b5cf6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔊 Speaking...
                  </span>
                )}
              </div>

              {/* Sound Equalizer Bars */}
              {(isListening || isSpeaking) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '24px', margin: '4px 0' }}>
                  {[0.1, 0.3, 0.2, 0.5, 0.2, 0.4, 0.1].map((delay, idx) => (
                    <span
                      key={idx}
                      style={{
                        width: '4px',
                        height: '100%',
                        borderRadius: '2px',
                        background: isListening ? '#ef4444' : '#8b5cf6',
                        animation: `equalizeBar 0.8s infinite ease-in-out ${delay}s`
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Transcript Display */}
              {transcript && (
                <div style={{ fontSize: '0.88rem', color: '#f1f5f9', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                  "{transcript}"
                </div>
              )}
            </div>

            {/* Mic Controls */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {isListening ? (
                <button
                  onClick={stopListening}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
                    animation: 'pulseGlowing 1.5s infinite ease-in-out'
                  }}
                >
                  <span>🛑 Stop Recording</span>
                </button>
              ) : (
                <button
                  onClick={startListening}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                    color: 'white',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>🎙️ Start Recording Command</span>
                </button>
              )}

              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="Mute AI Speech"
                >
                  🔇 Mute
                </button>
              )}
            </div>

            {/* Interactive Command & Option Review Card */}
            {activeResult && (
              <div
                style={{
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  animation: 'fadeIn 0.3s ease-in-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ⚡ AI-Generated Campaign
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                    Ready for Review
                  </span>
                </div>

                <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                  {activeResult.title || 'Voice Action Prepared'}
                </h5>

                {activeResult.objective && (
                  <div style={{ fontSize: '0.8rem', color: '#a5b4fc', fontStyle: 'italic' }}>
                    🎯 {activeResult.objective}
                  </div>
                )}

                {activeResult.subject && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>📧 Subject Line:</span>
                    <div style={{ fontSize: '0.82rem', color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '8px', borderLeft: '3px solid #8b5cf6' }}>
                      {activeResult.subject}
                    </div>
                  </div>
                )}

                {(activeResult.body || activeResult.description) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>📝 Message Body:</span>
                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.5', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', borderLeft: '3px solid #3b82f6', whiteSpace: 'pre-wrap' }}>
                      {activeResult.body || activeResult.description}
                    </div>
                  </div>
                )}

                {/* Interactive Dropdown: Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📍 Target Location:
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {locationsList.map((loc, idx) => (
                      <option key={idx} value={loc} style={{ background: '#0f172a', color: '#f8fafc' }}>
                        {loc === selectedLocation ? `📍 ${loc} (Pre-selected from Voice)` : loc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Interactive Dropdown: Recipients */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    👥 Target Recipients:
                  </label>
                  <select
                    value={selectedRecipients}
                    onChange={(e) => setSelectedRecipients(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {recipientsList.map((rec, idx) => (
                      <option key={idx} value={rec} style={{ background: '#0f172a', color: '#f8fafc' }}>
                        {rec === selectedRecipients ? `👥 ${rec} (Pre-selected from Voice)` : rec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Confirmation / Proceed Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    onClick={handleProceedAction}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: 'white',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    🚀 Proceed / Confirm Broadcast
                  </button>

                  <button
                    onClick={() => {
                      stopSpeaking();
                      const editResult = {
                        ...activeResult,
                        location_selected: selectedLocation,
                        recipients_selected: selectedRecipients,
                        navigation_target: 'campaigns',
                        open_wizard: true
                      };
                      if (onExecuteVoiceCommand) {
                        onExecuteVoiceCommand(editResult);
                      }
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Edit Wizard
                  </button>
                </div>
              </div>
            )}

            {/* Manager Voice Command Sample Prompts */}
            {!activeResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '12px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#4ade80' }}>
                  <span style={{ fontSize: '1.1rem' }}>🎙️</span>
                  <span><strong>Hands-Free Wake Word Active:</strong> Just say <em>"Hey Jarvis"</em> or <em>"Hey Jarvis AI"</em> out loud anytime to open the Cockpit!</span>
                </div>

                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginTop: '4px' }}>
                  💡 Try Spoken Manager Commands:
                </span>
                {[
                  "Emergency! Flash flood warning for Assam, send immediately to all audiences",
                  "Create an agricultural water drive campaign for Uttar Pradesh farmers",
                  "Show me all pending approvals",
                  "Find farmers in Gujarat above age 45"
                ].map((samplePrompt, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => {
                      setTranscript(samplePrompt);
                      handleProcessVoiceCommand(samplePrompt);
                    }}
                    style={{
                      textAlign: 'left',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.color = '#a78bfa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.color = '#cbd5e1';
                    }}
                  >
                    🗣️ "{samplePrompt}"
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseGlowing {
          0%, 100% { boxShadow: 0 0 20px rgba(239, 68, 68, 0.6); }
          50% { boxShadow: 0 0 35px rgba(239, 68, 68, 0.9); }
        }
        @keyframes cockpitSlide {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes equalizeBar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
    </>
  );
};

export default VoiceCommandCenter;
