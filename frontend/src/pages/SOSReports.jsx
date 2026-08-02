import React, { useState, useEffect, useCallback } from 'react';
import GlassCard from '../components/GlassCard';

export default function SOSReports({ user, backendUrl, headers, setActiveTab }) {
  const isAudience = user?.role === 'audience';
  const isOperator = user?.role === 'admin' || user?.role === 'campaign_manager';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states (Citizen)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState('medical');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationName, setLocationName] = useState('');
  const [reporterName, setReporterName] = useState(user?.full_name || '');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState(user?.email || '');
  const [locLoading, setLocLoading] = useState(false);

  // Triage state (Operator)
  const [selectedReport, setSelectedReport] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [triageStatus, setTriageStatus] = useState('reported');
  const [staffReply, setStaffReply] = useState('');
  const [triageLoading, setTriageLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSeedDemoSOSData = async () => {
    setSeeding(true);
    setError('');
    setSuccess('');
    
    const demoReports = [
      {
        title: "🌊 Waterlogging & Flash Flood near Connaught Place Market",
        description: "Torrential downpour has caused sudden waterlogging up to 2.5 feet near CP. Stalled vehicles are blocking intersections, and water is starting to enter ground-floor shops. Immediate assistance required for water drainage.",
        report_type: "flood",
        latitude: "28.6139",
        longitude: "77.2090",
        location_name: "Block B Crossing, Connaught Place Market, New Delhi",
        reporter_name: "Nikhil Kapur",
        reporter_phone: "9810452391",
        reporter_email: "nikhil.kapur@example.com"
      },
      {
        title: "🚧 Major Roadblock: Collapsed Tree Blocks Linking Road",
        description: "A massive, century-old banyan tree has collapsed completely across all three lanes of Linking Road due to heavy winds. All vehicular traffic is halted. Municipal cleanup staff and traffic redirection police are needed.",
        report_type: "roadblock",
        latitude: "19.0760",
        longitude: "72.8777",
        location_name: "Near National College Intersection, Linking Road, Mumbai",
        reporter_name: "Ananya Deshmukh",
        reporter_phone: "9820381744",
        reporter_email: "ananya.d@example.com"
      },
      {
        title: "🔥 Electrical Street Transformer Burst & Active Fire",
        description: "An electrical street transformer burst after a sudden power surge. Active fire sparks are flying, and there is thick black toxic smoke. Fire brigade has been notified, police barricades are needed to prevent pedestrian access.",
        report_type: "fire",
        latitude: "12.9716",
        longitude: "77.5946",
        location_name: "100ft Road (Opposite Metro Pillar 84), Indiranagar, Bengaluru",
        reporter_name: "Rahul Hegde",
        reporter_phone: "9740283155",
        reporter_email: "rahul.hegde@example.com"
      }
    ];

    try {
      for (const report of demoReports) {
        const response = await fetch(`${backendUrl}/api/sos`, {
          method: 'POST',
          headers: { 
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(report)
        });
        if (!response.ok) {
          throw new Error(`Server returned status code ${response.status}`);
        }
      }
      setSuccess('✅ 3 Realistic Distress Alerts successfully seeded! The emergency queue has been updated.');
      await fetchReports();
    } catch (err) {
      setError(`Failed to seed demo data: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = `${backendUrl}/api/sos`;
      if (isAudience) {
        url = `${backendUrl}/api/sos/mine`;
      } else if (statusFilter) {
        url = `${backendUrl}/api/sos?status_filter=${statusFilter}`;
      }
      
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to load SOS incident tickets.');
      const data = await res.json();
      setReports(data);
      
      // Auto-select first report for operators if none selected
      if (isOperator && data.length > 0 && !selectedReport) {
        setSelectedReport(data[0]);
        setTriageStatus(data[0].status);
        setStaffReply(data[0].staff_reply || '');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, headers, isAudience, isOperator, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Grab location GPS
  const handleGrabLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocationName(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setLocLoading(false);
      },
      (err) => {
        console.error(err);
        alert('Could not retrieve GPS coordinates. Please enter location manually.');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Submit SOS (Citizen)
  const handleSOSSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please enter Title and Description details.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${backendUrl}/api/sos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          report_type: reportType,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          location_name: locationName.trim(),
          reporter_name: reporterName.trim(),
          reporter_phone: reporterPhone.trim(),
          reporter_email: reporterEmail.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Distress signal submission failed.');
      }
      setSuccess('🚨 Emergency SOS Report submitted successfully. Response operators have been notified.');
      
      // Reset form
      setTitle('');
      setDescription('');
      setLatitude('');
      setLongitude('');
      setLocationName('');
      setReporterPhone('');
      
      fetchReports();
    } catch (err) {
      setError(err.message);
    }
  };

  // Triage incident update (Operator)
  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    setTriageLoading(true);
    setError('');
    try {
      const res = await fetch(`${backendUrl}/api/sos/${selectedReport.id}/triage`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: triageStatus,
          staff_reply: staffReply.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit triage updates.');
      }
      setSuccess('Incident status and dispatch reply updated successfully!');
      setSelectedReport(data);
      fetchReports();
    } catch (err) {
      setError(err.message);
    } finally {
      setTriageLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '8px 4px', paddingBottom: '32px' }}>
      
      {/* Title & Description Banner */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            🚨 Public SOS reporting & Emergency Triage Queue
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.88rem', margin: '6px 0 0', lineHeight: 1.5 }}>
            {isAudience 
              ? 'Report live public hazards, roadblock incidents, or medical situations. You can automatically share your current GPS coordinates to assist emergency dispatchers.'
              : 'Operational triage workspace. Monitor incoming distress reports, coordinate emergency contacts, post replies, and update the status of active public incidents.'}
          </p>
        </div>
        <button
          onClick={handleSeedDemoSOSData}
          disabled={seeding}
          className="btn btn-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.25) 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            fontWeight: 800,
            fontSize: '0.85rem',
            padding: '8px 16px',
            borderRadius: '24px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)'
          }}
        >
          {seeding ? '🌱 Seeding...' : '🌱 Seed Demo SOS Alerts'}
        </button>
      </div>

      {error && (
        <div className="glass-card danger-text" style={{ padding: '16px', marginBottom: '20px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="glass-card success-text" style={{ padding: '16px', marginBottom: '20px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.05)' }}>
          ✓ {success}
        </div>
      )}

      {/* CITIZEN INTERFACE */}
      {isAudience && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* Submit form */}
          <GlassCard style={{ padding: '24px' }}>
            <h4 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '16px', color: 'hsl(var(--danger))' }}>Report Emergency Hazard</h4>
            <form onSubmit={handleSOSSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Incident Title / Topic</label>
                <input
                  type="text"
                  className="text-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Major Flooding on Main Street"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Incident Type</label>
                  <select
                    className="text-input"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  >
                    <option value="fire">🔥 Fire / Wildfire</option>
                    <option value="flood">🌊 Flood / Water logging</option>
                    <option value="medical">🚑 Medical Emergency</option>
                    <option value="roadblock">🚧 Roadblock / Tree Fall</option>
                    <option value="other">⚠️ Other Safety Hazard</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>GPS Location Coordinates</label>
                  <button
                    type="button"
                    onClick={handleGrabLocation}
                    disabled={locLoading}
                    className="btn btn-dark"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '10px', height: '40px', fontWeight: 'bold' }}
                  >
                    {locLoading ? 'Fetching Location...' : '📍 Share Current GPS'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Latitude</label>
                  <input
                    type="text"
                    className="text-input"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 28.6139"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Longitude</label>
                  <input
                    type="text"
                    className="text-input"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 77.2090"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Location Name / Landmark</label>
                <input
                  type="text"
                  className="text-input"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Near Sector-15 Metro Station gate"
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Hazard / Distress Description</label>
                <textarea
                  rows={4}
                  className="text-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the severity, damage, roadblock depth, or status of victims..."
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Reporter Name</label>
                  <input
                    type="text"
                    className="text-input"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Contact Phone</label>
                  <input
                    type="text"
                    className="text-input"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', background: 'hsl(var(--danger))', borderColor: 'hsl(var(--danger))', color: '#fff', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '8px' }}
              >
                🚨 BroadCast Distress Alert (SOS)
              </button>
            </form>
          </GlassCard>

          {/* Incident logs history */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <GlassCard style={{ padding: '24px' }}>
              <h4 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '16px' }}>My Distress Incident Reports</h4>
              {loading && reports.length === 0 ? (
                <p style={{ color: 'hsl(var(--text-muted))' }}>Scanning incident history...</p>
              ) : reports.length === 0 ? (
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.88rem' }}>No SOS reports filed by you yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '600px', overflowY: 'auto' }}>
                  {reports.map(r => {
                    let badgeColor = 'rgba(245, 158, 11, 0.15)';
                    let badgeText = 'Reported';
                    let textColor = '#f59e0b';
                    
                    if (r.status === 'acknowledged') {
                      badgeColor = 'rgba(59, 130, 246, 0.15)';
                      badgeText = 'Acknowledged';
                      textColor = '#3b82f6';
                    } else if (r.status === 'resolved') {
                      badgeColor = 'rgba(16, 185, 129, 0.15)';
                      badgeText = 'Resolved';
                      textColor = '#10b981';
                    }

                    return (
                      <div
                        key={r.id}
                        style={{
                          padding: '16px',
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{r.title}</strong>
                          <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', background: badgeColor, color: textColor, fontWeight: 'bold' }}>
                            {badgeText}
                          </span>
                        </div>

                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                          {r.description}
                        </p>

                        <div style={{ fontSize: '0.78rem', display: 'flex', gap: '12px', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                          <span>Type: <b style={{ textTransform: 'capitalize' }}>{r.report_type}</b></span>
                          <span>Location: <b>{r.location_name}</b></span>
                        </div>

                        {r.staff_reply && (
                          <div style={{ 
                            marginTop: '8px', 
                            padding: '10px 12px', 
                            background: 'rgba(59, 130, 246, 0.03)', 
                            borderLeft: '3px solid #3b82f6',
                            borderRadius: '4px',
                            fontSize: '0.8rem' 
                          }}>
                            <span style={{ display: 'block', fontWeight: 'bold', marginBottom: '2px', color: 'hsl(var(--text-secondary))' }}>Operator Dispatch Reply:</span>
                            <span style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>{r.staff_reply}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {/* OPERATOR INTERFACE */}
      {isOperator && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Triage list sidebar */}
          <GlassCard style={{ padding: '16px', minHeight: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <h4 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>Incident Queue</h4>
              <select
                className="text-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ fontSize: '0.75rem', padding: '2px 4px', width: '110px' }}
              >
                <option value="">All Tickets</option>
                <option value="reported">Reported</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {loading && reports.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-muted))' }}>Scanning tickets...</p>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>Queue is empty. No active hazard tickets.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto' }}>
                {reports.map(r => {
                  const isSelected = selectedReport?.id === r.id;
                  let badgeColor = 'rgba(245, 158, 11, 0.15)';
                  let textColor = '#f59e0b';
                  
                  if (r.status === 'acknowledged') {
                    badgeColor = 'rgba(59, 130, 246, 0.15)';
                    textColor = '#3b82f6';
                  } else if (r.status === 'resolved') {
                    badgeColor = 'rgba(16, 185, 129, 0.15)';
                    textColor = '#10b981';
                  }

                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setSelectedReport(r);
                        setTriageStatus(r.status);
                        setStaffReply(r.staff_reply || '');
                      }}
                      style={{
                        padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                        background: isSelected ? 'rgba(239, 68, 68, 0.06)' : 'rgba(255,255,255,0.01)',
                        border: `1.5px solid ${isSelected ? 'hsl(var(--danger))' : 'rgba(255,255,255,0.05)'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', textTransform: 'capitalize', color: 'hsl(var(--text-muted))' }}>{r.report_type}</span>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: badgeColor, color: textColor, fontWeight: 'bold' }}>
                          {r.status}
                        </span>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', marginTop: '4px' }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                        Location: {r.location_name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Details & Response workspace */}
          <div>
            {selectedReport ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <GlassCard style={{ padding: '24px' }}>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge" style={{ background: 'hsl(var(--danger))', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
                        SOS INCIDENT DISPATCH DECK
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                        Reported At: {new Date(selectedReport.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '12px 0 6px 0' }}>{selectedReport.title}</h3>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                      {selectedReport.description}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Location Landmark</span>
                      <strong style={{ display: 'block', fontSize: '0.92rem', marginTop: '2px' }}>{selectedReport.location_name}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>GPS Coordinates</span>
                      <strong style={{ display: 'block', fontSize: '0.92rem', marginTop: '2px' }}>
                        {selectedReport.latitude && selectedReport.longitude 
                          ? `${selectedReport.latitude}, ${selectedReport.longitude}`
                          : 'Not Provided'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Reporter Profile</span>
                      <strong style={{ display: 'block', fontSize: '0.92rem', marginTop: '2px' }}>
                        {selectedReport.reporter_name || 'Anonymous citizen'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Contact Channels</span>
                      <strong style={{ display: 'block', fontSize: '0.92rem', marginTop: '2px', color: 'var(--primary)' }}>
                        {selectedReport.reporter_phone || selectedReport.reporter_email || 'None Provided'}
                      </strong>
                    </div>
                  </div>
                </GlassCard>

                {/* Triage action inputs */}
                <GlassCard style={{ padding: '24px' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '16px' }}>Incident Triage Reply & Status Update</h4>
                  
                  <form onSubmit={handleTriageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Triage State</label>
                      <select
                        className="text-input"
                        value={triageStatus}
                        onChange={(e) => setTriageStatus(e.target.value)}
                        style={{}}
                      >
                        <option value="reported">Reported (Pending review)</option>
                        <option value="acknowledged">Acknowledged (Dispatch team notified)</option>
                        <option value="resolved">Resolved (Safety hazard cleared)</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Staff Response / Instructions Reply</label>
                      <textarea
                        rows={4}
                        className="text-input"
                        value={staffReply}
                        onChange={(e) => setStaffReply(e.target.value)}
                        placeholder="e.g. Police team dispatched to direct traffic. Please avoid the underpass."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={triageLoading}
                      className="btn btn-primary"
                      style={{ padding: '10px 20px', fontWeight: 'bold', fontSize: '0.92rem', width: '220px', alignSelf: 'flex-end' }}
                    >
                      {triageLoading ? 'Updating triage...' : '✓ Submit Response Update'}
                    </button>
                  </form>
                </GlassCard>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                🏥 Select an incoming emergency SOS ticket from the sidebar list to inspect details and deploy dispatch response coordinates.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
