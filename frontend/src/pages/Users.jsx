import React, { useState, useEffect, useCallback } from 'react';
import GlassCard from '../components/GlassCard';

const Users = ({ user: currentUser, backendUrl, headers }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [message, setMessage] = useState(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'reset_pwd'
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('communicator');
  const [formOrg, setFormOrg] = useState('');
  const [formDesig, setFormDesig] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${backendUrl}/api/users`;
      const params = [];
      if (filterRole) params.push(`role=${encodeURIComponent(filterRole)}`);
      if (filterActive !== '') params.push(`is_active=${filterActive}`);
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to load user directory');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error loading user directory.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [backendUrl, headers, filterRole, filterActive, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Open modals
  const handleOpenCreate = () => {
    setModalType('create');
    setSelectedUser(null);
    setFormEmail('');
    setFormFullName('');
    setFormPassword('');
    setFormRole('communicator');
    setFormOrg('');
    setFormDesig('');
    setFormActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setModalType('edit');
    setSelectedUser(u);
    setFormEmail(u.email);
    setFormFullName(u.full_name);
    setFormPassword('');
    setFormRole(u.role);
    setFormOrg(u.organization || '');
    setFormDesig(u.designation || '');
    setFormActive(u.is_active);
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenResetPwd = (u) => {
    setModalType('reset_pwd');
    setSelectedUser(u);
    setFormPassword('');
    setFormError('');
    setModalOpen(true);
  };

  // Submit forms
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (modalType === 'create') {
        const response = await fetch(`${backendUrl}/api/users`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formEmail,
            full_name: formFullName,
            password: formPassword,
            role: formRole,
            organization: formOrg,
            designation: formDesig,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to create operator');
        }

        setMessage({ text: `Operator ${formFullName} created successfully!`, type: 'success' });
        setModalOpen(false);
        fetchUsers();
      } else if (modalType === 'edit') {
        const response = await fetch(`${backendUrl}/api/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: formFullName,
            role: formRole,
            organization: formOrg,
            designation: formDesig,
            is_active: formActive,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to update operator details');
        }

        setMessage({ text: 'Operator profile updated successfully!', type: 'success' });
        setModalOpen(false);
        fetchUsers();
      } else if (modalType === 'reset_pwd') {
        if (!formPassword || formPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        const response = await fetch(`${backendUrl}/api/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: formPassword }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to reset password');
        }

        setMessage({ text: `Password reset successfully for ${selectedUser.full_name}!`, type: 'success' });
        setModalOpen(false);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (u) => {
    if (u.id === currentUser.id) {
      setMessage({ text: 'You cannot deactivate your own administrator account.', type: 'danger' });
      return;
    }

    if (!window.confirm(`Are you sure you want to deactivate ${u.full_name}?`)) return;

    try {
      const response = await fetch(`${backendUrl}/api/users/${u.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to deactivate operator');
      }

      setMessage({ text: `Operator ${u.full_name} deactivated successfully.`, type: 'success' });
      fetchUsers();
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="badge badge-admin">Admin</span>;
      case 'campaign_manager':
        return <span className="badge badge-manager">Manager</span>;
      default:
        return <span className="badge badge-communicator">Staff</span>;
    }
  };

  // Stats calculation
  const totalOperators = users.length;
  const activeCount = users.filter(u => u.is_active).length;
  const managerCount = users.filter(u => u.role === 'campaign_manager' && u.is_active).length;

  return (
    <div className="tab-container animate-fade-in" style={{ padding: '8px 4px' }}>
      <div className="tab-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>User Directory</h2>
          <p style={{ margin: '4px 0 0 0', color: 'hsl(var(--text-secondary))', fontSize: '0.95rem' }}>
            Manage staff credentials, platform roles, and authorization policies.
          </p>
        </div>
      </div>

      {message && (
        <div 
          className={`alert alert-${message.type} animate-slide-left`} 
          style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{message.text}</span>
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Stats Counter Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <GlassCard>
          <div style={{ padding: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>Total Operators</span>
            <h3 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 0 0' }}>{totalOperators}</h3>
          </div>
        </GlassCard>
        <GlassCard>
          <div style={{ padding: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>Active Accounts</span>
            <h3 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 0 0', color: '#10b981' }}>{activeCount}</h3>
          </div>
        </GlassCard>
        <GlassCard>
          <div style={{ padding: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>Campaign Managers</span>
            <h3 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 0 0', color: '#3b82f6' }}>{managerCount}</h3>
          </div>
        </GlassCard>
      </div>

      {/* Filters & Search */}
      <GlassCard style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search operators by name, email, organization..."
              className="text-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }}>🔍</span>
          </div>

          <div style={{ minWidth: '150px' }}>
            <select className="select-input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">All System Roles</option>
              <option value="admin">Administrator</option>
              <option value="campaign_manager">Campaign Manager</option>
              <option value="communicator">Communicator</option>
            </select>
          </div>

          <div style={{ minWidth: '150px' }}>
            <select className="select-input" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Deactivated Only</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Operator Table list */}
      <GlassCard style={{ overflow: 'hidden' }}>
        {loading && users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
            Querying directory records...
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
            No operators found matching the criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Operator Details</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Organization</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Designation</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr 
                    key={u.id} 
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      opacity: u.is_active ? 1 : 0.6,
                      background: !u.is_active ? 'rgba(239,68,68,0.01)' : 'transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>{u.full_name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '16px' }}>{getRoleBadge(u.role)}</td>
                    <td style={{ padding: '16px' }}>{u.organization || <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>—</span>}</td>
                    <td style={{ padding: '16px' }}>{u.designation || <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>—</span>}</td>
                    <td style={{ padding: '16px' }}>
                      {u.is_active ? (
                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600 }}>
                          <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>
                          Active
                        </span>
                      ) : (
                        <span style={{ color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                          <span style={{ width: '8px', height: '8px', background: 'hsl(var(--text-secondary))', borderRadius: '50%' }}></span>
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="secondary-btn" onClick={() => handleOpenEdit(u)} style={{ padding: '6px 12px', fontSize: '0.8rem' }} title="Edit Profile Details">
                          Edit
                        </button>
                        <button className="secondary-btn" onClick={() => handleOpenResetPwd(u)} style={{ padding: '6px 12px', fontSize: '0.8rem' }} title="Change/Reset password">
                          Key
                        </button>
                        {u.is_active && u.id !== currentUser.id && (
                          <button 
                            className="danger-text-btn" 
                            onClick={() => handleDeactivate(u)} 
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.8rem', 
                              border: '1px solid rgba(239, 68, 68, 0.2)', 
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.05)',
                              cursor: 'pointer'
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* invite/edit Modal Dialog */}
      {modalOpen && (
        <div className="modal-backdrop animate-fade-in" style={{ zIndex: 100 }}>
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.3rem' }}>
                {modalType === 'create' ? 'Invite New Operator' : modalType === 'edit' ? 'Edit Operator Details' : 'Reset Account Password'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'hsl(var(--text-secondary))' }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
              {formError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
                  ⚠️ {formError}
                </div>
              )}

              {modalType !== 'reset_pwd' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>Full Name</label>
                    <input 
                      type="text" 
                      required 
                      className="text-input" 
                      value={formFullName} 
                      onChange={(e) => setFormFullName(e.target.value)} 
                      placeholder="e.g. Riyanshi Sharma"
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>Email Address</label>
                    <input 
                      type="email" 
                      required 
                      disabled={modalType === 'edit'}
                      className="text-input" 
                      value={formEmail} 
                      onChange={(e) => setFormEmail(e.target.value)} 
                      placeholder="operator@comm.ai"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>Organization</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        value={formOrg} 
                        onChange={(e) => setFormOrg(e.target.value)} 
                        placeholder="e.g. Disaster Response"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>Designation</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        value={formDesig} 
                        onChange={(e) => setFormDesig(e.target.value)} 
                        placeholder="e.g. Field Officer"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>System Role</label>
                    <select 
                      className="select-input" 
                      value={formRole} 
                      onChange={(e) => setFormRole(e.target.value)}
                    >
                      <option value="communicator">Communicator (Write / Edit Templates)</option>
                      <option value="campaign_manager">Campaign Manager (Plan & Schedule)</option>
                      <option value="admin">Administrator (Full Access & Settings)</option>
                    </select>
                  </div>
                </>
              )}

              {(modalType === 'create' || modalType === 'reset_pwd') && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '6px' }}>
                    {modalType === 'create' ? 'Set Password' : 'New Password'}
                  </label>
                  <input 
                    type="password" 
                    required 
                    className="text-input" 
                    value={formPassword} 
                    onChange={(e) => setFormPassword(e.target.value)} 
                    placeholder="Min 6 characters"
                  />
                </div>
              )}

              {modalType === 'edit' && selectedUser && selectedUser.id !== currentUser.id && (
                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    id="formActiveCheck"
                    checked={formActive} 
                    onChange={(e) => setFormActive(e.target.checked)}
                  />
                  <label htmlFor="formActiveCheck" style={{ fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}>Active Operator Account</label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button type="button" className="secondary-btn" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Processing...' : modalType === 'create' ? 'Create Operator' : modalType === 'edit' ? 'Save Changes' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
