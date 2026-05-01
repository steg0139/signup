import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const MAX = 15;

export default function SignupPage() {
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cancelPhone, setCancelPhone] = useState('');
  const [message, setMessage] = useState(null);
  const [cancelMessage, setCancelMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [maybeLoading, setMaybeLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  async function fetchList() {
    try {
      const { ok, data } = await apiFetch('/signup');
      if (ok) setList(data);
    } catch {
      setList(null);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  async function handleSignup(e, maybe = false) {
    e.preventDefault();
    maybe ? setMaybeLoading(true) : setLoading(true);
    setMessage(null);
    try {
      const { ok, data } = await apiFetch('/signup', {
        method: 'POST',
        body: JSON.stringify({ name, phone, maybe }),
      });
      if (ok) {
        setMessage({ type: 'success', text: data.message });
        setName('');
        setPhone('');
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

  async function handleCancelByPhone(e) {
    e.preventDefault();
    setCancelLoading(true);
    setCancelMessage(null);
    try {
      const { ok, data } = await apiFetch('/signup/cancel-by-phone', {
        method: 'POST',
        body: JSON.stringify({ phone: cancelPhone }),
      });
      if (ok) {
        setCancelMessage({ type: 'success', text: data.message });
        setCancelPhone('');
        fetchList();
      } else {
        setCancelMessage({ type: 'error', text: data.error });
      }
    } catch {
      setCancelMessage({ type: 'error', text: 'Something went wrong. Try again.' });
    } finally {
      setCancelLoading(false);
    }
  }

  const filled = list ? list.count : 0;
  const confirmedCount = list ? list.confirmedCount : 0;
  const maybeCount = list ? list.maybeCount : 0;
  const confirmedPct = Math.min((confirmedCount / MAX) * 100, 100);
  const maybePct = Math.min((maybeCount / MAX) * 100, 100 - confirmedPct);
  const isFull = list?.full;

  // Format the Monday date nicely
  const mondayLabel = list?.weekOf
    ? new Date(list.weekOf + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="container">
      <h1>🏀 Monday Hoops</h1>
      <p style={{ marginBottom: '1.5rem' }}>7:30 – 9:30 PM &nbsp;·&nbsp; {mondayLabel}</p>

      {/* Spots bar */}
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
          <div
            className={`spots-bar-fill${isFull && maybeCount === 0 ? ' full' : ''}`}
            style={{ width: `${confirmedPct}%` }}
          />
          <div
            className="spots-bar-fill maybe"
            style={{ width: `${maybePct}%` }}
          />
        </div>

        {/* Confirmed list */}
        {list && list.signups.length > 0 && (
          <ul className="player-list" style={{ marginTop: '0.75rem' }}>
            {list.signups.map((s, i) => (
              <li key={s.id}>
                <span className="player-number">{i + 1}</span>
                <span className="player-name">{s.name}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Maybes list */}
        {list && list.maybes && list.maybes.length > 0 && (
          <>
            <p className="subtext" style={{ marginTop: '1rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>Maybes</p>
            <ul className="player-list maybe-list">
              {list.maybes.map(s => (
                <li key={s.id}>
                  <span className="player-name" style={{ paddingLeft: 0, color: 'var(--yellow)' }}>{s.name}</span>
                </li>
              ))}
            </ul>
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
          {message && (
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          )}
          <form onSubmit={handleSignup}>
            <label htmlFor="name">First and last name</label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
            />
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
            <p className="subtext" style={{ marginBottom: '1rem' }}>
              Need to cancel? Use the link below or enter your phone number.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary" disabled={loading || maybeLoading} style={{ flex: 2 }}>
                {loading ? 'Signing up...' : "I'm in!"}
              </button>
              <button
                type="button"
                className="btn-maybe"
                disabled={loading || maybeLoading}
                style={{ flex: 1 }}
                onClick={e => handleSignup(e, true)}
              >
                {maybeLoading ? '...' : "Maybe"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isFull && (
        <div className="card">
          <div className={`alert alert-error`}>The game is full this week. Check back next week!</div>
        </div>
      )}

      {/* Cancel section */}
      <div className="card">
        <button
          className="btn-secondary btn-sm"
          style={{ marginBottom: showCancel ? '1rem' : 0 }}
          onClick={() => setShowCancel(v => !v)}
        >
          {showCancel ? 'Hide' : 'Need to cancel your spot?'}
        </button>

        {showCancel && (
          <form onSubmit={handleCancelByPhone}>
            {cancelMessage && (
              <div className={`alert alert-${cancelMessage.type}`}>{cancelMessage.text}</div>
            )}
            <label htmlFor="cancel-phone">Enter your phone number</label>
            <input
              id="cancel-phone"
              type="tel"
              placeholder="(555) 555-5555"
              value={cancelPhone}
              onChange={e => setCancelPhone(e.target.value)}
              required
            />
            <button type="submit" className="btn-danger" disabled={cancelLoading}>
              {cancelLoading ? 'Cancelling...' : 'Cancel my spot'}
            </button>
          </form>
        )}
      </div>

      <p className="subtext" style={{ textAlign: 'center' }}>
        <a href="/admin">Admin</a>
      </p>
    </div>
  );
}
