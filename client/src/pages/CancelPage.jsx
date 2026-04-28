import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../api';

export default function CancelPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | cancelled | error
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchInfo() {
      try {
        const { ok, status, data } = await apiFetch(`/signup/cancel/${token}`);
        if (ok) {
          setInfo(data);
          setStatus('ready');
        } else if (status === 410) {
          setStatus('cancelled');
          setMessage(data.error);
        } else {
          setStatus('error');
          setMessage(data.error || 'Invalid cancel link.');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong.');
      }
    }
    fetchInfo();
  }, [token]);

  async function handleCancel() {
    setLoading(true);
    try {
      const { ok, data } = await apiFetch(`/signup/cancel/${token}`, { method: 'POST' });
      if (ok) {
        setStatus('cancelled');
        setMessage(data.message);
      } else {
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setMessage('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const mondayLabel = info?.weekOf
    ? new Date(info.weekOf + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="container">
      <h1>🏀 Monday Hoops</h1>

      {status === 'loading' && <p>Loading...</p>}

      {status === 'ready' && info && (
        <div className="card">
          <h2>Cancel your spot</h2>
          <p>
            Hey <strong>{info.name}</strong>, are you sure you want to cancel your spot for{' '}
            <strong>{mondayLabel}</strong>?
          </p>
          <p className="subtext" style={{ marginBottom: '1.25rem' }}>
            Your spot will be freed up for someone else.
          </p>
          {message && <div className="alert alert-error">{message}</div>}
          <button className="btn-danger" onClick={handleCancel} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Cancelling...' : 'Yes, cancel my spot'}
          </button>
          <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <Link to="/">← Back to signup</Link>
          </div>
        </div>
      )}

      {status === 'cancelled' && (
        <div className="card">
          <div className="alert alert-success">{message || 'Your spot has been cancelled.'}</div>
          <Link to="/">← Back to signup</Link>
        </div>
      )}

      {status === 'error' && (
        <div className="card">
          <div className="alert alert-error">{message}</div>
          <Link to="/">← Back to signup</Link>
        </div>
      )}
    </div>
  );
}
