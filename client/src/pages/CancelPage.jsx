import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../api';

export default function CancelPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [pageStatus, setPageStatus] = useState('loading'); // loading | ready | done | error
  const [maybe, setMaybe] = useState(false);
  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // 'confirm' | 'maybe' | 'cancel'

  useEffect(() => {
    async function fetchInfo() {
      try {
        const { ok, status, data } = await apiFetch(`/signup/cancel/${token}`);
        if (ok) {
          setInfo(data);
          setMaybe(!!data.maybe);
          setPageStatus('ready');
        } else if (status === 410) {
          setPageStatus('done');
          setMessage('This signup is already cancelled.');
        } else {
          setPageStatus('error');
          setMessage(data.error || 'Invalid link.');
        }
      } catch {
        setPageStatus('error');
        setMessage('Something went wrong.');
      }
    }
    fetchInfo();
  }, [token]);

  async function handleUpdate(newMaybe) {
    setActionLoading(newMaybe ? 'maybe' : 'confirm');
    try {
      const { ok, data } = await apiFetch(`/signup/cancel/${token}`, {
        method: 'PATCH',
        body: JSON.stringify({ maybe: newMaybe }),
      });
      if (ok) {
        setMaybe(newMaybe);
        setMessage(newMaybe ? "Updated to maybe — we'll keep your spot for now." : "You're confirmed as in!");
      } else {
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setMessage('Something went wrong.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading('cancel');
    try {
      const { ok, data } = await apiFetch(`/signup/cancel/${token}`, { method: 'POST' });
      if (ok) {
        setPageStatus('done');
        setMessage('Your spot has been cancelled.');
      } else {
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setMessage('Something went wrong.');
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
          <p style={{ marginBottom: '0.25rem' }}>
            Hey <strong>{info.name}</strong> — you're signed up for <strong>{mondayLabel}</strong>.
          </p>
          <p className="subtext" style={{ marginBottom: '1.5rem' }}>
            Current status: <span style={{ color: maybe ? 'var(--yellow)' : 'var(--green)', fontWeight: 600 }}>
              {maybe ? 'Maybe' : 'In ✓'}
            </span>
          </p>

          {message && (
            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{message}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {maybe && (
              <button
                className="btn-primary"
                onClick={() => handleUpdate(false)}
                disabled={!!actionLoading}
              >
                {actionLoading === 'confirm' ? 'Updating...' : "I'm in — confirm my spot"}
              </button>
            )}

            {!maybe && (
              <button
                className="btn-maybe"
                style={{ width: '100%', padding: '0.75rem' }}
                onClick={() => handleUpdate(true)}
                disabled={!!actionLoading}
              >
                {actionLoading === 'maybe' ? 'Updating...' : 'Change to maybe'}
              </button>
            )}

            <button
              className="btn-danger"
              style={{ width: '100%', padding: '0.75rem' }}
              onClick={handleCancel}
              disabled={!!actionLoading}
            >
              {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel my spot'}
            </button>
          </div>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/">← Back to signup</Link>
          </div>
        </div>
      )}

      {pageStatus === 'done' && (
        <div className="card">
          <div className="alert alert-success">{message}</div>
          <Link to="/">← Back to signup</Link>
        </div>
      )}

      {pageStatus === 'error' && (
        <div className="card">
          <div className="alert alert-error">{message}</div>
          <Link to="/">← Back to signup</Link>
        </div>
      )}
    </div>
  );
}
