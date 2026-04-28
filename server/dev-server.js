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
async function callHandler(handler, req, res) {
  const event = {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers,
    pathParameters: req.params,
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

// Route all /api/signup/* to the signup handler
app.all('/api/signup*', (req, res) => callHandler(signupHandler.handler, req, res));

// Route all /api/admin/* to the admin handler
app.all('/api/admin*', (req, res) => callHandler(adminHandler.handler, req, res));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
});
