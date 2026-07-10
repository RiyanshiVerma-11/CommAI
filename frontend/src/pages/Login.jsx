import React, { useState } from 'react';
import GlassCard from '../components/GlassCard';

const Login = ({ onLoginSuccess, backendUrl, onBackToLanding, initialRegister }) => {
  const [isRegister, setIsRegister] = useState(initialRegister || false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState('communicator');
  const [organization, setOrganization] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [activeTab, setActiveTab] = useState('password'); // 'password' or 'otp'

  const demoAccounts = [
    { label: '🛡️ Admin Account', email: 'admin@comm.ai', password: 'AdminPassword123!' },
    { label: '💼 Campaign Manager', email: 'manager@comm.ai', password: 'ManagerPassword123!' },
    { label: '📣 Communicator Staff', email: 'communicator@comm.ai', password: 'CommPassword123!' }
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
    if (!email || !password || !fullName) {
      setError('Full Name, Email, and Password are required');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const payload = {
        email,
        password,
        full_name: fullName,
        role: selectedRole,
        organization: organization || null,
        designation: designation || null
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

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600' }}>Platform Role *</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <div 
                  onClick={() => setSelectedRole('communicator')}
                  style={{
                    flex: 1,
                    padding: '14px 10px',
                    borderRadius: '12px',
                    border: `1.5px solid ${selectedRole === 'communicator' ? 'hsl(var(--accent))' : 'rgba(255,255,255,0.06)'}`,
                    background: selectedRole === 'communicator' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.02)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>📣</div>
                  <div style={{ fontWeight: '700', fontSize: '0.84rem', color: selectedRole === 'communicator' ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))' }}>Staff</div>
                  <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', marginTop: '2px', lineHeight: '1.2' }}>Creates content and manages records.</div>
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
              const roleClass = isAdmin ? 'admin' : isManager ? 'manager' : 'communicator';
              
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
                label = 'Staff';
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
