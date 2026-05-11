import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const MAX = 15;

export default function SignupPage() {
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [maybeLoading, setMaybeLoading] = useState(false);

  // Manage signup section
  const [showManage, setShowManage] = useState(false);
  const [managePhone, setManagePhone] = useState('');
  const [manageMessage, setManageMessage] = useState(null);
  const [manageUrl, setManageUrl] = useState(null);
  const [manageLoading, setManageLoading] = useState(false);

  async function fetchList() {
    try {
      const { ok, data } = await apiFetch('/signup');
      if (ok) setList(data);
    } catch {
      setList(null);
    }
  }

  useEffect(() => { fetchList(); }, []);

  async function handleSignup(e, maybe = false) {
    e.preventDefault();
    maybe ? setMaybeLoading(true) : setLoading(true);
    setMessage(null);
    try {
      const { ok, data } = await apiFetch('/signup', {
        method: 'POST',
        body: JSON.stringify({ name, phone, maybe, note }),
      });
      if (ok) {
        setMessage({ type: 'success', text: data.message });
        setName(''); setPhone(''); setNote('');
        fetchList();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong. Try again.' });
    } finally {
      setLoading(false);
      setMaybeLoading(false);
    }
  }

  async function handleLookupPhone(e) {
    e.preventDefault();
    setManageLoading(true);
    setManageMessage(null);
    setManageUrl(null);
    try {
      const { ok, data } = await apiFetch('/signup/manage-by-phone', {
        method: 'POST',
        body: JSON.stringify({ phone: managePhone }),
      });
      if (ok) {
        setManageUrl(data.manageUrl);
      } else {
        setManageMessage({ type: 'error', text: data.error });
      }
    } catch {
      setManageMessage({ type: 'error', text: 'Something went wrong. Try again.' });
    } finally {
      setManageLoading(false);
    }
  }

  const confirmedCount = list ? list.confirmedCount : 0;
  const maybeCount = list ? list.maybeCount : 0;
  const confirmedPct = Math.min((confirmedCount / MAX) * 100, 100);
  const maybePct = Math.min((maybeCount / MAX) * 100, 100 - confirmedPct);
  const isFull = list?.full;

  const mondayLabel = list?.weekOf
    ? new Date(list.weekOf + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div className="container">
      <h1>🏀 Monday Hoops</h1>
      <p style={{ marginBottom: '1.5rem' }}>7:30 – 9:30 PM &nbsp;·&nbsp; {mondayLabel}</p>

      {/* Spots bar + player list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600 }}>
            {confirmedCount} confirmed
            {maybeCount > 0 && <span style={{ color: 'var(--yellow)', fontWeight: 400 }}> · {maybeCount} maybe</span>}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {MAX}</span>
          </span>
          <span className={`badge ${isFull ? 'badge-full' : 'badge-open'}`}>
            {isFull ? 'Full' : 'Open'}
          </span>
        </div>
        <div className="spots-bar">
          <div className={`spots-bar-fill${isFull && maybeCount === 0 ? ' full' : ''}`} style={{ width: `${confirmedPct}%` }} />
          <div className="spots-bar-fill maybe" style={{ width: `${maybePct}%` }} />
        </div>

        {/* Confirmed — 2 columns */}
        {list && list.signups.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem', marginTop: '0.75rem' }}>
            {list.signups.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', padding: '0.45rem 0' }}>
                <span className="player-number">{i + 1}</span>
                <div style={{ flex: 1, paddingLeft: '0.5rem' }}>
                  <div style={{ fontSize: '0.95rem' }}>{s.name}</div>
                  {s.note && <div className="subtext" style={{ fontSize: '0.75rem', marginTop: '0.1rem' }}>{s.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Maybes — 2 columns */}
        {list && list.maybes && list.maybes.length > 0 && (
          <>
            <p className="subtext" style={{ marginTop: '1rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>Maybes</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              {list.maybes.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', padding: '0.45rem 0' }}>
                  <div style={{ flex: 1, color: 'var(--yellow)', fontSize: '0.95rem' }}>
                    {s.name}
                    {s.note && <div className="subtext" style={{ fontSize: '0.75rem', marginTop: '0.1rem', color: 'var(--text-muted)' }}>{s.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {list && list.count === 0 && (
          <p className="subtext" style={{ marginTop: '0.5rem' }}>No one signed up yet. Be first!</p>
        )}
      </div>

      {/* Signup form */}
      {!isFull && (
        <div className="card">
          <h2>Sign me up</h2>
          {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
          <form onSubmit={handleSignup}>
            <label htmlFor="name">First and last name</label>
            <input id="name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
            <label htmlFor="phone">Phone number</label>
            <input id="phone" type="tel" placeholder="(555) 555-5555" value={phone} onChange={e => setPhone(e.target.value)} required autoComplete="tel" />
            <label htmlFor="note">Note <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input id="note" type="text" placeholder="e.g. might be a few minutes late" value={note} onChange={e => setNote(e.target.value)} maxLength={120} />
            <p className="subtext" style={{ marginBottom: '1rem' }}>
              Need to update or cancel? Enter your phone number below.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary" disabled={loading || maybeLoading} style={{ flex: 2 }}>
                {loading ? 'Signing up...' : "I'm in!"}
              </button>
              <button type="button" className="btn-maybe" disabled={loading || maybeLoading} style={{ flex: 1 }} onClick={e => handleSignup(e, true)}>
                {maybeLoading ? '...' : 'Maybe'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isFull && (
        <div className="card">
          <div className="alert alert-error">The game is full this week. Check back next week!</div>
        </div>
      )}

      {/* Manage signup section */}
      <div className="card">
        <button
          className="btn-secondary btn-sm"
          style={{ marginBottom: showManage ? '1rem' : 0 }}
          onClick={() => { setShowManage(v => !v); setManageMessage(null); setManageUrl(null); }}
        >
          {showManage ? 'Hide' : 'Manage your signup'}
        </button>

        {showManage && (
          <>
            {!manageUrl ? (
              <form onSubmit={handleLookupPhone}>
                {manageMessage && <div className={`alert alert-${manageMessage.type}`}>{manageMessage.text}</div>}
                <label htmlFor="manage-phone">Enter your phone number</label>
                <input
                  id="manage-phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={managePhone}
                  onChange={e => setManagePhone(e.target.value)}
                  required
                />
                <button type="submit" className="btn-secondary" style={{ width: '100%' }} disabled={manageLoading}>
                  {manageLoading ? 'Looking up...' : 'Find my signup'}
                </button>
              </form>
            ) : (
              <div>
                <p className="subtext" style={{ marginBottom: '0.75rem' }}>Found your signup — click below to manage it.</p>
                <a href={manageUrl} className="btn-primary" style={{ display: 'block', textAlign: 'center', padding: '0.75rem', borderRadius: '6px', textDecoration: 'none' }}>
                  Update or cancel my spot →
                </a>
              </div>
            )}
          </>
        )}
      </div>

      <p className="subtext" style={{ textAlign: 'center' }}>
        <a href="/admin">Admin</a>
      </p>
    </div>
  );
}
