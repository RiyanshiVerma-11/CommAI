import React, { useState, useEffect, useCallback } from 'react';
import GlassCard from '../components/GlassCard';

const Settings = ({ user, backendUrl, headers }) => {
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [callMeBotKey, setCallMeBotKey] = useState('');
  const [defaultCountryCode, setDefaultCountryCode] = useState('91');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [dailyCapEmail, setDailyCapEmail] = useState(5000);
  const [dailyCapSms, setDailyCapSms] = useState(5000);
  const [dailyCapWhatsapp, setDailyCapWhatsapp] = useState(5000);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Audience States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [stateName, setStateName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [cityName, setCityName] = useState('');
  const [preferredChannels, setPreferredChannels] = useState([]);
  const [newPassword, setNewPassword] = useState('');

  // MFA States
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaOtpCode, setMfaOtpCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaMockOtp, setMfaMockOtp] = useState('');
  const [pendingSavePayload, setPendingSavePayload] = useState(null);
  const [mfaVerifying, setMfaVerifying] = useState(false);
  
  // Test states
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testWaLoading, setTestWaLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  
  // Health & Diagnostics states
  const [health, setHealth] = useState({ smtp: false, whatsapp: false, groq: false });
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  // Blacklist states
  const [blacklist, setBlacklist] = useState([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [newBlacklistValue, setNewBlacklistValue] = useState('');
  const [newBlacklistType, setNewBlacklistType] = useState('email');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/settings`, { headers });
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSmtpEmail(data.SMTP_EMAIL || '');
      setSmtpPassword(data.SMTP_APP_PASSWORD || '');
      setCallMeBotKey(data.CALLMEBOT_DEFAULT_APIKEY || '');
      setGroqApiKey(data.GROQ_API_KEY || '');
      setDefaultCountryCode(data.DEFAULT_COUNTRY_CODE || '91');
      setDailyCapEmail(data.DAILY_CAP_EMAIL || 5000);
      setDailyCapSms(data.DAILY_CAP_SMS || 5000);
      setDailyCapWhatsapp(data.DAILY_CAP_WHATSAPP || 5000);
      
      setHealth({
        smtp: data.is_smtp_configured,
        whatsapp: data.is_whatsapp_configured,
        groq: data.is_groq_configured
      });
      if (user && user.email) {
        setTestEmail(user.email);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error fetching configuration settings', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [backendUrl, headers, user]);

  const fetchDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/settings/diagnostics`, { headers });
      if (response.ok) {
        const data = await response.json();
        setDiagnostics(data);
      }
    } catch (err) {
      console.error('Error fetching diagnostics:', err);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, [backendUrl, headers]);

  const fetchBlacklist = useCallback(async () => {
    setBlacklistLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/settings/blacklist`, { headers });
      if (response.ok) {
        const data = await response.json();
        setBlacklist(data);
      }
    } catch (err) {
      console.error('Error fetching blacklist:', err);
    } finally {
      setBlacklistLoading(false);
    }
  }, [backendUrl, headers]);

  const fetchAudienceProfile = useCallback(async () => {
    if (user && user.role === 'audience') {
      try {
        const response = await fetch(`${backendUrl}/api/auth/profile/audience`, { headers });
        if (response.ok) {
          const data = await response.json();
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setPhone(data.phone || '');
          setOccupation(data.occupation || '');
          setAge(data.age || '');
          setGender(data.gender || 'Male');
          setStateName(data.state || '');
          setDistrictName(data.district || '');
          setCityName(data.city || '');
          setPreferredChannels(data.preferred_channels || []);
        }
      } catch (err) {
        console.error('Failed to load audience profile:', err);
      }
    }
  }, [backendUrl, headers, user]);

  const handleSaveAudienceProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone,
        occupation,
        age: parseInt(age) || null,
        gender,
        state: stateName,
        district: districtName,
        city: cityName,
        preferred_channels: preferredChannels,
        preferred_languages: user.preferred_languages || []
      };
      
      if (newPassword.trim()) {
        payload.password = newPassword;
      }
      
      const response = await fetch(`${backendUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update profile settings');
      }
      
      setMessage({ text: 'Your profile settings have been updated in real-time!', type: 'success' });
      setNewPassword('');
      fetchAudienceProfile();
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'audience') {
      fetchAudienceProfile();
    } else {
      fetchSettings();
      fetchDiagnostics();
      fetchBlacklist();
    }
  }, [user, fetchSettings, fetchDiagnostics, fetchBlacklist, fetchAudienceProfile]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    const payload = {
      SMTP_EMAIL: smtpEmail,
      SMTP_APP_PASSWORD: smtpPassword,
      CALLMEBOT_DEFAULT_APIKEY: callMeBotKey,
      DEFAULT_COUNTRY_CODE: defaultCountryCode,
      GROQ_API_KEY: groqApiKey,
      DAILY_CAP_EMAIL: parseInt(dailyCapEmail),
      DAILY_CAP_SMS: parseInt(dailyCapSms),
      DAILY_CAP_WHATSAPP: parseInt(dailyCapWhatsapp)
    };

    try {
      const response = await fetch(`${backendUrl}/api/settings`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403 && data.detail && data.detail.mfa_required) {
          setPendingSavePayload(payload);
          setMfaMessage(data.detail.message);
          setMfaMockOtp(data.detail.otp || '');
          setMfaOtpCode('');
          setMfaError('');
          setMfaModalOpen(true);
          return;
        }
        throw new Error(data.detail || 'Failed to save settings');
      }
      
      setMessage({ text: 'Settings and Guardrails updated successfully!', type: 'success' });
      fetchSettings();
      fetchDiagnostics();
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyMfaSave = async (e) => {
    e.preventDefault();
    if (!mfaOtpCode) {
      setMfaError('Please enter verification code');
      return;
    }
    setMfaVerifying(true);
    setMfaError('');

    try {
      const response = await fetch(`${backendUrl}/api/settings`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-MFA-OTP': mfaOtpCode
        },
        body: JSON.stringify(pendingSavePayload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail?.message || data.detail || 'Verification and Save failed');
      }

      setMfaModalOpen(false);
      setPendingSavePayload(null);
      setMessage({ text: 'Settings and Guardrails updated successfully! (Verified via MFA)', type: 'success' });
      fetchSettings();
      fetchDiagnostics();
    } catch (err) {
      setMfaError(err.message);
    } finally {
      setMfaVerifying(false);
      setSaving(false);
    }
  };

  const handleAddBlacklist = async (e) => {
    e.preventDefault();
    if (!newBlacklistValue.trim()) return;
    try {
      const response = await fetch(`${backendUrl}/api/settings/blacklist`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newBlacklistType,
          value: newBlacklistValue.trim()
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to add opt-out entry');
      }
      setNewBlacklistValue('');
      fetchBlacklist();
      setMessage({ text: 'Opt-out entry successfully registered in suppressor.', type: 'success' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveBlacklist = async (id) => {
    if (!window.confirm('Are you sure you want to remove this value from the opt-out registry?')) return;
    try {
      const response = await fetch(`${backendUrl}/api/settings/blacklist/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) throw new Error('Failed to remove blacklist item');
      fetchBlacklist();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setMessage({ text: 'Please enter a recipient email address for the test', type: 'warning' });
      return;
    }
    setTestEmailLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const response = await fetch(`${backendUrl}/api/settings/test-email`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: testEmail })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Test email failed');
      setMessage({ text: data.message || 'SMTP Test email sent successfully!', type: 'success' });
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      setMessage({ text: 'Please enter a target phone number (with country code) for WhatsApp testing', type: 'warning' });
      return;
    }
    setTestWaLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const response = await fetch(`${backendUrl}/api/settings/test-whatsapp`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: testPhone, apikey: callMeBotKey })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'WhatsApp test failed');
      setMessage({ text: data.message || 'WhatsApp test triggered!', type: 'success' });
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setTestWaLoading(false);
    }
  };

  if (user && user.role === 'audience') {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Personal Profile & Preferences Settings</h1>
          <p style={{ color: 'hsl(var(--text-secondary))' }}>Configure your regional languages, demographics, and notification delivery channel choices.</p>
        </div>

        {message.text && (
          <div className={`glass-card ${message.type}-text`} style={{
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '0.9rem',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: '1px solid',
            borderColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {message.type === 'success' ? <span>✅</span> : <span>❌</span>}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSaveAudienceProfile}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <GlassCard>
              <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>👤 Personal Details</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Email Address (Read-Only)</label>
                  <input
                    type="email"
                    disabled
                    className="form-control"
                    value={user.email}
                    style={{ opacity: 0.6 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    required
                    className="form-control"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Update Password (Leave blank to keep current)</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </GlassCard>

            <GlassCard>
              <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>📊 Demographic Profiling (For Targeting)</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Occupation</label>
                  <select
                    className="form-control"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                  >
                    <option value="Farmer">Farmer</option>
                    <option value="Student">Student</option>
                    <option value="Healthcare Worker">Healthcare Worker</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Business Owner">Business Owner</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input
                    type="number"
                    className="form-control"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-control"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-control"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">District</label>
                  <input
                    type="text"
                    className="form-control"
                    value={districtName}
                    onChange={(e) => setDistrictName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-control"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>⚙️ Preferences</h3>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px' }}>Preferred Delivery Channels</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
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
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: `1.5px solid ${isSelected ? 'hsl(var(--primary))' : 'rgba(255, 255, 255, 0.05)'}`,
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          color: isSelected ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                          fontSize: '0.82rem',
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
            </GlassCard>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="submit" className="primary-btn" disabled={saving} style={{ padding: '12px 32px', fontSize: '0.95rem' }}>
                {saving ? 'Saving...' : 'Update Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>System Integration Settings</h1>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>Configure API connections, send rate caps, and suppression registries.</p>
      </div>

      {message.text && (
        <div className={`glass-card ${message.type}-text`} style={{
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '0.9rem',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : message.type === 'danger' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: '1px solid',
          borderColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : message.type === 'danger' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message.type === 'success' && <span>✅</span>}
          {message.type === 'danger' && <span>❌</span>}
          {message.type === 'warning' && <span>⚠️</span>}
          {message.text}
        </div>
      )}

      {/* 🚦 Real-Time Integration Diagnostics dashboard */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>📡 Live Gateway Connectivity Diagnostics</h3>
          <button className="secondary-btn" onClick={fetchDiagnostics} disabled={diagnosticsLoading} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            {diagnosticsLoading ? 'Scanning...' : 'Refresh Status'}
          </button>
        </div>

        {diagnostics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <GlassCard style={{ padding: '16px', background: diagnostics.smtp.ok ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', border: diagnostics.smtp.ok ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>SMTP Server</span>
                <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: diagnostics.smtp.ok ? '#10b981' : '#ef4444', color: '#fff', fontWeight: 'bold' }}>
                  {diagnostics.smtp.ok ? 'OK' : 'FAIL'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: '10px 0 0 0' }}>{diagnostics.smtp.msg}</p>
            </GlassCard>

            <GlassCard style={{ padding: '16px', background: diagnostics.groq.ok ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', border: diagnostics.groq.ok ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Groq AI</span>
                <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: diagnostics.groq.ok ? '#10b981' : '#ef4444', color: '#fff', fontWeight: 'bold' }}>
                  {diagnostics.groq.ok ? 'OK' : 'FAIL'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: '10px 0 0 0' }}>
                {diagnostics.groq.msg} {diagnostics.groq.latency_ms > 0 && `(${diagnostics.groq.latency_ms}ms)`}
              </p>
            </GlassCard>

            <GlassCard style={{ padding: '16px', background: diagnostics.whatsapp.ok ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', border: diagnostics.whatsapp.ok ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>WhatsApp</span>
                <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: diagnostics.whatsapp.ok ? '#10b981' : '#ef4444', color: '#fff', fontWeight: 'bold' }}>
                  {diagnostics.whatsapp.ok ? 'OK' : 'FAIL'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', margin: '10px 0 0 0' }}>{diagnostics.whatsapp.msg}</p>
            </GlassCard>

            <GlassCard style={{ padding: '16px', background: !diagnostics.metrics.alert_triggered ? 'rgba(255, 255, 255, 0.03)' : 'rgba(245, 158, 11, 0.08)', border: !diagnostics.metrics.alert_triggered ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(245, 158, 11, 0.25)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>DELIVERY WARNINGS</span>
              <div style={{ marginTop: '8px', fontSize: '0.82rem' }}>
                <span>Failure rate (past 1h): <strong style={{ color: diagnostics.metrics.alert_triggered ? '#f59e0b' : 'inherit' }}>{diagnostics.metrics.failure_rate_percent}%</strong></span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>{diagnostics.metrics.recent_sent_count} sent today</span>
              </div>
            </GlassCard>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
          Loading settings content...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main configuration form */}
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* SMTP Credentials Card */}
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>📧</span>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Gmail SMTP Configuration</h3>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Used for campaign emails and secure OTP logins</p>
                    </div>
                  </div>
                  <span className={`badge ${health.smtp ? 'badge-communicator' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    {health.smtp ? 'Active' : 'Unconfigured'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Gmail Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. administrator@gmail.com"
                      value={smtpEmail}
                      onChange={(e) => setSmtpEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gmail App Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        placeholder={smtpPassword ? '****************' : 'Enter 16-character App Password'}
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'hsl(var(--text-muted))',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: 0
                        }}
                      >
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  color: 'hsl(var(--text-secondary))'
                }}>
                  <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '4px' }}>💡 How to generate Gmail App Password (Free):</strong>
                  1. Go to your <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--accent))', textDecoration: 'underline' }}>Google Account settings</a>.<br />
                  2. Enable <strong>2-Step Verification</strong> under the Security tab.<br />
                  3. Search for <strong>App Passwords</strong>.<br />
                  4. Select <strong>Mail</strong> and choose a device, click <strong>Generate</strong>.<br />
                  5. Copy the 16-character code (without spaces) and paste it above.
                </div>
              </GlassCard>

              {/* CallMeBot WhatsApp Card */}
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>💬</span>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>CallMeBot WhatsApp Setup</h3>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Used for free WhatsApp messaging campaigns</p>
                    </div>
                  </div>
                  <span className={`badge ${health.whatsapp ? 'badge-communicator' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    {health.whatsapp ? 'Active' : 'Unconfigured'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Default CallMeBot API Key</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter API Key from WhatsApp message"
                      value={callMeBotKey}
                      onChange={(e) => setCallMeBotKey(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Default Country Code prefix</label>
                    <select
                      className="form-control"
                      value={defaultCountryCode}
                      onChange={(e) => setDefaultCountryCode(e.target.value)}
                    >
                      <option value="91">India (+91)</option>
                      <option value="1">USA (+1)</option>
                      <option value="44">UK (+44)</option>
                      <option value="971">UAE (+971)</option>
                      <option value="61">Australia (+61)</option>
                      <option value="86">China (+86)</option>
                    </select>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  color: 'hsl(var(--text-secondary))'
                }}>
                  <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '4px' }}>📲 Recipient WhatsApp Activation Instructions (100% Free):</strong>
                  For any recipient (including yourself) to receive messages, they must complete a one-time activation:<br />
                  1. Save the number <strong>+34 644 71 81 84</strong> in your phone contacts as <strong>CallMeBot</strong>.<br />
                  2. Send the message <code>I allow callmebot to send me messages</code> to it via WhatsApp.<br />
                  3. CallMeBot will reply with your API Key (e.g. <code>928172</code>).<br />
                  4. Paste your key above to test, or save it in an Audience member's <strong>custom fields</strong> as <code>{"{ \"callmebot_apikey\": \"YOUR_KEY\" }"}</code>.
                </div>
              </GlassCard>

              {/* Groq Translation Card */}
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🤖</span>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Groq AI Translation Service</h3>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Used for real-time translation of message templates and campaign dispatches</p>
                    </div>
                  </div>
                  <span className={`badge ${health.groq ? 'badge-communicator' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    {health.groq ? 'Active' : 'Unconfigured'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Groq API Key</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showGroqKey ? 'text' : 'password'}
                        className="form-control"
                        placeholder={groqApiKey ? '****************' : 'gsk_...'}
                        value={groqApiKey}
                        onChange={(e) => setGroqApiKey(e.target.value)}
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowGroqKey(!showGroqKey)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'hsl(var(--text-muted))',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: 0
                        }}
                      >
                        {showGroqKey ? '👁' : '👁‍🗨'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  color: 'hsl(var(--text-secondary))'
                }}>
                  <strong style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: '4px' }}>🔑 How to generate a free Groq API Key:</strong>
                  1. Visit <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--accent))', textDecoration: 'underline' }}>console.groq.com</a> and sign up for a free account.<br />
                  2. Go to the <strong>API Keys</strong> section in the sidebar menu.<br />
                  3. Click <strong>Create API Key</strong>, give it a name (e.g. <code>CommAI</code>), and copy the key.<br />
                  4. Paste your key above and save. Translation will be activated instantly across all campaigns!
                </div>
              </GlassCard>

              {/* 🎛️ DAILY CHANNEL CAPS CARD */}
              <GlassCard>
                <div style={{ borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>🛡️ Daily Send Rate Limit Caps</h3>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Configure global daily limits to prevent accidental billing drainage.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Email Daily Cap</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={dailyCapEmail} 
                      onChange={(e) => setDailyCapEmail(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SMS Daily Cap</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={dailyCapSms} 
                      onChange={(e) => setDailyCapSms(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp Daily Cap</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={dailyCapWhatsapp} 
                      onChange={(e) => setDailyCapWhatsapp(e.target.value)} 
                    />
                  </div>
                </div>
              </GlassCard>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                  style={{ minWidth: '150px' }}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

            </div>
          </form>

          {/* Test Operations Card */}
          <GlassCard>
            <div style={{ borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>🔬 Diagnostic Integration Testing</h3>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Trigger real-time delivery checks to ensure services route correctly.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Test Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '600', color: 'hsl(var(--text-primary))' }}>Verify Email Service</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Recipient email address"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleTestEmail}
                    disabled={testEmailLoading}
                  >
                    {testEmailLoading ? 'Sending...' : 'Test SMTP'}
                  </button>
                </div>
              </div>

              {/* Test WhatsApp */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '600', color: 'hsl(var(--text-primary))' }}>Verify WhatsApp Service</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Phone with country code (e.g. 919876543210)"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleTestWhatsApp}
                    disabled={testWaLoading}
                  >
                    {testWaLoading ? 'Sending...' : 'Test WhatsApp'}
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* 🔏 OPT-OUT REGISTRY SUPPRESSION LIST */}
          <GlassCard>
            <div style={{ borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>🔏 Opt-Out Suppression Registry (Blacklist)</h3>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Manage citizens who have requested to unsubscribe from campaigns.</p>
            </div>

            {/* Form to add entry */}
            <form onSubmit={handleAddBlacklist} style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '150px' }}>
                <label className="form-label">Registry Type</label>
                <select className="select-input" value={newBlacklistType} onChange={(e) => setNewBlacklistType(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="phone">Phone Number</option>
                </select>
              </div>

              <div style={{ flex: '1', minWidth: '200px' }}>
                <label className="form-label">Suppressed Value</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. name@domain.com or 919876543210" 
                  className="text-input" 
                  value={newBlacklistValue} 
                  onChange={(e) => setNewBlacklistValue(e.target.value)} 
                />
              </div>

              <button type="submit" className="primary-btn" style={{ height: '42px', padding: '0 20px' }}>
                Suppress Value
              </button>
            </form>

            {/* Blacklist records table */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color-glass)', borderRadius: '6px' }}>
              <table className="custom-table" style={{ margin: 0, fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#0d111d', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th>Registry Type</th>
                    <th>Suppressed Email/Phone</th>
                    <th>Unsubscribed Date</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {blacklistLoading && blacklist.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '16px' }}>
                        Loading suppression registry...
                      </td>
                    </tr>
                  ) : blacklist.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '16px' }}>
                        Suppress registry is currently empty.
                      </td>
                    </tr>
                  ) : (
                    blacklist.map(entry => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ textTransform: 'uppercase', fontWeight: 600 }}>{entry.type}</td>
                        <td style={{ fontFamily: 'monospace' }}>{entry.value}</td>
                        <td>{new Date(entry.created_at).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            type="button" 
                            className="danger-text-btn" 
                            onClick={() => handleRemoveBlacklist(entry.id)}
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '0.78rem',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              background: 'rgba(239, 68, 68, 0.05)',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

        </div>
      )}

      {/* MFA OTP verification modal */}
      {mfaModalOpen && (
        <div className="modal-backdrop animate-fade-in" style={{ zIndex: 100 }}>
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem' }}>🛡️ Confirm Identity (MFA)</h3>
              <button 
                onClick={() => { setMfaModalOpen(false); setSaving(false); }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'hsl(var(--text-secondary))' }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleVerifyMfaSave} style={{ marginTop: '16px' }}>
              {mfaError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
                  ⚠️ {mfaError}
                </div>
              )}

              <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', lineHeight: '1.5', marginBottom: '20px' }}>
                {mfaMessage}
                {mfaMockOtp && (
                  <span style={{ display: 'block', marginTop: '8px', color: 'hsl(var(--primary))', fontWeight: 'bold' }}>
                    [SANDBOX MODE] Enter OTP: {mfaMockOtp}
                  </span>
                )}
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>
                  Verification Code
                </label>
                <input 
                  type="text" 
                  required 
                  maxLength={6}
                  className="text-input" 
                  value={mfaOtpCode} 
                  onChange={(e) => setMfaOtpCode(e.target.value.replace(/\D/g, ''))} 
                  placeholder="Enter 6-digit OTP"
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '4px', height: '50px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button type="button" className="secondary-btn" onClick={() => { setMfaModalOpen(false); setSaving(false); }}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={mfaVerifying}>
                  {mfaVerifying ? 'Verifying...' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
