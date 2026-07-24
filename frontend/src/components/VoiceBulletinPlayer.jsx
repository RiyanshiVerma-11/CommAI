import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const INDIC_LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇮🇳' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली', flag: '🇮🇳' },
  { code: 'sat', name: 'Santali', native: 'संथाली', flag: '🇮🇳' },
  { code: 'ks', name: 'Kashmiri', native: 'कॉशुर', flag: '🇮🇳' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', flag: '🇮🇳' },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी', flag: '🇮🇳' },
  { code: 'sd', name: 'Sindhi', native: 'सिंधी', flag: '🇮🇳' },
  { code: 'doi', name: 'Dogri', native: 'डोगरी', flag: '🇮🇳' },
  { code: 'mni', name: 'Manipuri', native: 'मणिपुरी', flag: '🇮🇳' },
  { code: 'brx', name: 'Bodo', native: 'बोडो', flag: '🇮🇳' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', flag: '🇮🇳' },
];

const resolveApiBase = (providedUrl) => {
  if (providedUrl && providedUrl !== 'http://127.0.0.1:8000') return providedUrl;
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  return 'http://localhost:8001';
};

const VoiceBulletinPlayer = ({
  text,
  userPreferredLang = 'Hindi',
  backendUrl,
  compact = false,
}) => {
  const getInitialLanguage = () => {
    if (!userPreferredLang) return INDIC_LANGUAGES[0];
    const cleanPref = String(userPreferredLang).toLowerCase().trim();
    return INDIC_LANGUAGES.find(
      l => l.name.toLowerCase() === cleanPref || l.code.toLowerCase() === cleanPref || l.native.toLowerCase() === cleanPref
    ) || INDIC_LANGUAGES[0];
  };

  const [selectedLang, setSelectedLang] = useState(getInitialLanguage());
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);

  const audioRef = useRef(null);
  const dropdownRef = useRef(null);
  const speechTimerRef = useRef(null);

  const userHasPickedLang = useRef(false);

  useEffect(() => {
    if (!userHasPickedLang.current) {
      setSelectedLang(getInitialLanguage());
    }
  }, [userPreferredLang]);

  const updateDropdownPosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const width = 320;
      let left = rect.right - width;
      if (left < 10) left = 10;
      if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;
      let top = rect.bottom + 6;
      setDropdownCoords({ top, left });
    }
  };

  useEffect(() => {
    if (dropdownOpen) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
    }
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        !e.target.closest?.('.voice-lang-portal-modal')
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (speechTimerRef.current) clearInterval(speechTimerRef.current);
    };
  }, []);

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechTimerRef.current) {
      clearInterval(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handlePlayVoice = async (langToPlay = selectedLang) => {
    // If clicking same language while currently playing, stop & pause
    if (isPlaying && langToPlay.code === selectedLang.code) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setLoading(true);
    setTranslatedText(''); // Clear previous language text
    userHasPickedLang.current = true;
    setSelectedLang(langToPlay);
    setDropdownOpen(false);

    const apiBase = resolveApiBase(backendUrl);

    try {
      const response = await fetch(`${apiBase}/api/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          language: langToPlay.code,
          slow: speed < 1.0,
          source_lang: 'en'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const fullUrl = `${apiBase}${data.audio_url}?t=${Date.now()}`;
        setAudioUrl(fullUrl);
        const newText = data.translated_text || text;
        setTranslatedText(newText);
        
        if (audioRef.current) {
          audioRef.current.src = fullUrl;
          audioRef.current.playbackRate = speed;
          audioRef.current.load();
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (pErr) {
            console.warn('Audio playback error:', pErr);
            setIsPlaying(false);
          } finally {
            setLoading(false);
          }
          return;
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('Voice synth backend error:', errData);
      }
    } catch (err) {
      console.warn('Backend voice synth failed, using browser voice fallback:', err);
    }

    // Fallback: Web Speech Synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      let textToSpeak = translatedText || text;

      if (langToPlay.code !== 'en' && (textToSpeak === text || !translatedText)) {
        try {
          const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langToPlay.code}&dt=t&q=${encodeURIComponent(text)}`;
          const res = await fetch(gtxUrl);
          if (res.ok) {
            const data = await res.json();
            const parts = data[0]?.map(p => p[0]).filter(Boolean);
            if (parts && parts.length > 0) {
              textToSpeak = parts.join('');
              setTranslatedText(textToSpeak);
            }
          }
        } catch (e) {
          console.warn('Browser fallback translation failed:', e);
        }
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = langToPlay.code === 'hi' ? 'hi-IN' : langToPlay.code === 'en' ? 'en-IN' : langToPlay.code;
      utterance.rate = speed;

      const voices = window.speechSynthesis.getVoices();
      const cleanCode = langToPlay.code.toLowerCase();
      const cleanName = langToPlay.name.toLowerCase();

      const matchingVoice = voices.find(v => 
        v.lang.toLowerCase().startsWith(cleanCode) || 
        v.name.toLowerCase().includes(cleanName)
      );

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      const wordCount = textToSpeak.split(/\s+/).length;
      const estimatedDuration = Math.max(3, Math.ceil(wordCount / (2.2 * speed)));
      setDuration(estimatedDuration);
      setCurrentTime(0);

      if (speechTimerRef.current) clearInterval(speechTimerRef.current);
      const startTime = Date.now();
      speechTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= estimatedDuration) {
          clearInterval(speechTimerRef.current);
          speechTimerRef.current = null;
          setCurrentTime(estimatedDuration);
        } else {
          setCurrentTime(elapsed);
        }
      }, 250);

      utterance.onend = () => stopAllAudio();
      utterance.onerror = () => stopAllAudio();

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setLoading(false);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredLanguages = INDIC_LANGUAGES.filter(
    l => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.native.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="voice-player-wrapper" style={{ marginTop: '10px', marginBottom: '10px', position: 'relative', zIndex: dropdownOpen ? 99999 : 'auto' }}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onDurationChange={handleAudioLoadedMetadata}
        onCanPlay={handleAudioLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          if (audioRef.current && !audioRef.current.seeking) {
            setIsPlaying(false);
          }
        }}
        onError={() => stopAllAudio()}
        onEnded={stopAllAudio}
      />

      {/* Main Glass Player Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(30, 41, 59, 0.88) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: compact ? '14px' : '18px',
        padding: compact ? '10px 14px' : '14px 18px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        zIndex: dropdownOpen ? 99999 : 1
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Left Group: Circular Play Button + Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            {/* HERO PLAY/PAUSE CIRCULAR BUTTON */}
            <button
              onClick={() => handlePlayVoice(selectedLang)}
              disabled={loading}
              title={isPlaying ? "Pause voice bulletin" : `Listen bulletin in ${selectedLang.name}`}
              style={{
                width: compact ? '36px' : '42px',
                height: compact ? '36px' : '42px',
                borderRadius: '50%',
                border: 'none',
                background: isPlaying 
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                  : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: isPlaying 
                  ? '0 0 16px rgba(239, 68, 68, 0.5)' 
                  : '0 4px 16px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0
              }}
            >
              {loading ? (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
              ) : isPlaying ? (
                <span style={{ fontSize: '1.1rem' }}>⏸</span>
              ) : (
                <span style={{ fontSize: '1.1rem', marginLeft: '2px' }}>▶</span>
              )}
            </button>

            {/* Title & Badge */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: compact ? '0.88rem' : '0.96rem', color: '#f8fafc' }}>
                  🔊 Listen Bulletin
                </span>
                {isPlaying && (
                  <span style={{
                    fontSize: '0.68rem',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    PLAYING
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Voice synthesis powered by Indic AI Engine
              </div>
            </div>

          </div>

          {/* Right Group: Language Selector Pill + Speed Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', position: 'relative' }} ref={dropdownRef}>
            
            {/* LANGUAGE SELECTOR PILL BUTTON */}
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                updateDropdownPosition();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '24px',
                background: dropdownOpen ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                border: dropdownOpen ? '1.5px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.18)',
                color: '#f1f5f9',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'}
              onMouseLeave={(e) => e.currentTarget.style.background = dropdownOpen ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)'}
            >
              <span>{selectedLang.flag}</span>
              <span>{selectedLang.name} ({selectedLang.native})</span>
              <span style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 700 }}>▼ Select Language</span>
            </button>


            {/* SPEED CONTROLS PILL */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '3px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              {[0.75, 1.0, 1.25].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '14px',
                    border: 'none',
                    background: speed === s ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                    color: speed === s ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* LANGUAGE SELECTION POPOVER PORTAL */}
            {dropdownOpen && ReactDOM.createPortal(
              <div
                className="voice-lang-portal-modal"
                style={{
                  position: 'fixed',
                  top: `${dropdownCoords.top}px`,
                  left: `${dropdownCoords.left}px`,
                  zIndex: 99999999,
                  width: '320px',
                  background: '#0f172a',
                  border: '1.5px solid #6366f1',
                  borderRadius: '16px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 30px rgba(99, 102, 241, 0.5)',
                  padding: '14px',
                  backdropFilter: 'blur(24px)',
                  animation: 'animate-slide-up 0.2s ease-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🌐 Select Any Language (23)
                  </span>
                  <button
                    onClick={() => setDropdownOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Search Bar */}
                <input
                  type="text"
                  placeholder="Search 23 Indic languages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    marginBottom: '10px',
                    outline: 'none'
                  }}
                />

                {/* 23 Languages Grid */}
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px'
                }}>
                  {filteredLanguages.map((lang) => {
                    const isSelected = selectedLang.code === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => handlePlayVoice(lang)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #818cf8' : '1px solid transparent',
                          background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? '#818cf8' : '#cbd5e1',
                          fontSize: '0.78rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>{lang.flag}</span>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <div>{lang.name}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{lang.native}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body
            )}

          </div>

        </div>

        {/* SPOKEN SCRIPT BANNER & EQUALIZER */}
        {(translatedText || text) && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#ffffff',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.2) 100%)',
              padding: '10px 14px',
              borderRadius: '10px',
              borderLeft: '4px solid #818cf8',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              lineHeight: '1.5',
              letterSpacing: '0.01em'
            }}>
              {/* Equalizer Animation */}
              {isPlaying && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '16px', flexShrink: 0 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '3px',
                        height: `${Math.floor(Math.random() * 12) + 4}px`,
                        background: '#818cf8',
                        borderRadius: '2px',
                        transition: 'height 0.15s ease'
                      }}
                    />
                  ))}
                </div>
              )}
              <div>
                📖 <strong>Spoken Speech ({selectedLang.native || selectedLang.name}):</strong> <span style={{ fontWeight: 800, color: '#f8fafc' }}>"{translatedText || text}"</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default VoiceBulletinPlayer;


