import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('signups');

  const [signupData, setSignupData] = useState(null);
  const [signupError, setSignupError] = useState('');
  const [players, setPlayers] = useState([]);
  const [rosterError, setRosterError] = useState('');
  const [stats, setStats] = useState([]);
  const [statsError, setStatsError] = useState('');
  const [statsLoaded, setStatsLoaded] = useState(false);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  const adminHeaders = { 'x-admin-password': password };

  const fetchSignups = useCallback(async () => {
    try {
      const { ok, data } = await apiFetch('/admin/signups', { headers: adminHeaders });
      if (ok) setSignupData(data);
      else setSignupError(data.error);
    } catch {
      setSignupError('Failed to load signups.');
    }
  }, [password]);

  const fetchRoster = useCallback(async () => {
    try {
      const { ok, data } = await apiFetch('/admin/players', { headers: adminHeaders });
      if (ok) setPlayers(data.players);
      else setRosterError(data.error);
    } catch {
      setRosterError('Failed to load roster.');
    }
  }, [password]);

  const fetchStats = useCallback(async () => {
    try {
      const { ok, data } = await apiFetch('/admin/stats', { headers: adminHeaders });
      if (ok) { setStats(data.stats); setStatsLoaded(true); }
      else setStatsError(data.error);
    } catch {
      setStatsError('Failed to load stats.');
    }
  }, [password]);

  async function handleLogin(e) {
    e.preventDefault();
    const { ok, data } = await apiFetch('/admin/signups', { headers: { 'x-admin-password': password } });
    if (ok) {
      setAuthed(true);
      setSignupData(data);
    } else {
      setAuthError('Wrong password.');
    }
  }

  useEffect(() => {
    if (!authed) return;
    if (tab === 'signups') fetchSignups();
    if (tab === 'roster') fetchRoster();
    if (tab === 'dashboard') fetchStats();
  }, [authed, tab]);

  async function removeSignup(phone) {
    if (!confirm('Remove this player from this week?')) return;
    await apiFetch(`/admin/signups/${encodeURIComponent(phone)}`, { method: 'DELETE', headers: adminHeaders });
    fetchSignups();
  }

  async function addSignup(e) {
    e.preventDefault();
    setAddError(''); setAddSuccess('');
    const { ok, data } = await apiFetch('/admin/signups', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: newName, phone: newPhone }),
    });
    if (ok) { setAddSuccess('Player added.'); setNewName(''); setNewPhone(''); fetchSignups(); }
    else setAddError(data.error);
  }

  async function toggleOptIn(player) {
    await apiFetch(`/admin/players/${encodeURIComponent(player.phone)}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ opted_in: !player.optedIn }),
    });
    fetchRoster();
  }

  async function deletePlayer(phone) {
    if (!confirm('Remove this player from the roster?')) return;
    await apiFetch(`/admin/players/${encodeURIComponent(phone)}`, { method: 'DELETE', headers: adminHeaders });
    fetchRoster();
  }

  async function deletePlayerAndHistory(phone, name) {
    if (!confirm(`Delete ${name} and all their signup history? This will remove them from the leaderboard and cannot be undone.`)) return;
    await apiFetch(`/admin/players/${encodeURIComponent(phone)}/history`, { method: 'DELETE', headers: adminHeaders });
    fetchRoster();
    setStatsLoaded(false);
    fetchStats();
  }

  async function addPlayer(e) {
    e.preventDefault();
    setAddError(''); setAddSuccess('');
    const { ok, data } = await apiFetch('/admin/players', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: newName, phone: newPhone }),
    });
    if (ok) { setAddSuccess('Player added to roster.'); setNewName(''); setNewPhone(''); fetchRoster(); }
    else setAddError(data.error);
  }

  const mondayLabel = signupData?.weekOf
    ? new Date(signupData.weekOf + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  if (!authed) {
    return (
      <div className="container">
        <h1>🏀 Admin</h1>
        <div className="card">
          <h2>Sign in</h2>
          {authError && <div className="alert alert-error">{authError}</div>}
          <form onSubmit={handleLogin}>
            <label htmlFor="admin-pw">Password</label>
            <input id="admin-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
            <button type="submit" className="btn-primary">Enter</button>
          </form>
          <div style={{ marginTop: '1rem' }}><Link to="/">← Back to signup</Link></div>
        </div>
      </div>
    );
  }

  const activeSignups = signupData?.signups?.filter(s => !s.cancelled) || [];
  const cancelledSignups = signupData?.signups?.filter(s => s.cancelled) || [];

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>🏀 Admin</h1>
        <Link to="/">← Site</Link>
      </div>

      <div className="nav">
        <a href="#" className={tab === 'signups' ? 'active' : ''} onClick={e => { e.preventDefault(); setTab('signups'); }}>
          This Week
        </a>
        <a href="#" className={tab === 'roster' ? 'active' : ''} onClick={e => { e.preventDefault(); setTab('roster'); }}>
          Roster
        </a>
        <a href="#" className={tab === 'dashboard' ? 'active' : ''} onClick={e => { e.preventDefault(); setTab('dashboard'); }}>
          Dashboard
        </a>
      </div>

      {/* ── THIS WEEK ── */}
      {tab === 'signups' && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ marginBottom: 0 }}>{mondayLabel}</h2>
              <span className={`badge ${activeSignups.length >= 15 ? 'badge-full' : 'badge-open'}`}>
                {activeSignups.length} / {signupData?.max || 15}
              </span>
            </div>

            {signupError && <div className="alert alert-error">{signupError}</div>}
            {activeSignups.length === 0 && <p className="subtext">No active signups yet.</p>}

            {activeSignups.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Name</th><th>Phone</th><th>Status</th><th>Signed up</th><th></th></tr>
                  </thead>
                  <tbody>
                    {activeSignups.map((s, i) => (
                      <tr key={s.phone}>
                        <td>{i + 1}</td>
                        <td>{s.name}</td>
                        <td>{s.phone}</td>
                        <td>
                          {s.maybe
                            ? <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: 'var(--yellow)' }}>Maybe</span>
                            : <span className="badge badge-open">In</span>}
                        </td>
                        <td className="subtext">{new Date(s.signedUpAt).toLocaleString()}</td>
                        <td><button className="btn-danger btn-sm" onClick={() => removeSignup(s.phone)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {cancelledSignups.length > 0 && (
              <>
                <h3 style={{ marginTop: '1.5rem' }}>Cancelled</h3>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Phone</th><th>Cancelled at</th></tr></thead>
                    <tbody>
                      {cancelledSignups.map(s => (
                        <tr key={s.phone} className="cancelled-row">
                          <td>{s.name}</td>
                          <td>{s.phone}</td>
                          <td>{s.cancelledAt ? new Date(s.cancelledAt).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h2>Add player manually</h2>
            {addError && <div className="alert alert-error">{addError}</div>}
            {addSuccess && <div className="alert alert-success">{addSuccess}</div>}
            <form onSubmit={addSignup}>
              <label>Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Player name" />
              <label>Phone</label>
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} required placeholder="(555) 555-5555" />
              <button type="submit" className="btn-primary">Add to this week</button>
            </form>
          </div>
        </>
      )}

      {/* ── ROSTER ── */}
      {tab === 'roster' && (
        <>
          <div className="card">
            <h2>Player Roster</h2>
            <p className="subtext" style={{ marginBottom: '1rem' }}>Toggle to control who receives weekly reminder emails.</p>
            {rosterError && <div className="alert alert-error">{rosterError}</div>}
            {players.length === 0 && <p className="subtext">No players in roster yet.</p>}
            {players.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Phone</th><th>Reminders</th><th></th></tr></thead>
                  <tbody>
                    {players.map(p => (
                      <tr key={p.phone}>
                        <td>{p.name}</td>
                        <td>{p.phone}</td>
                        <td>
                          <label className="toggle" aria-label={`Toggle reminders for ${p.name}`}>
                            <input type="checkbox" checked={!!p.optedIn} onChange={() => toggleOptIn(p)} />
                            <span className="toggle-slider" />
                          </label>
                        </td>
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-danger btn-sm" onClick={() => deletePlayer(p.phone)}>Remove</button>
                          <button className="btn-danger btn-sm" style={{ opacity: 0.7 }} onClick={() => deletePlayerAndHistory(p.phone, p.name)}>+ History</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Add to roster</h2>
            {addError && <div className="alert alert-error">{addError}</div>}
            {addSuccess && <div className="alert alert-success">{addSuccess}</div>}
            <form onSubmit={addPlayer}>
              <label>Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Player name" />
              <label>Phone</label>
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} required placeholder="(555) 555-5555" />
              <button type="submit" className="btn-primary">Add to roster</button>
            </form>
          </div>
        </>
      )}

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div className="card">
          <h2>Attendance</h2>
          <p className="subtext" style={{ marginBottom: '1rem' }}>
            All-time stats based on confirmed signups. Sorted by games played.
          </p>
          {statsError && <div className="alert alert-error">{statsError}</div>}
          {!statsLoaded && !statsError && <p className="subtext">Loading...</p>}
          {statsLoaded && stats.length === 0 && <p className="subtext">No data yet.</p>}
          {statsLoaded && stats.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Games</th>
                    <th>Streak</th>
                    <th>Best</th>
                    <th>Last played</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((p, i) => (
                    <tr key={p.phone}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td>{p.name}</td>
                      <td style={{ fontWeight: 600 }}>{p.total}</td>
                      <td>
                        {p.currentStreak > 0 ? (
                          <span style={{ color: p.currentStreak >= 3 ? 'var(--orange)' : 'var(--text)' }}>
                            {p.currentStreak} {p.currentStreak >= 3 ? '🔥' : ''}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.longestStreak}</td>
                      <td className="subtext">
                        {p.lastPlayed
                          ? new Date(p.lastPlayed + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td>
                        <button className="btn-danger btn-sm" onClick={() => deletePlayerAndHistory(p.phone, p.name)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
