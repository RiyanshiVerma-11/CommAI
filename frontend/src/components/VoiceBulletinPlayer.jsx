import React, { useState, useEffect, useRef } from 'react';
import GlassCard from './GlassCard';

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
  campaignId,
  userPreferredLang = 'Hindi',
  backendUrl = 'http://127.0.0.1:8000',
  compact = false,
  title = 'Audio Bulletin'
}) => {
  // Resolve default preferred language
  const getInitialLanguage = () => {
    if (!userPreferredLang) return INDIC_LANGUAGES[0]; // Hindi default
    const cleanPref = String(userPreferredLang).toLowerCase().trim();
    const match = INDIC_LANGUAGES.find(
      l => l.name.toLowerCase() === cleanPref || l.code.toLowerCase() === cleanPref || l.native.toLowerCase() === cleanPref
    );
    return match || INDIC_LANGUAGES[0];
  };

  const [selectedLang, setSelectedLang] = useState(getInitialLanguage());
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1.0); // 0.75x, 1.0x, 1.25x
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [translatedText, setTranslatedText] = useState('');

  const audioRef = useRef(null);

  useEffect(() => {
    // Update initial selection if userPreferredLang changes
    setSelectedLang(getInitialLanguage());
  }, [userPreferredLang]);

  // Handle Play/Pause
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
        setAudioUrl(`${backendUrl}${data.audio_url}`);
        setTranslatedText(data.translated_text || text);
        
        if (audioRef.current) {
          audioRef.current.src = `${backendUrl}${data.audio_url}`;
          audioRef.current.playbackRate = speed;
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } else {
        // Fallback to Web Speech API client-side synthesis
        playBrowserSpeechFallback(text, langToPlay);
      }
    } catch (err) {
      console.warn('Backend audio synthesis error, using browser TTS fallback:', err);
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

  const filteredLanguages = INDIC_LANGUAGES.filter(
    l => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.native.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (timeInSec) => {
    if (!timeInSec || isNaN(timeInSec)) return '0:00';
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={`voice-bulletin-container ${compact ? 'compact' : ''}`} style={{ marginTop: '12px', marginBottom: '12px' }}>
      <audio
        ref={audioRef}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => setIsPlaying(false)}
      />

      <GlassCard className="voice-player-glass" style={{ padding: compact ? '12px' : '16px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          
          {/* PRIMARY BUTTON: Read aloud in [Language] */}
          <button
            onClick={() => handlePlayVoice(selectedLang)}
            disabled={loading}
            className="btn-play-voice-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: compact ? '8px 14px' : '10px 18px',
              borderRadius: '30px',
              border: 'none',
              background: isPlaying ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: compact ? '0.85rem' : '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              transition: 'all 0.25s ease'
            }}
          >
            {loading ? (
              <>⏳ Synthesizing Audio...</>
            ) : isPlaying ? (
              <>⏸️ Pause Voice Bulletin</>
            ) : (
              <>🔊 Read aloud in {selectedLang.name} ({selectedLang.native})</>
            )}
          </button>

          {/* SECONDARY DROPDOWN: Read aloud in (Select a language) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="btn-select-lang-dropdown"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: compact ? '6px 12px' : '8px 14px',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#e2e8f0',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              🌐 Read aloud in (Select Language) ▾
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  zIndex: 999,
                  width: '260px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '14px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                  padding: '10px'
                }}
              >
                <input
                  type="text"
                  placeholder="Search 23 languages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handlePlayVoice(lang)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: selectedLang.code === lang.code ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                        color: selectedLang.code === lang.code ? '#818cf8' : '#e2e8f0',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span>{lang.flag} {lang.name}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{lang.native}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PLAYER CONTROLS & WAVEFORM VISUALIZER */}
        {(isPlaying || audioUrl || duration > 0) && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              
              {/* Animated Equalizer Visualizer */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '18px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: '4px',
                      height: isPlaying ? `${Math.floor(Math.random() * 14) + 4}px` : '4px',
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
                style={{ flex: 1, accentColor: '#818cf8', cursor: 'pointer' }}
              />

              {/* Duration Counter */}
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Playback Speed Controls */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '12px' }}>
                {[0.75, 1.0, 1.25].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => handleSpeedChange(spd)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: speed === spd ? '#6366f1' : 'transparent',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {translatedText && selectedLang.code !== 'en' && (
              <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#cbd5e1', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px' }}>
                📖 <strong>Spoken Translation ({selectedLang.native}):</strong> "{translatedText}"
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default VoiceBulletinPlayer;
