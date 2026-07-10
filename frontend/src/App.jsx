import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Audiences from './pages/Audiences';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Approvals from './pages/Approvals';



// Connect dynamically to the backend API services
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [initialLoading, setInitialLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('comm-theme') || 'dark');
  const [view, setView] = useState('landing');
  const [viewRegister, setViewRegister] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('comm-theme', newTheme);
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  // Force light theme on landing page
  useEffect(() => {
    if (!token || !user) {
      document.documentElement.classList.add('light-theme');
    } else {
      // Restore user's saved theme preference inside the app
      if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
      } else {
        document.documentElement.classList.remove('light-theme');
      }
    }
  }, [token, user, theme]);

  // Compile auth headers
  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };

  const verifyToken = async (savedToken) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (!response.ok) {
        throw new Error('Session expired');
      }
      const userData = await response.json();
      setUser(userData);
      setToken(savedToken);
    } catch (err) {
      console.warn(err.message);
      handleLogout();
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    const savedToken = sessionStorage.getItem('token');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setInitialLoading(false);
    }
  }, []);

  const handleLoginSuccess = (newToken, userData) => {
    sessionStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setToken('');
    setUser(null);
    setActiveTab('dashboard');
    setView('landing');
    setViewRegister(false);
  };

  if (initialLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#090b14',
        color: 'hsl(187, 92%, 50%)',
        fontSize: '1.25rem',
        fontWeight: 'bold',
        fontFamily: 'sans-serif'
      }}>
        Initializing CommAI Services...
      </div>
    );
  }

  if (!token || !user) {
    if (view === 'landing') {
      return (
        <Landing 
          onNavigateToLogin={() => {
            setView('login');
            setViewRegister(false);
          }}
          onNavigateToRegister={() => {
            setView('login');
            setViewRegister(true);
          }}
        />
      );
    }
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        backendUrl={BACKEND_URL} 
        onBackToLanding={() => setView('landing')}
        initialRegister={viewRegister}
      />
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            user={user}
            setActiveTab={setActiveTab}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      case 'audiences':
        return (
          <Audiences
            user={user}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      case 'templates':
        return (
          <Templates
            user={user}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      case 'campaigns':
        return (
          <Campaigns
            user={user}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      case 'approvals':
        if (user.role !== 'admin') return <div className="glass-card" style={{ padding: '24px', margin: '24px', color: 'hsl(var(--danger))' }}>Access Denied: Approvals queue restricted to Administrators.</div>;
        return (
          <Approvals
            user={user}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      case 'audit_logs':
        if (user.role !== 'admin') return <div className="glass-card" style={{ padding: '24px', margin: '24px', color: 'hsl(var(--danger))' }}>Access Denied: Audit trails restricted to Administrators.</div>;
        return (
          <AuditLogs
            user={user}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      case 'users':
        return (
          <Users
            user={user}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      case 'settings':
        return (
          <Settings
            user={user}
            backendUrl={BACKEND_URL}
            headers={authHeaders}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'audiences': return 'Audience & Segment Management';
      case 'templates': return 'Templates Library';
      case 'campaigns': return 'Campaign Planner Wizard';
      case 'approvals': return 'Maker-Checker Approvals Queue';
      case 'audit_logs': return 'Operator Audit Trail Logs';
      case 'users': return 'Operator User Directory';
      case 'settings': return 'System Integration Parameters';
      default: return 'CommAI Platform';
    }
  };


  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'sidebar-mobile-open' : ''}`}>
      {mobileSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)}></div>
      )}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        closeMobileSidebar={() => setMobileSidebarOpen(false)}
      />
      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mobile Toggle Button */}
            <button 
              className="icon-btn mobile-menu-btn" 
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              title="Toggle Navigation Menu"
            >
              {mobileSidebarOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </button>

            {/* Desktop Toggle Button */}
            <button 
              className="icon-btn desktop-menu-btn" 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand Navigation Sidebar" : "Collapse Navigation Sidebar"}
            >
              {sidebarCollapsed ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              )}
            </button>

            <h2 style={{ fontSize: '1.4rem', fontWeight: '700' }}>
              {getHeaderTitle()}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
            <span className="header-date" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'hsl(var(--primary))', width: '1.1rem', height: '1.1rem' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <span className="header-date" style={{ height: '14px', width: '1px', background: 'var(--border-color-glass)' }}></span>
            
            {/* Custom Theme Switch Pill */}
            <div 
              className={`theme-switch-pill ${theme}`} 
              onClick={toggleTheme} 
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              <div className="theme-switch-slider"></div>
              <div className="theme-switch-icon dark-icon">
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '14px', height: '14px' }}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </div>
              <div className="theme-switch-icon light-icon">
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '14px', height: '14px' }}>
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </div>
            </div>
            
            <span style={{ height: '14px', width: '1px', background: 'var(--border-color-glass)' }}></span>
            
            {/* Profile settings dropdown */}
            <div className="profile-dropdown-container">
              <div 
                className="profile-avatar-btn" 
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                title={`${user?.full_name} — Profile & Settings`}
                style={{ overflow: 'hidden', padding: 0 }}
              >
                <img src="/logo.jpeg" alt="User Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              
              {profileMenuOpen && (
                <>
                  <div className="dropdown-backdrop" onClick={() => setProfileMenuOpen(false)} />
                  <div className="profile-dropdown-card">
                    <div className="profile-dropdown-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <img src="/logo.jpeg" alt="CommAI Logo" style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' }} />
                        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CommAI Gateway</span>
                      </div>
                      <span className="profile-dropdown-name">{user?.full_name}</span>
                      <span className="profile-dropdown-email">{user?.email}</span>
                      <span className="profile-dropdown-org">{user?.organization || 'General Public Services'}</span>
                      <span className={`badge badge-${user?.role === 'admin' ? 'admin' : user?.role === 'campaign_manager' ? 'manager' : 'communicator'}`} style={{ textTransform: 'capitalize', width: 'fit-content', marginTop: '6px' }}>
                        {user?.role === 'admin' ? 'Admin' : user?.role === 'campaign_manager' ? 'Manager' : 'Staff'}
                      </span>
                    </div>
                    
                    <button 
                      className="profile-dropdown-item" 
                      onClick={() => {
                        setActiveTab('settings');
                        setProfileMenuOpen(false);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      Profile Settings
                    </button>
                    
                    <button 
                      className="profile-dropdown-item logout" 
                      onClick={() => {
                        setProfileMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="view-container">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}

export default App;
