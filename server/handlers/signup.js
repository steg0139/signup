const { v4: uuidv4 } = require('uuid');
const {
  getSignup, getSignupByToken, putSignup, cancelSignup,
  getWeekSignups, getPlayer, putPlayer,
} = require('../lib/dynamo');
const { formatPhone } = require('../lib/phone');
const { getUpcomingMonday } = require('../lib/weekOf');

const MAX_PLAYERS = 15;

function resp(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.SITE_URL || '*',
      'Access-Control-Allow-Headers': 'Content-Type,x-admin-password',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

// GET /signup
async function getList(event) {
  const weekOf = getUpcomingMonday();
  const all = await getWeekSignups(weekOf);
  const active = all.filter(s => !s.cancelled);
  const confirmed = active.filter(s => !s.maybe);
  const maybes = active.filter(s => s.maybe);

  return resp(200, {
    weekOf,
    count: active.length,
    confirmedCount: confirmed.length,
    maybeCount: maybes.length,
    max: MAX_PLAYERS,
    full: active.length >= MAX_PLAYERS,
    signups: confirmed.map(s => ({ id: s.phone, name: s.name, signedUpAt: s.signedUpAt })),
    maybes: maybes.map(s => ({ id: s.phone, name: s.name, signedUpAt: s.signedUpAt })),
  });
}

// POST /signup
async function createSignup(event) {
  const { name, phone, maybe } = JSON.parse(event.body || '{}');

  if (!name || !phone) {
    return resp(400, { error: 'Name and phone are required.' });
  }

  const formattedPhone = formatPhone(phone);
  const weekOf = getUpcomingMonday();

  const existing = await getSignup(weekOf, formattedPhone);
  if (existing && !existing.cancelled) {
    return resp(409, { error: 'You are already signed up for this week.' });
  }

  const all = await getWeekSignups(weekOf);
  const activeCount = all.filter(s => !s.cancelled).length;
  if (activeCount >= MAX_PLAYERS) {
    return resp(409, { error: 'Sorry, the game is full this week!' });
  }

  // Upsert player into roster
  const existingPlayer = await getPlayer(formattedPhone);
  if (!existingPlayer) {
    await putPlayer({ name: name.trim(), phone: formattedPhone, optedIn: true, createdAt: new Date().toISOString() });
  }

  const cancelToken = uuidv4();
  await putSignup({
    name: name.trim(),
    phone: formattedPhone,
    cancelToken,
    weekOf,
    maybe: !!maybe,
    cancelled: false,
    signedUpAt: new Date().toISOString(),
  });

  const cancelUrl = `${process.env.SITE_URL}/cancel/${cancelToken}`;
  return resp(200, {
    success: true,
    message: maybe ? "You're down as a maybe!" : "You're signed up!",
    cancelUrl,
  });
}

// GET /signup/cancel/{token}
async function getCancelInfo(event) {
  const token = event.pathParameters?.token;
  const signup = await getSignupByToken(token);

  if (!signup) return resp(404, { error: 'Invalid cancel link.' });
  if (signup.cancelled) return resp(410, { error: 'This signup is already cancelled.' });

  return resp(200, { name: signup.name, weekOf: signup.weekOf });
}

// POST /signup/cancel/{token}
async function cancelByToken(event) {
  const token = event.pathParameters?.token;
  const signup = await getSignupByToken(token);

  if (!signup) return resp(404, { error: 'Invalid cancel link.' });
  if (signup.cancelled) return resp(410, { error: 'Already cancelled.' });

  await cancelSignup(signup.weekOf, signup.phone);
  return resp(200, { success: true, message: 'Your signup has been cancelled.' });
}

// POST /signup/cancel-by-phone
async function cancelByPhone(event) {
  const { phone } = JSON.parse(event.body || '{}');
  if (!phone) return resp(400, { error: 'Phone number is required.' });

  const formattedPhone = formatPhone(phone);
  const weekOf = getUpcomingMonday();

  const signup = await getSignup(weekOf, formattedPhone);
  if (!signup || signup.cancelled) {
    return resp(404, { error: "We couldn't find an active signup for that number this week." });
  }

  await cancelSignup(weekOf, formattedPhone);
  return resp(200, { success: true, message: 'Your signup has been cancelled.' });
}

// Router — API Gateway sends all /signup routes here
exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;

  try {
    if (method === 'GET' && path === '/api/signup') return await getList(event);
    if (method === 'POST' && path === '/api/signup') return await createSignup(event);
    if (method === 'GET' && path.startsWith('/api/signup/cancel/')) return await getCancelInfo(event);
    if (method === 'POST' && path.startsWith('/api/signup/cancel/') && !path.endsWith('cancel-by-phone')) return await cancelByToken(event);
    if (method === 'POST' && path === '/api/signup/cancel-by-phone') return await cancelByPhone(event);
    if (method === 'OPTIONS') return resp(200, {});
    return resp(404, { error: 'Not found.' });
  } catch (err) {
    console.error(err);
    return resp(500, { error: 'Internal server error.' });
  }
};
