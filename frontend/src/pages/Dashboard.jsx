import React, { useEffect, useState, useCallback } from 'react';
import GlassCard from '../components/GlassCard';

const Dashboard = ({ user, setActiveTab, backendUrl, headers }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/dashboard/stats`, { headers });
      if (!response.ok) {
        throw new Error('Failed to load dashboard statistics');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, headers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return <div style={{ color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontWeight: 600 }}>Gathering dashboard metrics...</div>;
  }

  if (error) {
    return <div className="danger-text" style={{ padding: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)' }}>Error loading dashboard: {error}</div>;
  }

  const s = stats || {
    total_audiences: 0,
    active_audiences: 0,
    total_segments: 0,
    draft_campaigns: 0,
    total_campaigns: 0,
    total_templates: 0,
    recent_activities: []
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'campaign_manager': return 'Campaign Manager';
      default: return 'Communications staff';
    }
  };

  const totalDelivered = s.total_delivered || 0;
  const totalFailed = s.total_failed || 0;
  const totalMessages = totalDelivered + totalFailed;
  const successRate = totalMessages > 0 ? Math.round((totalDelivered / totalMessages) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.03em', color: 'hsl(var(--text-primary))' }}>
          Welcome back, {user.full_name}
        </h1>
        <p style={{ color: 'hsl(var(--text-muted))', fontSize: '1.05rem', fontWeight: '500' }}>
          Platform role: <span style={{ color: 'hsl(var(--primary))', fontWeight: '600' }}>{getRoleLabel(user.role)}</span> at <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: '600' }}>{user.organization || 'General Public Services'}</span>
        </p>
      </div>

      <div className="dashboard-grid">
        <GlassCard className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Total Audiences</span>
            <div style={{ background: 'hsl(var(--primary) / 8%)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="svg-icon" style={{ color: 'hsl(var(--primary))', width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div>
            <span className="stat-number">{s.total_audiences}</span>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: '500' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--accent))' }}></span>
              {s.active_audiences} active recipients
            </span>
          </div>
        </GlassCard>

        <GlassCard className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Dynamic Segments</span>
            <div style={{ background: 'hsl(var(--secondary) / 8%)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="svg-icon" style={{ color: 'hsl(var(--secondary))', width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
          </div>
          <div>
            <span className="stat-number">{s.total_segments}</span>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: '500' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary))' }}></span>
              Target queries synced
            </span>
          </div>
        </GlassCard>

        <GlassCard className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Draft Campaigns</span>
            <div style={{ background: 'hsl(var(--accent) / 8%)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="svg-icon" style={{ color: 'hsl(var(--accent))', width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
          </div>
          <div>
            <span className="stat-number">{s.draft_campaigns}</span>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: '500' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary))' }}></span>
              {s.total_campaigns} campaigns total
            </span>
          </div>
        </GlassCard>

        <GlassCard className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Templates Library</span>
            <div style={{ background: 'hsl(var(--warning) / 8%)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="svg-icon" style={{ color: 'hsl(var(--warning))', width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <div>
            <span className="stat-number">{s.total_templates}</span>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: '500' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--warning))' }}></span>
              Message blocks ready
            </span>
          </div>
        </GlassCard>

        <GlassCard className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Messages Delivered</span>
            <div style={{ background: 'rgba(34, 197, 94, 0.08)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="svg-icon" style={{ color: 'hsl(var(--accent))', width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div>
            <span className="stat-number" style={{ color: 'hsl(var(--accent))' }}>{totalDelivered}</span>
            <div style={{ marginTop: '8px' }}>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ width: `${successRate}%`, height: '100%', background: 'hsl(var(--accent))' }}></div>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', fontWeight: '600' }}>
                {totalMessages > 0 ? `${successRate}% Delivery Success Rate` : 'No dispatches recorded'}
              </span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="stat-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-title">Failed Dispatches</span>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="svg-icon" style={{ color: 'hsl(var(--danger))', width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
          <div>
            <span className="stat-number" style={{ color: 'hsl(var(--danger))' }}>{totalFailed}</span>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: '500' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--danger))' }}></span>
              Rejected or configuration errors
            </span>
          </div>
        </GlassCard>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
        <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '28px' }}>
          <h2 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '16px', fontWeight: '700', color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}>
            Quick Shortcuts
          </h2>
          <div className="toolcard-grid">
            <div
              className="toolcard"
              onClick={() => setActiveTab('audiences')}
              style={{ padding: '20px', borderRadius: '16px' }}
            >
              <div className="toolcard-icon-container" style={{ background: 'hsl(var(--primary) / 8%)', color: 'hsl(var(--primary))', borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="svg-icon" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span className="toolcard-title" style={{ fontSize: '1rem', fontWeight: '700', marginTop: '6px' }}>Manage Audiences</span>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', lineHeight: '1.5', margin: 0 }}>
                Review subscriber directories, states, occupations, and profile filters.
              </p>
            </div>
            
            <div
              className="toolcard"
              onClick={() => setActiveTab('campaigns')}
              style={{ padding: '20px', borderRadius: '16px' }}
            >
              <div className="toolcard-icon-container" style={{ background: 'hsl(var(--secondary) / 8%)', color: 'hsl(var(--secondary))', borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="svg-icon" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <span className="toolcard-title" style={{ fontSize: '1rem', fontWeight: '700', marginTop: '6px' }}>Create Campaign</span>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', lineHeight: '1.5', margin: 0 }}>
                Launch a new multi-channel messaging broadcast using the planner wizard.
              </p>
            </div>
            
            <div
              className="toolcard"
              onClick={() => setActiveTab('templates')}
              style={{ padding: '20px', borderRadius: '16px' }}
            >
              <div className="toolcard-icon-container" style={{ background: 'hsl(var(--warning) / 8%)', color: 'hsl(var(--warning))', borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="svg-icon" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="toolcard-title" style={{ fontSize: '1rem', fontWeight: '700', marginTop: '6px' }}>Templates Library</span>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', lineHeight: '1.5', margin: 0 }}>
                Write reusable templates, set variables, and manage localized layouts.
              </p>
            </div>
            
            <div
              className="toolcard"
              onClick={() => setActiveTab('audiences')}
              style={{ padding: '20px', borderRadius: '16px' }}
            >
              <div className="toolcard-icon-container" style={{ background: 'hsl(var(--accent) / 8%)', color: 'hsl(var(--accent))', borderRadius: '10px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="svg-icon" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span className="toolcard-title" style={{ fontSize: '1rem', fontWeight: '700', marginTop: '6px' }}>CSV Bulk Importer</span>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))', lineHeight: '1.5', margin: 0 }}>
                Upload spreadsheet files to mass seed recipient records with validation.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard style={{ position: 'relative', overflow: 'hidden', padding: '28px' }}>
          <h2 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-color-glass)', paddingBottom: '16px', marginBottom: '24px', fontWeight: '700', color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}>
            Recent Activities
          </h2>
          {s.recent_activities.length === 0 ? (
            <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '36px 0', fontSize: '0.92rem', fontWeight: '500' }}>
              No recent changes recorded.
            </p>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '4px' }}>
              <div className="timeline-line" style={{ top: '16px', bottom: '16px' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {s.recent_activities.map((act, index) => {
                  const nodeClass = act.activity_type === 'campaign' ? 'campaign' : act.activity_type === 'template' ? 'template' : 'audience';
                  
                  let nodeSvg;
                  if (act.activity_type === 'campaign') {
                    nodeSvg = (
                      <svg className="svg-icon" style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                      </svg>
                    );
                  } else if (act.activity_type === 'template') {
                    nodeSvg = (
                      <svg className="svg-icon" style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <path d="M14 2v6h6"/>
                      </svg>
                    );
                  } else {
                    nodeSvg = (
                      <svg className="svg-icon" style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      </svg>
                    );
                  }

                  return (
                    <div key={index} className="timeline-item-wrapper animate-fade-in" style={{ paddingLeft: '34px', marginBottom: '20px' }}>
                      <div className={`timeline-node ${nodeClass}`} style={{ left: '0px', width: '24px', height: '24px', borderWidth: '2px' }}>
                        {nodeSvg}
                      </div>
                      <div className="activity-content">
                        <span className="activity-msg" style={{ fontSize: '0.92rem', fontWeight: '600', color: 'hsl(var(--text-secondary))' }}>{act.message}</span>
                        <span className="activity-time" style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: '2px', fontWeight: '500' }}>
                          {new Date(act.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default Dashboard;
