import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import './sections.css';

export default function SettingsPanel() {
  const [me, setMe]               = useState(null);
  const [loading, setLoading]     = useState(true);
  const [admins, setAdmins]       = useState([]);

  // Change password form
  const [curPw, setCurPw]         = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confPw, setConfPw]       = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg]         = useState({ type: '', text: '' });

  // New admin form
  const [newName, setNewName]     = useState('');
  const [newEmail, setNewEmail]   = useState('');
  const [newPass, setNewPass]     = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regMsg, setRegMsg]       = useState({ type: '', text: '' });

  useEffect(() => {
    Promise.all([api.me(), api.admins()])
      .then(([meData, adminData]) => { setMe(meData); setAdmins(adminData.admins || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPw !== confPw) { setPwMsg({ type: 'error', text: 'Passwords do not match' }); return; }
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'Password must be at least 6 characters' }); return; }
    setPwLoading(true); setPwMsg({ type: '', text: '' });
    try {
      const res = await api.changePassword({ current_password: curPw, new_password: newPw });
      setPwMsg({ type: 'success', text: res.message });
      setCurPw(''); setNewPw(''); setConfPw('');
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    } finally {
      setPwLoading(false);
    }
  }

  async function handleRegisterAdmin(e) {
    e.preventDefault();
    setRegLoading(true); setRegMsg({ type: '', text: '' });
    try {
      const res = await api.signup({ name: newName, email: newEmail, password: newPass });
      setRegMsg({ type: 'success', text: res.message || 'Admin created successfully' });
      setNewName(''); setNewEmail(''); setNewPass('');
      const adminData = await api.admins();
      setAdmins(adminData.admins || []);
    } catch (err) {
      setRegMsg({ type: 'error', text: err.message });
    } finally {
      setRegLoading(false);
    }
  }

  async function handleDeleteAdmin(id, email) {
    if (!window.confirm(`Remove admin "${email}"?`)) return;
    try {
      await api.deleteAdmin(id);
      setAdmins(a => a.filter(x => x.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="adm-loading"><div className="adm-spinner" /><p>Loading settings...</p></div>;

  return (
    <div>
      <div className="sec-header">
        <h1 className="sec-title">Settings</h1>
        <p className="sec-sub">Manage your admin account and team</p>
      </div>

      {/* Profile card */}
      <div className="panel-box" style={{ marginBottom: 24 }}>
        <div className="panel-box-header"><span className="panel-box-title">👤 My Profile</span></div>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: '#fff', flexShrink: 0
          }}>
            {(me?.name?.[0] || 'A').toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{me?.name}</div>
            <div style={{ fontSize: 14, color: 'var(--text-faint)' }}>{me?.email}</div>
            <span className="adm-badge adm-badge--indigo" style={{ marginTop: 8, display: 'inline-flex' }}>
              🛡️ Administrator
            </span>
          </div>
        </div>
      </div>

      <div className="sec-grid-2">
        {/* Change password */}
        <div className="panel-box">
          <div className="panel-box-header"><span className="panel-box-title">🔒 Change Password</span></div>
          <form onSubmit={handleChangePassword} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Current Password', val: curPw, set: setCurPw, ph: 'Enter current password' },
              { label: 'New Password',     val: newPw, set: setNewPw, ph: 'Min 6 characters' },
              { label: 'Confirm New',      val: confPw, set: setConfPw, ph: 'Repeat new password' },
            ].map(({ label, val, set, ph }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                <input
                  type="password"
                  value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={ph}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14 }}
                  required
                />
              </div>
            ))}
            {pwMsg.text && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                background: pwMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${pwMsg.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                color: pwMsg.type === 'success' ? '#86efac' : '#fca5a5',
              }}>
                {pwMsg.text}
              </div>
            )}
            <button type="submit" disabled={pwLoading} style={{
              background: 'var(--grad)', border: 'none', borderRadius: 10, color: '#fff',
              padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: pwLoading ? 0.6 : 1,
            }}>
              {pwLoading ? <><div className="adm-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Updating...</> : '🔒 Update Password'}
            </button>
          </form>
        </div>

        {/* Add admin */}
        <div className="panel-box">
          <div className="panel-box-header"><span className="panel-box-title">➕ Add Admin Account</span></div>
          <form onSubmit={handleRegisterAdmin} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Full Name',  val: newName, set: setNewName,  ph: 'New admin name',  type: 'text' },
              { label: 'Email',      val: newEmail, set: setNewEmail, ph: 'admin@email.com', type: 'email' },
              { label: 'Password',   val: newPass, set: setNewPass,  ph: 'Min 6 characters',type: 'password' },
            ].map(({ label, val, set, ph, type }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                <input
                  type={type}
                  value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={ph}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14 }}
                  required
                />
              </div>
            ))}
            {regMsg.text && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                background: regMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${regMsg.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                color: regMsg.type === 'success' ? '#86efac' : '#fca5a5',
              }}>
                {regMsg.text}
              </div>
            )}
            <button type="submit" disabled={regLoading} style={{
              background: 'var(--grad-green)', border: 'none', borderRadius: 10, color: '#fff',
              padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: regLoading ? 0.6 : 1,
            }}>
              {regLoading ? <><div className="adm-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Creating...</> : '➕ Create Admin'}
            </button>
          </form>
        </div>
      </div>

      {/* Admins list */}
      <div className="panel-box">
        <div className="panel-box-header">
          <span className="panel-box-title">🛡️ Admin Accounts</span>
          <span className="adm-badge adm-badge--indigo">{admins.length}</span>
        </div>
        <table className="adm-table">
          <thead><tr><th>Admin</th><th>Email</th><th>Role</th><th>Joined</th><th>Action</th></tr></thead>
          <tbody>
            {admins.map(a => {
              const initials = (a.name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const joined   = a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN') : '—';
              const isMe     = a.email === me?.email;
              return (
                <tr key={a.id}>
                  <td>
                    <div className="adm-cell-user">
                      <div className="adm-avatar" style={{ background: 'linear-gradient(135deg, #6366f1cc, #6366f144)' }}>{initials}</div>
                      <div className="adm-cell-user-info">
                        <span className="adm-cell-name">{a.name} {isMe && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>(you)</span>}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-faint)' }}>{a.email}</td>
                  <td><span className="adm-badge adm-badge--indigo">🛡️ {a.role}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-faint)' }}>{joined}</td>
                  <td>
                    {!isMe && (
                      <button className="adm-delete-btn" onClick={() => handleDeleteAdmin(a.id, a.email)} title="Remove admin">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
