import React, { useState } from 'react';
import GlassCard from '../components/GlassCard';

const Login = ({ onLoginSuccess, backendUrl, onBackToLanding, initialRegister }) => {
  const [isRegister, setIsRegister] = useState(initialRegister || false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Audience-specific profile details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [stateName, setStateName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [cityName, setCityName] = useState('');
  const [preferredChannels, setPreferredChannels] = useState(['email']);

  const [selectedRole, setSelectedRole] = useState('audience');
  const [organization, setOrganization] = useState('');
  const [designation, setDesignation] = useState('');
  const [preferredLangs, setPreferredLangs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [activeTab, setActiveTab] = useState('password'); // 'password' or 'otp'

  const demoAccounts = [
    { label: '🛡️ Admin Account', email: 'admin@comm.ai', password: 'AdminPassword123!' },
    { label: '💼 Campaign Manager', email: 'manager@comm.ai', password: 'ManagerPassword123!' },
    { label: '📣 Audience Member', email: 'audience@comm.ai', password: 'AudiencePass123!' }
  ];

  const handlePreFill = (demo) => {
    setIsRegister(false);
    setActiveTab('password');
    setOtpMode(false);
    setEmail(demo.email);
    setPassword(demo.password);
    setError('');
  };

  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password credentials');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      onLoginSuccess(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (selectedRole === 'audience') {
      if (!firstName || !lastName || !email || !password || !phone) {
        setError('First Name, Last Name, Email, Password, and Phone number are required');
        return;
      }
    } else {
      if (!email || !password || !fullName) {
        setError('Full Name, Email, and Password are required');
        return;
      }
    }
    setError('');
    setLoading(true);

    try {
      const payload = {
        email,
        password,
        full_name: selectedRole === 'audience' ? `${firstName} ${lastName}` : fullName,
        role: selectedRole,
        organization: selectedRole === 'audience' ? null : (organization || null),
        designation: selectedRole === 'audience' ? null : (designation || null),
        preferred_languages: preferredLangs,
        
        // Audience fields
        first_name: selectedRole === 'audience' ? firstName : null,
        last_name: selectedRole === 'audience' ? lastName : null,
        phone: selectedRole === 'audience' ? phone : null,
        occupation: selectedRole === 'audience' ? (occupation || 'General') : null,
        age: selectedRole === 'audience' ? (parseInt(age) || null) : null,
        gender: selectedRole === 'audience' ? gender : null,
        state: selectedRole === 'audience' ? stateName : null,
        district: selectedRole === 'audience' ? districtName : null,
        city: selectedRole === 'audience' ? cityName : null,
        preferred_channels: selectedRole === 'audience' ? preferredChannels : []
      };

      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      // Automatically login on successful sign up
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const loginResponse = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      const loginData = await loginResponse.json();
      if (!loginResponse.ok) {
        throw new Error(loginData.detail || 'Login auto-trigger failed');
      }

      onLoginSuccess(loginData.access_token, loginData.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e) => {
    if (e) e.preventDefault();
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/auth/request-otp?email=${encodeURIComponent(email)}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'OTP Request failed');
      }

      setOtpMode(true);
      if (data.mocked && data.otp) {
        setOtpMessage(`${data.message}. (For testing, enter OTP code: ${data.otp})`);
      } else {
        setOtpMessage(`${data.message}. Check your email box for the verification code.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) {
      setError('Please enter the verification OTP code');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'OTP verification failed');
      }

      onLoginSuccess(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100vw',
      height: '100vh',
      padding: '24px',
      overflowY: 'auto'
    }}>
      <GlassCard className="animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '36px', margin: 'auto' }}>
        {onBackToLanding && (
          <div style={{ marginBottom: '24px', textAlign: 'left', width: '100%' }}>
            <span 
              onClick={onBackToLanding}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.88rem',
                color: 'hsl(var(--text-secondary))',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.target.style.color = 'hsl(var(--primary))'}
              onMouseLeave={(e) => e.target.style.color = 'hsl(var(--text-secondary))'}
            >
              ← Back to Overview
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)', flexShrink: 0 }}>
              <img src="/logo.jpeg" alt="CommAI Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{
              fontSize: '2.3rem',
              fontWeight: '800',
              fontFamily: 'var(--font-display)',
              color: 'hsl(var(--text-primary))',
              letterSpacing: '-0.03em'
            }}>
              CommAI
            </span>
          </div>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.95rem', fontWeight: '500' }}>
            Multilingual Mass Campaigns Gateway
          </p>
        </div>

        {/* Custom Authentication Selector Tabs */}
        {!isRegister && !otpMode && (
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '28px'
          }}>
            <button
              onClick={() => { setActiveTab('password'); setError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                background: activeTab === 'password' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                color: activeTab === 'password' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Password Sign In
            </button>
            <button
              onClick={() => { setActiveTab('otp'); setError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                background: activeTab === 'otp' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                color: activeTab === 'otp' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              OTP Code Login
            </button>
          </div>
        )}

        {error && (
          <div className="glass-card danger-text animate-fade-in" style={{ padding: '12px 16px', marginBottom: '24px', fontSize: '0.88rem', background: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px' }}>
            <span style={{ marginRight: '6px' }}>⚠️</span> {error}
          </div>
        )}

        {otpMessage && (
          <div className="glass-card success-text animate-fade-in" style={{ padding: '12px 16px', marginBottom: '24px', fontSize: '0.88rem', background: 'rgba(34, 197, 94, 0.06)', borderColor: 'rgba(34, 197, 94, 0.15)', borderRadius: '12px' }}>
            <span style={{ marginRight: '6px' }}>ℹ️</span> {otpMessage}
          </div>
        )}

        {otpMode ? (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600' }}>OTP Verification Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                disabled={loading}
                autoFocus
                style={{ width: '100%', textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.25rem', fontWeight: 'bold' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, padding: '12px' }} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP Code'}
              </button>
              <button type="button" className="btn btn-dark" style={{ padding: '12px' }} onClick={() => setOtpMode(false)} disabled={loading}>
                Cancel
              </button>
            </div>
          </form>
        ) : isRegister ? (
          <form onSubmit={handleRegister}>
            {selectedRole === 'audience' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>First Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Ramesh"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={loading}
                      required
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Last Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Kumar"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={loading}
                      required
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Email Address *</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="ramesh@gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Phone Number *</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={loading}
                      required
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    style={{ width: '100%', fontSize: '0.95rem' }}
                  />
                </div>

                {/* Additional profile info for segmentation */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Occupation</label>
                    <select
                      className="form-control"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    >
                      <option value="">Select Occupation</option>
                      <option value="Farmer">Farmer 🌾</option>
                      <option value="Student">Student 🎓</option>
                      <option value="Healthcare Worker">Healthcare Worker 🏥</option>
                      <option value="Teacher">Teacher 🏫</option>
                      <option value="Business Owner">Business Owner 💼</option>
                      <option value="Other">Other 🧑‍💻</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Age</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 25"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Gender</label>
                    <select
                      className="form-control"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>State</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Bihar"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>District</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Patna"
                      value={districtName}
                      onChange={(e) => setDistrictName(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>City</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Patna"
                      value={cityName}
                      onChange={(e) => setCityName(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>Preferred Delivery Channels</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                    {['email', 'sms', 'whatsapp', 'push', 'website'].map(channel => {
                      const isSelected = preferredChannels.includes(channel);
                      return (
                        <div
                          key={channel}
                          onClick={() => {
                            if (isSelected) {
                              setPreferredChannels(preferredChannels.filter(c => c !== channel));
                            } else {
                              setPreferredChannels([...preferredChannels, channel]);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: `1.5px solid ${isSelected ? 'hsl(var(--primary))' : 'rgba(255, 255, 255, 0.05)'}`,
                            background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            color: isSelected ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontWeight: isSelected ? '700' : '500',
                            textTransform: 'uppercase',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {channel}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ramesh Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    required
                    style={{ width: '100%', fontSize: '0.95rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="ramesh@gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    style={{ width: '100%', fontSize: '0.95rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '600' }}>Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    style={{ width: '100%', fontSize: '0.95rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Organization</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Health Ministry"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600' }}>Designation</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Director"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600' }}>Platform Role *</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <div 
                  onClick={() => { setSelectedRole('audience'); setPreferredLangs([]); }}
                  style={{
                    flex: 1,
                    padding: '14px 10px',
                    borderRadius: '12px',
                    border: `1.5px solid ${selectedRole === 'audience' ? 'hsl(var(--accent))' : 'rgba(255,255,255,0.06)'}`,
                    background: selectedRole === 'audience' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.02)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>📣</div>
                  <div style={{ fontWeight: '700', fontSize: '0.84rem', color: selectedRole === 'audience' ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))' }}>Audience</div>
                  <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', marginTop: '2px', lineHeight: '1.2' }}>Receives warnings, views analytics & gives feedback.</div>
                </div>
                <div 
                  onClick={() => setSelectedRole('campaign_manager')}
                  style={{
                    flex: 1,
                    padding: '14px 10px',
                    borderRadius: '12px',
                    border: `1.5px solid ${selectedRole === 'campaign_manager' ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.06)'}`,
                    background: selectedRole === 'campaign_manager' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>💼</div>
                  <div style={{ fontWeight: '700', fontSize: '0.84rem', color: selectedRole === 'campaign_manager' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))' }}>Manager</div>
                  <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', marginTop: '2px', lineHeight: '1.2' }}>Schedules and dispatches broadcasts.</div>
                </div>
              </div>
            </div>

            {selectedRole === 'audience' && (
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" style={{ fontWeight: '600' }}>Preferred Languages *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '6px' }}>
                  {['Hindi', 'English', 'Marathi', 'Tamil', 'Bengali', 'Telugu', 'Kannada', 'Gujarati', 'Malayalam'].map(lang => {
                    const isSelected = preferredLangs.includes(lang);
                    return (
                      <div
                        key={lang}
                        onClick={() => {
                          if (isSelected) {
                            setPreferredLangs(preferredLangs.filter(l => l !== lang));
                          } else {
                            setPreferredLangs([...preferredLangs, lang]);
                          }
                        }}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          border: `1.5px solid ${isSelected ? 'hsl(var(--primary))' : 'rgba(255, 255, 255, 0.05)'}`,
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          color: isSelected ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                          fontSize: '0.82rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          fontWeight: isSelected ? '700' : '500',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {lang}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '24px' }} disabled={loading}>
              {loading ? 'Creating Account...' : 'Register & Sign Up'}
            </button>

            <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '20px' }}>
              Already have an account?{' '}
              <span style={{ color: 'hsl(var(--primary))', cursor: 'pointer', fontWeight: '600' }} onClick={() => setIsRegister(false)}>
                Sign In
              </span>
            </p>
          </form>
        ) : activeTab === 'password' ? (
          <form onSubmit={handlePasswordLogin}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600' }}>Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="operator@comm.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{ width: '100%', fontSize: '0.95rem' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600' }}>Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ width: '100%', fontSize: '0.95rem' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '24px' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '20px' }}>
              Don't have an account?{' '}
              <span style={{ color: 'hsl(var(--primary))', cursor: 'pointer', fontWeight: '600' }} onClick={() => setIsRegister(true)}>
                Register here
              </span>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRequestOTP}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600' }}>Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="operator@comm.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{ width: '100%', fontSize: '0.95rem' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '24px' }} disabled={loading}>
              {loading ? 'Sending code...' : 'Send OTP verification code'}
            </button>

            <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', textAlign: 'center', marginTop: '20px' }}>
              Don't have an account?{' '}
              <span style={{ color: 'hsl(var(--primary))', cursor: 'pointer', fontWeight: '600' }} onClick={() => setIsRegister(true)}>
                Register here
              </span>
            </p>
          </form>
        )}

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color-glass)' }}>
          <span style={{ fontSize: '0.88rem', color: 'hsl(var(--text-muted))', fontWeight: '600', display: 'block', marginBottom: '14px' }}>
            Demo Operator Accounts (Click to Auto-Fill)
          </span>
          <div className="role-selector-grid">
            {demoAccounts.map((demo) => {
              const isActive = email === demo.email;
              const isManager = demo.email.includes('manager');
              const isAdmin = demo.email.includes('admin');
              const roleClass = isAdmin ? 'admin' : isManager ? 'manager' : 'audience';
              
              let iconSvg;
              let label;
              
              if (isAdmin) {
                label = 'Admin';
                iconSvg = (
                  <svg className="svg-icon" style={{ width: '1.15rem', height: '1.15rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                );
              } else if (isManager) {
                label = 'Manager';
                iconSvg = (
                  <svg className="svg-icon" style={{ width: '1.15rem', height: '1.15rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                );
              } else {
                label = 'Audience';
                iconSvg = (
                  <svg className="svg-icon" style={{ width: '1.15rem', height: '1.15rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M23 7a2 2 0 0 0-2.45-1.45L11 8H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v4l4-2h1l10 2.45A2 2 0 0 0 23 17V7z"/>
                    <path d="M6 10v4"/>
                  </svg>
                );
              }
              
              return (
                <div
                  key={demo.email}
                  className={`role-card ${isActive ? 'active' : ''} ${roleClass}`}
                  onClick={() => handlePreFill(demo)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
                  }}
                >
                  <div className="role-card-icon">{iconSvg}</div>
                  <div className="role-card-title">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default Login;
