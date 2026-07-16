import React, { useState, useEffect, useRef, useCallback } from 'react';
import GlassCard from '../components/GlassCard';

const Audiences = ({ user, backendUrl, headers }) => {
  // Navigation states: 'list', 'import', 'segment_builder'
  const [subTab, setSubTab] = useState('list');
  const fileInputRef = useRef(null);

  // Constants seeded from config
  const languages = ["English", "Hindi", "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", "Kannada", "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri", "Marathi", "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi", "Tamil", "Telugu", "Urdu"];
  const occupations = ["Farmer", "Student", "Teacher", "Healthcare Worker", "NGO Worker", "Administrator", "General Public", "Business Owner"];
  const channels = ["email", "sms", "whatsapp", "push", "website"];

  // --- 1. AUDIENCE LIST STATES ---
  const [audiences, setAudiences] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterLang, setFilterLang] = useState('');
  const [filterOcc, setFilterOcc] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterGender, setFilterGender] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formFirst, setFormFirst] = useState('');
  const [formLast, setFormLast] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLangs, setFormLangs] = useState([]);
  const [formOcc, setFormOcc] = useState('General Public');
  const [formAge, setFormAge] = useState(30);
  const [formGender, setFormGender] = useState('Male');
  const [formState, setFormState] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formDesig, setFormDesig] = useState('');
  const [formChannels, setFormChannels] = useState(['email']);
  const [formError, setFormError] = useState('');
  const [formCustomFields, setFormCustomFields] = useState([]); // Array of { key: '', value: '' }

  // --- 2. CSV IMPORT STATES ---
  const [csvFile, setCsvFile] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // --- 3. SEGMENT BUILDER STATES ---
  const [segName, setSegName] = useState('');
  const [segDesc, setSegDesc] = useState('');
  const [segLang, setSegLang] = useState('');
  const [segOccs, setSegOccs] = useState([]);
  const [segStates, setSegStates] = useState('');
  const [segAgeGte, setSegAgeGte] = useState('');
  const [segAgeLte, setSegAgeLte] = useState('');
  const [segGenders, setSegGenders] = useState([]);
  const [segLogic, setSegLogic] = useState('AND');
  const [segSize, setSegSize] = useState(null);
  const [segPreview, setSegPreview] = useState([]);
  const [segBreakdowns, setSegBreakdowns] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [savedSegments, setSavedSegments] = useState([]);

  // Fetch Audiences
  const fetchAudiences = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${backendUrl}/api/audiences?skip=${page * 15}&limit=15`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (filterLang) url += `&language=${encodeURIComponent(filterLang)}`;
      if (filterOcc) url += `&occupation=${encodeURIComponent(filterOcc)}`;
      if (filterState) url += `&state=${encodeURIComponent(filterState)}`;
      if (filterGender) url += `&gender=${encodeURIComponent(filterGender)}`;

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to load audiences');
      const data = await response.json();
      setAudiences(data.results);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, headers, page, search, filterLang, filterOcc, filterState, filterGender]);

  // Fetch Saved Segments
  const fetchSavedSegments = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/segments`, { headers });
      if (response.ok) {
        const data = await response.json();
        setSavedSegments(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [backendUrl, headers]);

  useEffect(() => {
    if (subTab === 'list') {
      fetchAudiences();
    } else if (subTab === 'segment_builder') {
      fetchSavedSegments();
    }
  }, [fetchAudiences, fetchSavedSegments, subTab]);

  // Handle CRUD
  const handleOpenAdd = () => {
    setEditId(null);
    setFormFirst('');
    setFormLast('');
    setFormEmail('');
    setFormPhone('');
    setFormLangs(['English']);
    setFormOcc('General Public');
    setFormAge(30);
    setFormGender('Male');
    setFormState('');
    setFormDistrict('');
    setFormCity('');
    setFormOrg('');
    setFormDept('');
    setFormDesig('');
    setFormChannels(['email']);
    setFormCustomFields([]);
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (aud) => {
    setEditId(aud.id);
    setFormFirst(aud.first_name);
    setFormLast(aud.last_name);
    setFormEmail(aud.email || '');
    setFormPhone(aud.phone);
    setFormLangs(aud.preferred_languages);
    setFormOcc(aud.occupation);
    setFormAge(aud.age);
    setFormGender(aud.gender);
    setFormState(aud.state);
    setFormDistrict(aud.district);
    setFormCity(aud.city);
    setFormOrg(aud.organization || '');
    setFormDept(aud.department || '');
    setFormDesig(aud.designation || '');
    setFormChannels(aud.preferred_channels);
    setFormCustomFields(aud.custom_fields ? Object.entries(aud.custom_fields).map(([k, v]) => ({ key: k, value: String(v) })) : []);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveAudience = async (e) => {
    e.preventDefault();
    if (!formFirst || !formLast || !formPhone || !formState || !formDistrict || !formCity) {
      setFormError('Mandatory fields missing (First name, Last name, Phone, State, District, City required)');
      return;
    }
    setFormError('');

    const customFieldsDict = {};
    formCustomFields.forEach(f => {
      if (f.key.trim()) {
        customFieldsDict[f.key.trim()] = f.value;
      }
    });

    const payload = {
      first_name: formFirst,
      last_name: formLast,
      email: formEmail || null,
      phone: formPhone,
      preferred_languages: formLangs,
      occupation: formOcc,
      age: parseInt(formAge),
      gender: formGender,
      state: formState,
      district: formDistrict,
      city: formCity,
      organization: formOrg || null,
      department: formDept || null,
      designation: formDesig || null,
      preferred_channels: formChannels,
      custom_fields: customFieldsDict,
      is_active: true
    };

    try {
      const url = editId ? `${backendUrl}/api/audiences/${editId}` : `${backendUrl}/api/audiences`;
      const method = editId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save audience profile');
      }

      setModalOpen(false);
      fetchAudiences();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDeleteAudience = async (id) => {
    if (!window.confirm('Are you sure you want to soft delete this audience member?')) return;
    try {
      const response = await fetch(`${backendUrl}/api/audiences/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Delete failed');
      }
      fetchAudiences();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAutoTag = async (id) => {
    try {
      const response = await fetch(`${backendUrl}/api/audiences/${id}/auto-tag`, {
        method: 'POST',
        headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'AI auto-tagging failed');
      alert(`AI auto-tagged citizen with: ${data.tags.join(', ')}`);
      fetchAudiences();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAutoTagAll = async () => {
    if (!window.confirm('Do you want to run AI classification on all active citizens? This might take a few seconds.')) return;
    try {
      const response = await fetch(`${backendUrl}/api/audiences/auto-tag-all`, {
        method: 'POST',
        headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Batch auto-tagging failed');
      alert(data.message);
      fetchAudiences();
    } catch (err) {
      alert(err.message);
    }
  };

  // CSV Import
  const handleCSVImport = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      setImportError('Please select a valid CSV file');
      return;
    }
    setImportError('');
    setImportLoading(true);
    setImportReport(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const response = await fetch(`${backendUrl}/api/audiences/import`, {
        method: 'POST',
        headers: { 'Authorization': headers['Authorization'] },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'CSV Upload failed');
      }

      setImportReport(data);
      setCsvFile(null);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // Segment Criteria Evaluator
  const compileCriteria = () => {
    const crit = { logic: segLogic };
    if (segLang) crit.language = segLang;
    if (segOccs.length > 0) crit.occupations = segOccs;
    
    if (segStates) {
      crit.states = segStates.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (segAgeGte) crit.age_gte = parseInt(segAgeGte);
    if (segAgeLte) crit.age_lte = parseInt(segAgeLte);
    if (segGenders.length > 0) crit.genders = segGenders;
    
    return crit;
  };

  const handleEvaluateSegment = async () => {
    setEvaluating(true);
    setSaveMessage('');
    const criteria = compileCriteria();

    try {
      const response = await fetch(`${backendUrl}/api/segments/evaluate`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria)
      });
      const data = await response.json();
      if (!response.ok) throw new Error('Evaluation failed');
      
      setSegSize(data.estimated_size);
      setSegPreview(data.preview);
      setSegBreakdowns(data.breakdowns);
    } catch (err) {
      alert(err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handlePreviewSegment = async (id) => {
    try {
      const response = await fetch(`${backendUrl}/api/segments/${id}/preview`, { headers });
      if (!response.ok) throw new Error('Failed to load segment preview');
      const data = await response.json();
      setSegSize(data.estimated_size);
      setSegPreview(data.preview);
      setSegBreakdowns(data.breakdowns);
      setSegName('');
      setSegDesc('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveSegment = async (e) => {
    e.preventDefault();
    if (!segName) {
      setSaveMessage('⚠️ Segment name is required');
      return;
    }
    const criteria = compileCriteria();

    const payload = {
      name: segName,
      description: segDesc || null,
      filter_criteria: criteria,
      is_dynamic: true
    };

    try {
      const response = await fetch(`${backendUrl}/api/segments`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Saving failed');
      }

      setSaveMessage(`Segment '${data.name}' saved with size ${data.estimated_size}`);
      setSegName('');
      setSegDesc('');
      fetchSavedSegments();
    } catch (err) {
      setSaveMessage('⚠️ ' + err.message);
    }
  };

  const handleCheckLang = (lang) => {
    setFormLangs(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleCheckChannel = (ch) => {
    setFormChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const toggleSegOcc = (occ) => {
    setSegOccs(prev => 
      prev.includes(occ) ? prev.filter(o => o !== occ) : [...prev, occ]
    );
  };

  const toggleSegGender = (gen) => {
    setSegGenders(prev =>
      prev.includes(gen) ? prev.filter(g => g !== gen) : [...prev, gen]
    );
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Audience & Segments</h1>
          <p style={{ color: 'hsl(var(--text-secondary))' }}>Manage target citizen demographics and dynamic filter criteria.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className={`btn ${subTab === 'list' ? 'btn-primary' : 'btn-dark'}`} onClick={() => setSubTab('list')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.95rem', height: '0.95rem' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Directory
          </button>
          <button className={`btn ${subTab === 'import' ? 'btn-primary' : 'btn-dark'}`} onClick={() => setSubTab('import')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.95rem', height: '0.95rem' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            CSV Bulk Import
          </button>
          <button className={`btn ${subTab === 'segment_builder' ? 'btn-primary' : 'btn-dark'}`} onClick={() => setSubTab('segment_builder')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.95rem', height: '0.95rem' }}>
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            Segment Builder
          </button>
        </div>
      </div>

      {/* --- SUBTAB: LIST --- */}
      {subTab === 'list' && (
        <GlassCard>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search name, email, phone..."
              style={{ minWidth: '240px', flexGrow: 1 }}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
            
            <select className="form-control" value={filterLang} onChange={(e) => { setFilterLang(e.target.value); setPage(0); }}>
              <option value="">All Languages</option>
              {languages.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <select className="form-control" value={filterOcc} onChange={(e) => { setFilterOcc(e.target.value); setPage(0); }}>
              <option value="">All Occupations</option>
              {occupations.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            <input
              type="text"
              className="form-control"
              placeholder="State (e.g. Punjab)"
              value={filterState}
              onChange={(e) => { setFilterState(e.target.value); setPage(0); }}
            />

            <select className="form-control" value={filterGender} onChange={(e) => { setFilterGender(e.target.value); setPage(0); }}>
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            {['admin', 'campaign_manager'].includes(user.role) && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1.1rem', height: '1.1rem' }}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add Profile</span>
                </button>
                <button 
                  className="btn btn-dark" 
                  onClick={handleAutoTagAll} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#a855f7' }}
                >
                  <span>✨ AI Auto-Tag All</span>
                </button>
              </div>
            )}
          </div>

          <div className="table-container">
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                Fetching database records...
              </div>
            ) : audiences.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '32px' }}>
                No matching profiles found in database.
              </p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact Info</th>
                    <th>Languages</th>
                    <th>Details</th>
                    <th>Location</th>
                    <th>AI Classification Tags</th>
                    <th>Preferred Channels</th>
                    {['admin', 'campaign_manager'].includes(user.role) && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {audiences.map(aud => (
                    <tr key={aud.id}>
                      <td style={{ fontWeight: '700', color: 'hsl(var(--text-primary))' }}>{aud.first_name} {aud.last_name}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '10px', height: '10px' }}>
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            {aud.phone}
                          </span>
                          {aud.email && (
                            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '10px', height: '10px' }}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </svg>
                              {aud.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {aud.preferred_languages.map(l => (
                            <span key={l} style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'var(--border-color-glass)', color: 'hsl(var(--text-primary))', fontWeight: '700', borderRadius: '100px' }}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', gap: '4px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '10px', height: '10px' }}>
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                            </svg>
                            {aud.occupation}
                          </span>
                          <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: '600' }}>{aud.age} yrs • {aud.gender}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', gap: '4px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                            <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '10px', height: '10px' }}>
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            {aud.city}
                          </span>
                          <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: '600' }}>{aud.district}, {aud.state}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(() => {
                            let custom = {};
                            try {
                              custom = typeof aud.custom_fields === 'string' ? JSON.parse(aud.custom_fields) : (aud.custom_fields || {});
                            } catch(e) {}
                            if (custom && custom.ai_tags && custom.ai_tags.length > 0) {
                              return custom.ai_tags.map(t => (
                                <span key={t} style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '4px', fontWeight: '700' }}>
                                    {t}
                                </span>
                              ));
                            }
                            return <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', fontStyle: 'italic', fontWeight: '600' }}>Not tagged yet</span>;
                          })()}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {aud.preferred_channels.map(c => (
                            <span key={c} style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'rgba(79, 110, 238, 0.1)', color: 'hsl(var(--primary))', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      {['admin', 'campaign_manager'].includes(user.role) && (
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-dark" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => handleOpenEdit(aud)} title="Edit Profile">
                              <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1rem', height: '1rem' }}>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                              </svg>
                            </button>
                            <button className="btn btn-dark" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc' }} onClick={() => handleAutoTag(aud.id)} title="AI Auto-Tag Profile">
                              ✨ Tag
                            </button>
                            {user.role === 'admin' && (
                              <button className="btn btn-danger" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', background: 'rgba(244, 63, 94, 0.15)' }} onClick={() => handleDeleteAudience(aud.id)} title="Delete Profile">
                                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1rem', height: '1rem', color: 'hsl(var(--danger))' }}>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
            <span style={{ color: 'hsl(var(--text-muted))' }}>
              Showing {audiences.length} of {total} records
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-dark" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                Previous
              </button>
              <button className="btn btn-dark" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 15 >= total}>
                Next
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {subTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <GlassCard>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Bulk Audience CSV Uploader</h2>
            <p style={{ marginBottom: '20px', color: 'hsl(var(--text-secondary))' }}>
              Upload citizen databases. The file must be structured as CSV containing headers: <br/>
              <code>first_name, last_name, email, phone, preferred_languages, occupation, age, gender, state, district, city, preferred_channels</code>
            </p>

            <div style={{ marginBottom: '24px' }}>
              <a 
                href={`${backendUrl}/api/audiences/import/template`} 
                download
                className="btn btn-dark"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}
              >
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.9rem', height: '0.9rem' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Sample CSV Template
              </a>
            </div>

            {importError && (
              <div className="glass-card danger-text" style={{ padding: '12px 16px', marginBottom: '20px', background: 'rgba(244, 63, 94, 0.1)', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.1rem', height: '1.1rem', marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {importError}
              </div>
            )}

            <div 
              className={`csv-dropzone ${csvFile ? 'active' : ''}`}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('drag-over');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const file = e.dataTransfer.files[0];
                  if (file.name.endsWith('.csv')) {
                    setCsvFile(file);
                    setImportError('');
                  } else {
                    setImportError('Please drop a valid CSV file.');
                  }
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".csv" 
                onChange={(e) => setCsvFile(e.target.files[0])}
                disabled={importLoading}
              />
              <div className="dropzone-icon-container">
                <svg className="svg-icon" style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              {csvFile ? (
                <div>
                  <p style={{ color: 'hsl(var(--primary))', fontWeight: '600', fontSize: '1rem' }}>Selected: {csvFile.name}</p>
                  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Click to select a different file</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: '600', fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>Drag & drop your CSV file here, or click to browse</p>
                  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '6px' }}>Supports standard citizen CSV databases</p>
                </div>
              )}
            </div>

            {csvFile && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCSVImport} 
                  disabled={importLoading}
                  style={{ padding: '12px 24px', fontSize: '0.95rem' }}
                >
                  <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.1rem', height: '1.1rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {importLoading ? 'Importing Batch...' : 'Validate & Import File'}
                </button>
              </div>
            )}
          </GlassCard>

          {importReport && (
            <GlassCard>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'hsl(var(--text-primary))' }}>
                Import Validation Report Summary
              </h2>
              <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                <div className="glass-card success-text" style={{ padding: '16px 24px', flexGrow: 1, background: 'rgba(16, 185, 129, 0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>SUCCESS COUNT</span>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{importReport.success_count}</span>
                </div>
                <div className="glass-card danger-text" style={{ padding: '16px 24px', flexGrow: 1, background: 'rgba(244, 63, 94, 0.05)' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>FAILED COUNT</span>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{importReport.fail_count}</span>
                </div>
              </div>

              {importReport.errors.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Errors Logs ({importReport.errors.length})</h3>
                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                      <thead>
                        <tr>
                          <th>Row No.</th>
                          <th>Row Preview Info</th>
                          <th>Rejection Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importReport.errors.map((err, idx) => (
                          <tr key={idx}>
                            <td className="danger-text" style={{ fontWeight: 'bold' }}>Row {err.row}</td>
                            <td>
                              <code style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px' }}>
                                {JSON.stringify(err.data)}
                              </code>
                            </td>
                            <td className="danger-text">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}

      {/* --- SUBTAB: SEGMENT BUILDER --- */}
      {subTab === 'segment_builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Builder Criteria */}
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.2rem', height: '1.2rem', color: 'hsl(var(--primary))' }}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              Custom Logic Criteria
            </h2>

            <div className="form-group">
              <label className="form-label">Language Preference</label>
              <select className="form-control" value={segLang} onChange={(e) => setSegLang(e.target.value)}>
                <option value="">Any Language</option>
                {languages.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Filter Occupations</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '10px' }}>
                {occupations.map(occ => (
                  <label key={occ} style={{ display: 'flex', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', alignItems: 'center' }}>
                    <input type="checkbox" checked={segOccs.includes(occ)} onChange={() => toggleSegOcc(occ)} />
                    {occ}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Filter States (Comma Separated)</label>
              <input type="text" className="form-control" placeholder="e.g. Punjab, Uttar Pradesh" value={segStates} onChange={(e) => setSegStates(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Age Range</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input type="number" className="form-control" placeholder="Min" value={segAgeGte} onChange={(e) => setSegAgeGte(e.target.value)} style={{ width: '50%' }} />
                <input type="number" className="form-control" placeholder="Max" value={segAgeLte} onChange={(e) => setSegAgeLte(e.target.value)} style={{ width: '50%' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Gender</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['Male', 'Female', 'Other'].map(g => (
                  <label key={g} style={{ display: 'flex', gap: '6px', cursor: 'pointer', alignItems: 'center' }}>
                    <input type="checkbox" checked={segGenders.includes(g)} onChange={() => toggleSegGender(g)} />
                    {g}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Logical Join Mode</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', gap: '6px', cursor: 'pointer', alignItems: 'center' }}>
                  <input type="radio" checked={segLogic === 'AND'} onChange={() => setSegLogic('AND')} /> AND
                </label>
                <label style={{ display: 'flex', gap: '6px', cursor: 'pointer', alignItems: 'center' }}>
                  <input type="radio" checked={segLogic === 'OR'} onChange={() => setSegLogic('OR')} /> OR
                </label>
              </div>
            </div>

            <button type="button" className="btn btn-secondary" onClick={handleEvaluateSegment} disabled={evaluating} style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.05rem', height: '1.05rem' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              {evaluating ? 'Evaluating Size...' : 'Test Query Filter'}
            </button>
          </GlassCard>

          {/* Results Preview & Saved Segments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {segSize !== null && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem' }}>Dynamic Match Output</h2>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
                      Previewing matched audience list based on criteria logic.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', display: 'block', fontWeight: 'bold' }}>TARGET SIZE</span>
                    <span className="success-text" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'hsl(var(--accent))' }}>
                      {segSize} Members
                    </span>
                  </div>
                </div>

                {segBreakdowns && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.015)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Languages</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(segBreakdowns.languages || {}).slice(0, 4).map(([lang, count]) => {
                          const pct = segSize > 0 ? Math.round((count / segSize) * 100) : 0;
                          return (
                            <div key={lang} style={{ fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span>{lang}</span>
                                <span style={{ fontWeight: 'bold', color: 'hsl(var(--primary))' }}>{pct}% ({count})</span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '100px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))', borderRadius: '100px' }}></div>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(segBreakdowns.languages || {}).length === 0 && <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>No data</span>}
                      </div>
                    </div>
                    
                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Occupations</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(segBreakdowns.occupations || {}).slice(0, 4).map(([occ, count]) => {
                          const pct = segSize > 0 ? Math.round((count / segSize) * 100) : 0;
                          return (
                            <div key={occ} style={{ fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span>{occ}</span>
                                <span style={{ fontWeight: 'bold', color: 'hsl(var(--accent))' }}>{pct}% ({count})</span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '100px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(187, 92%, 50%))', borderRadius: '100px' }}></div>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(segBreakdowns.occupations || {}).length === 0 && <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>No data</span>}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>States</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(segBreakdowns.states || {}).slice(0, 4).map(([state, count]) => {
                          const pct = segSize > 0 ? Math.round((count / segSize) * 100) : 0;
                          return (
                            <div key={state} style={{ fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span>{state}</span>
                                <span style={{ fontWeight: 'bold', color: 'hsl(var(--primary))' }}>{pct}% ({count})</span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '100px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(187, 92%, 50%))', borderRadius: '100px' }}></div>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(segBreakdowns.states || {}).length === 0 && <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>No data</span>}
                      </div>
                    </div>
                  </div>
                )}

                {segPreview.length === 0 ? (
                  <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px' }}>
                    No recipient records match the selected criteria logic.
                  </p>
                ) : (
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>First {segPreview.length} Matching Profiles:</h3>
                    <div className="table-container">
                      <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>State</th>
                            <th>Occupation</th>
                            <th>Age/Gender</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segPreview.map(p => (
                            <tr key={p.id}>
                              <td><strong>{p.first_name} {p.last_name}</strong></td>
                              <td>{p.phone}</td>
                              <td>{p.state}</td>
                              <td>{p.occupation}</td>
                              <td>{p.age} yrs • {p.gender}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {['admin', 'campaign_manager'].includes(user.role) && (
                      <form onSubmit={handleSaveSegment} style={{ display: 'flex', gap: '12px', marginTop: '24px', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                        <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                          <label className="form-label">Save as Segment Name</label>
                          <input type="text" className="form-control" placeholder="e.g. Ludhiana Tomato Farmers" value={segName} onChange={(e) => setSegName(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ flexGrow: 2, marginBottom: 0 }}>
                          <label className="form-label">Description (Optional)</label>
                          <input type="text" className="form-control" placeholder="Tomato farmers segment in Ludhiana district" value={segDesc} onChange={(e) => setSegDesc(e.target.value)} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1rem', height: '1rem' }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                          Save Segment
                        </button>
                      </form>
                    )}
                    {saveMessage && <p style={{ marginTop: '12px', fontSize: '0.9rem', color: 'hsl(var(--primary))', fontWeight: '500' }}>{saveMessage}</p>}
                  </div>
                )}
              </GlassCard>
            )}

            <GlassCard>
              <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.2rem', height: '1.2rem', color: 'hsl(var(--primary))' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Existing Saved Segments
              </h2>
              {savedSegments.length === 0 ? (
                <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px 0' }}>
                  No saved segments found. Create one above!
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {savedSegments.map(seg => (
                    <div key={seg.id} className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.015)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '1.05rem', color: 'hsl(var(--primary))' }}>{seg.name}</strong>
                        <span className="badge badge-manager">{seg.estimated_size} Members</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', marginBottom: '12px', color: 'hsl(var(--text-secondary))' }}>
                        {seg.description || 'No description provided.'}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                          Refreshed: {new Date(seg.last_refreshed).toLocaleDateString()}
                        </span>
                        <button 
                          className="btn btn-dark" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                          onClick={() => {
                            handlePreviewSegment(seg.id);
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }}
                        >
                          Load Visuals
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT MODAL --- */}
      {modalOpen && (
        <div className="modal-overlay">
          <GlassCard className="modal-content animate-fade-in">
            <h2 style={{ fontSize: '1.35rem', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              {editId ? '✏️ Edit Recipient Profile' : '👥 Create Audience Profile'}
            </h2>
            {formError && (
              <div className="glass-card danger-text" style={{ padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem', background: 'rgba(244, 63, 94, 0.1)', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1.1rem', height: '1.1rem', marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveAudience}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input type="text" className="form-control" value={formFirst} onChange={(e) => setFormFirst(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input type="text" className="form-control" value={formLast} onChange={(e) => setFormLast(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input type="text" className="form-control" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="e.g. +919876543210" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. sita@health.org" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Occupation</label>
                  <select className="form-control" value={formOcc} onChange={(e) => setFormOcc(e.target.value)}>
                    {occupations.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Age *</label>
                  <input type="number" className="form-control" value={formAge} onChange={(e) => setFormAge(e.target.value)} min="0" max="120" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-control" value={formGender} onChange={(e) => setFormGender(e.target.value)}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">State *</label>
                  <input type="text" className="form-control" value={formState} onChange={(e) => setFormState(e.target.value)} required placeholder="e.g. Uttar Pradesh" />
                </div>
                <div className="form-group">
                  <label className="form-label">District *</label>
                  <input type="text" className="form-control" value={formDistrict} onChange={(e) => setFormDistrict(e.target.value)} required placeholder="e.g. Varanasi" />
                </div>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input type="text" className="form-control" value={formCity} onChange={(e) => setFormCity(e.target.value)} required placeholder="e.g. Varanasi" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Organization</label>
                  <input type="text" className="form-control" value={formOrg} onChange={(e) => setFormOrg(e.target.value)} placeholder="e.g. Public Health NGO" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input type="text" className="form-control" value={formDept} onChange={(e) => setFormDept(e.target.value)} placeholder="e.g. Primary Care" />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input type="text" className="form-control" value={formDesig} onChange={(e) => setFormDesig(e.target.value)} placeholder="e.g. Nurse Practitioner" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Languages (Choose multiple)</label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', maxHeight: '90px', overflowY: 'auto', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '10px' }}>
                  {languages.slice(0, 10).map(lang => (
                    <label key={lang} style={{ display: 'flex', gap: '4px', fontSize: '0.85rem', cursor: 'pointer', alignItems: 'center' }}>
                      <input type="checkbox" checked={formLangs.includes(lang)} onChange={() => handleCheckLang(lang)} />
                      {lang}
                    </label>
                  ))}
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>+ more official languages seeded</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Channels</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {channels.map(ch => (
                    <label key={ch} style={{ display: 'flex', gap: '6px', cursor: 'pointer', alignItems: 'center', textTransform: 'capitalize' }}>
                      <input type="checkbox" checked={formChannels.includes(ch)} onChange={() => handleCheckChannel(ch)} />
                      {ch}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Custom Metadata Fields</label>
                  <button 
                    type="button" 
                    className="btn btn-dark" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto' }}
                    onClick={() => setFormCustomFields(prev => [...prev, { key: '', value: '' }])}
                  >
                    + Add Field
                  </button>
                </div>
                
                {formCustomFields.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', margin: 0, fontStyle: 'italic' }}>
                    No dynamic custom fields configured for this profile.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                    {formCustomFields.map((field, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Key (e.g. Crop)" 
                          value={field.key} 
                          onChange={(e) => {
                            const newFields = [...formCustomFields];
                            newFields[idx].key = e.target.value;
                            setFormCustomFields(newFields);
                          }}
                          style={{ width: '45%' }}
                        />
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Value (e.g. Wheat)" 
                          value={field.value} 
                          onChange={(e) => {
                            const newFields = [...formCustomFields];
                            newFields[idx].value = e.target.value;
                            setFormCustomFields(newFields);
                          }}
                          style={{ width: '45%' }}
                        />
                        <button 
                          type="button" 
                          className="btn btn-danger" 
                          style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.15)', border: 'none', cursor: 'pointer' }}
                          onClick={() => setFormCustomFields(prev => prev.filter((_, i) => i !== idx))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-dark" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg className="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '1rem', height: '1rem' }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  {editId ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default Audiences;
