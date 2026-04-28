// All API calls go to /api/* which CloudFront routes to API Gateway.
// In local dev, Vite proxies /api to localhost:3002.
export async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}
