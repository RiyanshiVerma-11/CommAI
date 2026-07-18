import React, { useEffect, useRef, useState, useCallback } from 'react';
import GlassCard from '../components/GlassCard';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SentimentMap = ({ user, backendUrl, headers }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    total: 0,
    critical: 0,
    urgent: 0,
    normal: 0,
  });

  const [theme, setTheme] = useState(document.documentElement.classList.contains('light-theme') ? 'light' : 'dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.classList.contains('light-theme') ? 'light' : 'dark';
      setTheme(currentTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/sentiment-map/data`, { headers });
      if (!response.ok) {
        throw new Error('Failed to load geographic sentiment map data');
      }
      const data = await response.json();
      setMapData(data);

      // Compute summary metrics
      let total = 0, critical = 0, urgent = 0, normal = 0;
      data.forEach(item => {
        total += item.total;
        critical += item.critical_count;
        urgent += item.urgent_count;
        normal += item.normal_count;
      });

      setSummary({ total, critical, urgent, normal });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map initialization and updates
  useEffect(() => {
    if (loading || error || !mapContainerRef.current) return;

    // Initialize Leaflet map centered on India if not already initialized
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [22.9734, 78.6569], // Central India coordinates
        zoom: 5,
        minZoom: 4,
        maxZoom: 8,
      });

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;

    // Update tile layer based on current theme
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const isLight = theme === 'light';
    const tileUrl = isLight 
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Clear existing markers
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }

    // Add circle markers for states
    mapData.forEach((state) => {
      if (!state.lat || !state.lng) return;

      // Color mapping: Red (critical), Amber (concerning/urgent), Green (stable)
      let color = 'hsl(142, 72%, 45%)'; // Stable Green
      if (state.sentiment === 'critical') {
        color = 'hsl(0, 84%, 60%)'; // Critical Red
      } else if (state.sentiment === 'concerning') {
        color = 'hsl(38, 92%, 50%)'; // Concerning Amber
      }

      // Radius scaled exponentially between 8 and 30
      const radius = Math.min(30, Math.max(8, 8 + Math.log2(state.total) * 4));

      const circle = L.circleMarker([state.lat, state.lng], {
        radius,
        fillColor: color,
        color: isLight ? '#fff' : '#000',
        weight: 1.5,
        opacity: 0.8,
        fillOpacity: 0.6,
      });

      // Construct popup HTML using theme variables
      const popupHtml = `
        <div style="font-family: var(--font-body), sans-serif; color: hsl(var(--text-primary)); padding: 4px; line-height: 1.4;">
          <h4 style="margin: 0 0 6px; font-size: 0.95rem; font-weight: 700; color: ${color}; border-bottom: 1px solid var(--border-color-glass); padding-bottom: 4px;">
            ${state.state}
          </h4>
          <div style="font-size: 0.8rem; margin-bottom: 8px;">
            <div><strong>Total Alerts:</strong> ${state.total}</div>
            <div style="color: hsl(0, 84%, 60%);">🚨 Critical: ${state.critical_count}</div>
            <div style="color: hsl(38, 92%, 55%);">⚠️ Urgent: ${state.urgent_count}</div>
            <div style="color: hsl(142, 72%, 50%);">✓ Normal: ${state.normal_count}</div>
          </div>
          <div style="font-size: 0.72rem; opacity: 0.8;">
            <strong>Recent Issues:</strong>
            <ul style="margin: 4px 0 0; padding-left: 14px; list-style-type: circle;">
              ${state.recent_subjects.map(sub => `<li style="margin-bottom: 2px;">${sub}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;

      circle.bindPopup(popupHtml, {
        className: 'glass-leaflet-popup',
        closeButton: false,
        maxWidth: 240,
      });

      circle.on('mouseover', function (e) {
        this.openPopup();
      });

      markersGroupRef.current.addLayer(circle);
    });

  }, [mapData, loading, error, theme]);

  // Inject Leaflet popup customized styles into the head
  useEffect(() => {
    const styleId = 'leaflet-popup-override-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .glass-leaflet-popup .leaflet-popup-content-wrapper {
          background: rgba(13, 16, 28, 0.94) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
          border-radius: 12px !important;
        }
        .glass-leaflet-popup .leaflet-popup-tip {
          background: rgba(13, 16, 28, 0.94) !important;
          border-left: 1px solid rgba(255,255,255,0.06) !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (loading) {
    return <div style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', padding: '40px', fontWeight: 600 }}>Assembling Geographic Sentiment Maps...</div>;
  }

  if (error) {
    return <div className="danger-text" style={{ padding: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)' }}>Error loading maps: {error}</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '24px', height: '620px' }}>
        
        {/* Map View Card */}
        <GlassCard style={{ padding: '16px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 8px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'hsl(var(--text-primary))' }}>India Real-time Emergency Clusters</h3>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--accent))', display: 'inline-block' }}></span>
              Live Sentiment Feeds
            </span>
          </div>

          <div
            ref={mapContainerRef}
            style={{
              flex: 1,
              width: '100%',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border-color-glass)',
              background: 'transparent'
            }}
          ></div>
        </GlassCard>

        {/* Stats and Urgency Breakdown Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <GlassCard style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '16px', color: 'hsl(var(--primary))' }}>
              Platform Sentiment Summary
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: 'var(--border-color-glass)' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Active Alarms</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(var(--text-primary))' }}>{summary.total}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--danger))', fontWeight: '600' }}>🚨 Critical Cases</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(var(--danger))' }}>{summary.critical}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(38, 92%, 55%)', fontWeight: '600' }}>⚠️ Urgent Issues</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(38, 92%, 55%)' }}>{summary.urgent}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(142, 72%, 50%)', fontWeight: '600' }}>✓ Normal Status</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(142, 72%, 50%)' }}>{summary.normal}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px', color: 'hsl(var(--text-primary))' }}>
              Incident Metrics by State
            </h4>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {mapData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px', fontSize: '0.8rem' }}>
                  No emergency locations registered.
                </div>
              ) : (
                mapData.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'var(--border-color-glass)',
                      fontSize: '0.8rem',
                      borderLeft: `3px solid ${
                        item.sentiment === 'critical'
                          ? 'hsl(0, 84%, 60%)'
                          : item.sentiment === 'concerning'
                          ? 'hsl(38, 92%, 50%)'
                          : 'hsl(142, 72%, 45%)'
                      }`
                    }}
                  >
                    <span style={{ fontWeight: '600' }}>{item.state}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                      {item.total}
                      {item.critical_count > 0 && <span style={{ color: 'hsl(var(--danger))', fontSize: '0.72rem' }}>({item.critical_count}🚨)</span>}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

        </div>
      </div>
    </div>
  );
};

export default SentimentMap;
