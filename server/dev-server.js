/**
 * Local development server.
 * Wraps the Lambda handlers in Express so you can run them locally.
 * Reads credentials from the root .env file.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

const signupHandler = require('./handlers/signup');
const adminHandler = require('./handlers/admin');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: 'http://localhost:5174' }));
app.use(express.json());

/**
 * Convert an Express req/res into a Lambda-style event,
 * call the handler, and send the response back.
 */
async function callHandler(handler, req, res, paramNames = []) {
  // Extract named path parameters from the URL
  const pathParts = req.path.split('/');
  const pathParameters = {};
  for (const name of paramNames) {
    // Find the segment after the param's prefix in the path
    const idx = pathParts.findIndex(p => p === name);
    if (idx === -1) {
      // Try to grab the last segment as the param value
      pathParameters[name] = pathParts[pathParts.length - 1];
    }
  }
  // If only one param name, always use the last path segment
  if (paramNames.length === 1) {
    pathParameters[paramNames[0]] = decodeURIComponent(pathParts[pathParts.length - 1]);
  }

  const event = {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers,
    pathParameters,
    queryStringParameters: req.query,
    body: req.body ? JSON.stringify(req.body) : null,
  };

  try {
    const result = await handler(event);
    res
      .status(result.statusCode)
      .set(result.headers || {})
      .send(result.body);
  } catch (err) {
    console.error('Unhandled handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Routes without path params
app.all('/api/signup', (req, res) => callHandler(signupHandler.handler, req, res));
app.all('/api/signup/cancel-by-phone', (req, res) => callHandler(signupHandler.handler, req, res));
app.all('/api/signup/cancel/:token', (req, res) => callHandler(signupHandler.handler, req, res, ['token']));

app.all('/api/admin/signups', (req, res) => callHandler(adminHandler.handler, req, res));
app.all('/api/admin/signups/:phone', (req, res) => callHandler(adminHandler.handler, req, res, ['phone']));
app.all('/api/admin/stats', (req, res) => callHandler(adminHandler.handler, req, res));
app.all('/api/admin/players', (req, res) => callHandler(adminHandler.handler, req, res));
app.all('/api/admin/players/:phone/history', (req, res) => callHandler(adminHandler.handler, req, res, ['phone']));
app.all('/api/admin/players/:phone', (req, res) => callHandler(adminHandler.handler, req, res, ['phone']));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
});
