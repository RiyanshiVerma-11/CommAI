import React, { useState, useEffect, useCallback } from 'react';
import GlassCard from '../components/GlassCard';

const Approvals = ({ user, backendUrl, headers }) => {
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Lists fetched from DB for dropdown selection
  const [segments, setSegments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchPendingCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/campaigns`, { headers });
      if (!response.ok) throw new Error('Failed to load campaigns');
      const data = await response.json();
      // Filter only pending_approval campaigns
      const pending = data.filter(c => c.status === 'pending_approval');
      setPendingCampaigns(pending);
      
      // Auto-select first if none selected, or keep selected if still exists
      if (pending.length > 0) {
        if (selectedCamp) {
          const stillExists = pending.find(c => c.id === selectedCamp.id);
          if (stillExists) {
            setSelectedCamp(stillExists);
          } else {
            setSelectedCamp(pending[0]);
          }
        } else {
          setSelectedCamp(pending[0]);
        }
      } else {
        setSelectedCamp(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, headers, selectedCamp]);

  const fetchSegmentsAndTemplates = useCallback(async () => {
    try {
      const segRes = await fetch(`${backendUrl}/api/segments`, { headers });
      const tplRes = await fetch(`${backendUrl}/api/templates`, { headers });
      if (segRes.ok && tplRes.ok) {
        setSegments(await segRes.json());
        setTemplates(await tplRes.json());
      }
    } catch (err) {
      console.error(err);
    }
  }, [backendUrl, headers]);

  useEffect(() => {
    fetchPendingCampaigns();
    fetchSegmentsAndTemplates();
  }, [fetchSegmentsAndTemplates]);

  // Fetch audit logs when campaign selection changes
  useEffect(() => {
    if (!selectedCamp) {
      setAuditLogs([]);
      return;
    }
    const fetchCampaignAuditLogs = async () => {
      setAuditLoading(true);
      try {
        const response = await fetch(`${backendUrl}/api/campaigns/${selectedCamp.id}/audit-logs`, { headers });
        if (response.ok) {
          const logs = await response.json();
          setAuditLogs(logs);
        }
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        setAuditLoading(false);
      }
    };
    fetchCampaignAuditLogs();
    setReviewNote('');
    setActionError('');
    setActionSuccess('');
  }, [selectedCamp, backendUrl, headers]);

  const handleApprove = async () => {
    if (!selectedCamp) return;
    if (!window.confirm(`Approve campaign "${selectedCamp.title}" for delivery/scheduling?`)) return;

    setActionLoading(true);
    setActionError('');
    setActionSuccess('');

    try {
      const response = await fetch(`${backendUrl}/api/campaigns/${selectedCamp.id}/approve`, {
        method: 'POST',
        headers
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Approval failed');
      }

      setActionSuccess('Campaign approved successfully!');
      fetchPendingCampaigns();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedCamp) return;
    if (!reviewNote.trim()) {
      setActionError('Please document a rejection reason in the comments section.');
      return;
    }

    if (!window.confirm(`Reject campaign "${selectedCamp.title}" and return it to draft status?`)) return;

    setActionLoading(true);
    setActionError('');
    setActionSuccess('');

    try {
      const response = await fetch(`${backendUrl}/api/campaigns/${selectedCamp.id}/reject`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reviewNote.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Rejection failed');
      }

      setActionSuccess('Campaign rejected and returned to draft.');
      fetchPendingCampaigns();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getCampaignTypeLabel = (val) => {
    switch (val) {
      case 'awareness_drive': return 'Awareness Drive';
      case 'emergency_alert': return 'Emergency Alert';
      case 'educational_notification': return 'Educational Bulletin';
      case 'organizational_announcement': return 'Organizational Announcement';
      default: return val;
    }
  };

  // Find linked segment name
  const getSegmentName = (segId) => {
    const seg = segments.find(s => s.id === segId);
    return seg ? seg.name : 'Unknown Segment';
  };

  // Render comparative side-by-side modifications (Diff View)
  const renderTemplateDiff = () => {
    if (!selectedCamp) return null;

    let originalSubject = "N/A";
    let originalBody = "N/A (Write Custom Message option selected)";
    
    if (selectedCamp.template_id) {
      const origTpl = templates.find(t => t.id === selectedCamp.template_id);
      if (origTpl) {
        originalSubject = origTpl.subject_template || "(No Subject)";
        originalBody = origTpl.body_template || "";
      }
    }

    const modifiedSubject = selectedCamp.custom_subject || originalSubject;
    const modifiedBody = selectedCamp.custom_body || originalBody;

    const isSubjectModified = selectedCamp.custom_subject && selectedCamp.custom_subject !== originalSubject;
    const isBodyModified = selectedCamp.custom_body && selectedCamp.custom_body !== originalBody;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
        <div>
          <h4 style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Baseline Template</h4>
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', minHeight: '150px' }}>
            <div style={{ fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '8px' }}>
              <strong>Subject:</strong> <span style={{ color: 'hsl(var(--text-muted))' }}>{originalSubject}</span>
            </div>
            <div style={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
              {originalBody}
            </div>
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Proposed Modifications (Diff)</h4>
          <div style={{ 
            padding: '12px', 
            background: 'rgba(0, 212, 255, 0.01)', 
            border: '1px solid',
            borderColor: isSubjectModified || isBodyModified ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.04)', 
            borderRadius: '8px', 
            minHeight: '150px' 
          }}>
            <div style={{ 
              fontSize: '0.85rem', 
              borderBottom: '1px solid rgba(255,255,255,0.06)', 
              paddingBottom: '6px', 
              marginBottom: '8px',
              color: isSubjectModified ? '#38bdf8' : 'inherit'
            }}>
              <strong>Subject:</strong> <span>{modifiedSubject}</span>
            </div>
            <div style={{ 
              fontSize: '0.82rem', 
              whiteSpace: 'pre-wrap', 
              color: isBodyModified ? '#38bdf8' : 'hsl(var(--text-secondary))',
              lineHeight: '1.4' 
            }}>
              {modifiedBody}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAuditHistory = () => {
    if (auditLoading) return <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Loading audit trials...</p>;
    if (auditLogs.length === 0) return <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>No audit history records available.</p>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
        {auditLogs.map(log => {
          let changes = null;
          try {
            changes = JSON.parse(log.changes || '{}');
          } catch {
            changes = null;
          }

          return (
            <div key={log.id} style={{ fontSize: '0.82rem', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--text-secondary))' }}>
                <strong>{log.user_name} ({log.action})</strong>
                <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              {log.new_status && (
                <div style={{ color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                  Status transition: <span className="badge badge-manager" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>{log.old_status || 'none'}</span> ➜ <span className="badge badge-communicator" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>{log.new_status}</span>
                </div>
              )}
              {changes && Object.keys(changes).length > 0 && (
                <div style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.78rem', marginTop: '4px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.02)', padding: '4px 6px', borderRadius: '4px' }}>
                  {Object.keys(changes).map(field => (
                    <div key={field}>
                      - {field}: {changes[field].old !== undefined ? `${String(changes[field].old)} ➜ ` : ''}<strong>{String(changes[field].new)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ padding: '8px 4px' }}>
      <div style={{ display: 'flex', gap: '24px' }}>
        
        {/* Left Side: Pending Campaigns Queue */}
        <div style={{ flex: '1', maxWidth: '320px', minWidth: '280px' }}>
          <GlassCard style={{ padding: '16px', height: '100%', minHeight: '600px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', fontWeight: 700 }}>
              Pending Inbox ({pendingCampaigns.length})
            </h3>
            {loading && pendingCampaigns.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', marginTop: '24px' }}>Scanning approvals...</p>
            ) : pendingCampaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>Approvals queue is clear! No campaigns pending.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingCampaigns.map(camp => (
                  <div
                    key={camp.id}
                    onClick={() => setSelectedCamp(camp)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: selectedCamp?.id === camp.id ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.04)',
                      background: selectedCamp?.id === camp.id ? 'rgba(0, 212, 255, 0.04)' : 'rgba(255,255,255,0.01)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '0.92rem', color: selectedCamp?.id === camp.id ? 'hsl(var(--primary))' : 'inherit' }}>
                      {camp.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                      Type: {getCampaignTypeLabel(camp.campaign_type)}
                    </div>
                    <div style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '8px' }}>
                      <span>Target: {camp.target_audience_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Side: Detailed Compare & Approve Panel */}
        <div style={{ flex: '2' }}>
          {selectedCamp ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Campaign Summary & Cost Card */}
              <GlassCard style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                  <div>
                    <span className="badge" style={{ background: 'hsl(35, 92%, 50%)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                      Requires Administrator Verification
                    </span>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '8px 0 4px 0' }}>{selectedCamp.title}</h2>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', margin: 0 }}>{selectedCamp.description || 'No description supplied.'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', display: 'block' }}>Estimated Cost</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>${selectedCamp.estimated_cost}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Audience Segment</span>
                    <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>
                      {getSegmentName(selectedCamp.segment_id)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Target Size / Reach</span>
                    <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>
                      {selectedCamp.target_audience_count} users ({selectedCamp.estimated_reach} reachable)
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Channels Requested</span>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      {selectedCamp.channel_preferences.map(ch => (
                        <span key={ch} style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', textTransform: 'uppercase' }}>{ch}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Launch Schedule</span>
                    <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px', color: selectedCamp.scheduled_at ? 'hsl(var(--primary))' : 'inherit' }}>
                      {selectedCamp.scheduled_at ? new Date(selectedCamp.scheduled_at).toLocaleString() : 'Immediate Dispatch'}
                    </strong>
                  </div>
                </div>
              </GlassCard>

              {/* Template Modifications Comparison (Diff Check) */}
              <GlassCard style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', fontWeight: 700 }}>Message Design Comparative Diffs</h3>
                <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: '0 0 12px 0' }}>Inspect the modifications proposed by the creator against baseline defaults.</p>
                {renderTemplateDiff()}
              </GlassCard>

              {/* Audit trail / Change History */}
              <GlassCard style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px 0', fontWeight: 700 }}>Audit & Proposal Log Trails</h3>
                {renderAuditHistory()}
              </GlassCard>

              {/* Approval & Review Comments Panel */}
              <GlassCard style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 12px 0', fontWeight: 700 }}>Reviewer Governance Assessment</h3>
                
                {actionError && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
                    ⚠️ {actionError}
                  </div>
                )}
                {actionSuccess && (
                  <div className="alert alert-success" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
                    ✅ {actionSuccess}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.88rem' }}>Review/Decision Comments (Mandatory for rejection)</label>
                  <textarea
                    rows={3}
                    className="text-input"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="e.g. Approved: Copy reviewed and compliance verified. OR Rejected: Emergency alert text has duplicate warnings."
                    style={{ resize: 'vertical', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-danger"
                    disabled={actionLoading}
                    onClick={handleReject}
                    style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 20px', cursor: 'pointer', borderRadius: '8px', fontWeight: 600 }}
                  >
                    Reject Campaign
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={actionLoading}
                    onClick={handleApprove}
                    style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '10px 20px', cursor: 'pointer', borderRadius: '8px', fontWeight: 600 }}
                  >
                    {actionLoading ? 'Approving...' : 'Approve for Broadcast'}
                  </button>
                </div>
              </GlassCard>

            </div>
          ) : (
            <GlassCard style={{ padding: '40px', textAlign: 'center', minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
              <div>
                <span style={{ fontSize: '3rem' }}>📋</span>
                <h3 style={{ margin: '12px 0 6px 0', fontWeight: 700 }}>No Campaign Selected</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Choose a campaign from the pending inbox queue to perform review.</p>
              </div>
            </GlassCard>
          )}
        </div>

      </div>
    </div>
  );
};

export default Approvals;
