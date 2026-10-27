import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../api';

export default function CancelPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [pageStatus, setPageStatus] = useState('loading'); // loading | ready | done | error
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [maybe, setMaybe] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }
  const [actionLoading, setActionLoading] = useState(null); // 'save' | 'cancel'

  useEffect(() => {
    async function fetchInfo() {
      try {
        const { ok, status, data } = await apiFetch(`/signup/cancel/${token}`);
        if (ok) {
          setInfo(data);
          setName(data.name || '');
          setNote(data.note || '');
          setMaybe(!!data.maybe);
          setPageStatus('ready');
        } else if (status === 410) {
          setPageStatus('done');
          setMessage({ type: 'success', text: 'This signup is already cancelled.' });
        } else {
          setPageStatus('error');
          setMessage({ type: 'error', text: data.error || 'Invalid link.' });
        }
      } catch {
        setPageStatus('error');
        setMessage({ type: 'error', text: 'Something went wrong.' });
      }
    }
    fetchInfo();
  }, [token]);

  async function handleSave(e) {
    e.preventDefault();
    setActionLoading('save');
    setMessage(null);
    try {
      const { ok, data } = await apiFetch(`/signup/cancel/${token}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, maybe, note }),
      });
      if (ok) {
        setName(data.name);
        setNote(data.note);
        setMaybe(!!data.maybe);
        setMessage({ type: 'success', text: 'Saved — your signup is updated.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Something went wrong.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading('cancel');
    setMessage(null);
    try {
      const { ok, data } = await apiFetch(`/signup/cancel/${token}`, { method: 'POST' });
      if (ok) {
        setPageStatus('done');
        setMessage({ type: 'success', text: 'Your spot has been cancelled.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Something went wrong.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong.' });
    } finally {
      setActionLoading(null);
    }
  }

  const mondayLabel = info?.weekOf
    ? new Date(info.weekOf + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div className="container">
      <h1>🏀 Monday Hoops</h1>

      {pageStatus === 'loading' && <p>Loading...</p>}

      {pageStatus === 'ready' && info && (
        <div className="card">
          <h2>Manage your signup</h2>
          <p className="subtext" style={{ marginBottom: '1.5rem' }}>
            You're signed up for <strong>{mondayLabel}</strong>.
          </p>

          {message && (
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          )}

          <form onSubmit={handleSave}>
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
            <input id="phone" type="tel" value={info.phone || ''} disabled autoComplete="tel" />

            <label htmlFor="note">Note <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input
              id="note"
              type="text"
              placeholder="e.g. might be a few minutes late"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={120}
            />

            <p className="subtext" style={{ marginBottom: '1rem' }}>
              Status: <span style={{ color: maybe ? 'var(--yellow)' : 'var(--green)', fontWeight: 600 }}>
                {maybe ? 'Maybe' : 'In ✓'}
              </span>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {maybe ? (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => setMaybe(false)}
                  disabled={!!actionLoading}
                >
                  I'm in — confirm my spot
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-maybe"
                  style={{ flex: 1, padding: '0.75rem' }}
                  onClick={() => setMaybe(true)}
                  disabled={!!actionLoading}
                >
                  Change to maybe
                </button>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.75rem' }}
              disabled={!!actionLoading}
            >
              {actionLoading === 'save' ? 'Saving...' : 'Save changes'}
            </button>
          </form>

          <button
            className="btn-danger"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.75rem' }}
            onClick={handleCancel}
            disabled={!!actionLoading}
          >
            {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel my spot'}
          </button>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/">← Back to signup</Link>
          </div>
        </div>
      )}

      {pageStatus === 'done' && (
        <div className="card">
          <div className="alert alert-success">{message?.text}</div>
          <Link to="/">← Back to signup</Link>
        </div>
      )}

      {pageStatus === 'error' && (
        <div className="card">
          <div className="alert alert-error">{message?.text}</div>
          <Link to="/">← Back to signup</Link>
        </div>
      )}
    </div>
  );
}
