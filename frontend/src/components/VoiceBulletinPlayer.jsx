import React, { useState, useEffect, useRef } from 'react';

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

const VoiceBulletinPlayer = ({
  text,
  userPreferredLang = 'Hindi',
  backendUrl = 'http://127.0.0.1:8000',
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
  const [searchTerm, setSearchTerm] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);

  const audioRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedLang(getInitialLanguage());
  }, [userPreferredLang]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePlayVoice = async (langToPlay = selectedLang) => {
    if (isPlaying && audioRef.current && langToPlay.code === selectedLang.code) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    setLoading(true);
    setSelectedLang(langToPlay);
    setDropdownOpen(false);

    try {
      const response = await fetch(`${backendUrl}/api/voice/synthesize`, {
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
        const fullUrl = `${backendUrl}${data.audio_url}`;
        setAudioUrl(fullUrl);
        setTranslatedText(data.translated_text || text);
        
        if (audioRef.current) {
          audioRef.current.src = fullUrl;
          audioRef.current.playbackRate = speed;
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } else {
        playBrowserSpeechFallback(text, langToPlay);
      }
    } catch (err) {
      console.warn('Backend voice synth failed, using browser fallback:', err);
      playBrowserSpeechFallback(text, langToPlay);
    } finally {
      setLoading(false);
    }
  };

  const playBrowserSpeechFallback = (bulletinText, langObj) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(bulletinText);
      utterance.lang = langObj.code === 'hi' ? 'hi-IN' : langObj.code === 'en' ? 'en-IN' : langObj.code;
      utterance.rate = speed;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
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
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredLanguages = INDIC_LANGUAGES.filter(
    l => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.native.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="voice-player-wrapper" style={{ marginTop: '10px', marginBottom: '10px' }}>
      <audio
        ref={audioRef}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Main Glass Player Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: compact ? '14px' : '18px',
        padding: compact ? '10px 14px' : '14px 18px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        position: 'relative'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} ref={dropdownRef}>
            
            {/* LANGUAGE SELECTOR PILL BUTTON */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '24px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#f1f5f9',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
            >
              <span>{selectedLang.flag}</span>
              <span>{selectedLang.name} ({selectedLang.native})</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▼</span>
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

            {/* LANGUAGE SELECTION POPOVER MODAL */}
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '105%',
                right: 0,
                zIndex: 9999,
                width: '320px',
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
                padding: '14px',
                backdropFilter: 'blur(20px)',
                animation: 'animate-slide-up 0.2s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🌐 Select Audio Language (23)
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
                  placeholder="Search Indic languages..."
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
              </div>
            )}

          </div>

        </div>

        {/* PROGRESS SCRUBBER & ANIMATED EQUALIZER */}
        {(isPlaying || audioUrl || duration > 0) && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              
              {/* Equalizer Animation */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '16px', flexShrink: 0 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: '3px',
                      height: isPlaying ? `${Math.floor(Math.random() * 12) + 4}px` : '4px',
                      background: '#818cf8',
                      borderRadius: '2px',
                      transition: 'height 0.15s ease'
                    }}
                  />
                ))}
              </div>

              {/* Progress Slider */}
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                style={{ flex: 1, accentColor: '#818cf8', cursor: 'pointer', height: '4px' }}
              />

              {/* Time Display */}
              <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

            </div>

            {translatedText && selectedLang.code !== 'en' && (
              <div style={{
                marginTop: '8px',
                fontSize: '0.8rem',
                color: '#cbd5e1',
                background: 'rgba(0,0,0,0.25)',
                padding: '6px 12px',
                borderRadius: '8px',
                borderLeft: '3px solid #818cf8'
              }}>
                📖 <strong>Spoken Speech ({selectedLang.native}):</strong> "{translatedText}"
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default VoiceBulletinPlayer;
