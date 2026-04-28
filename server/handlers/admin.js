const { v4: uuidv4 } = require('uuid');
const {
  getWeekSignups, cancelSignup, putSignup,
  getAllPlayers, getPlayer, putPlayer, updatePlayer, deletePlayer,
} = require('../lib/dynamo');
const { formatPhone } = require('../lib/phone');
const { getUpcomingMonday } = require('../lib/weekOf');

const MAX_PLAYERS = 15;

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.SITE_URL || '*',
      'Access-Control-Allow-Headers': 'Content-Type,x-admin-password',
    },
    body: JSON.stringify(body),
  };
}

function checkAdmin(event) {
  const pw = event.headers?.['x-admin-password'] || event.headers?.['X-Admin-Password'];
  return pw === process.env.ADMIN_PASSWORD;
}

// GET /admin/signups
async function getSignups(event) {
  const weekOf = getUpcomingMonday();
  const signups = await getWeekSignups(weekOf);
  return resp(200, { weekOf, signups, max: MAX_PLAYERS });
}

// DELETE /admin/signups/{phone}
async function removeSignup(event) {
  const phone = decodeURIComponent(event.pathParameters?.phone);
  const weekOf = getUpcomingMonday();
  await cancelSignup(weekOf, phone);
  return resp(200, { success: true });
}

// POST /admin/signups
async function addSignup(event) {
  const { name, phone } = JSON.parse(event.body || '{}');
  if (!name || !phone) return resp(400, { error: 'Name and phone required.' });

  const formattedPhone = formatPhone(phone);
  const weekOf = getUpcomingMonday();

  const all = await getWeekSignups(weekOf);
  const active = all.filter(s => !s.cancelled);

  if (active.find(s => s.phone === formattedPhone)) {
    return resp(409, { error: 'Player already signed up this week.' });
  }
  if (active.length >= MAX_PLAYERS) {
    return resp(409, { error: 'Game is full.' });
  }

  const existing = await getPlayer(formattedPhone);
  if (!existing) {
    await putPlayer({ name: name.trim(), phone: formattedPhone, optedIn: true, createdAt: new Date().toISOString() });
  }

  await putSignup({
    name: name.trim(),
    phone: formattedPhone,
    cancelToken: uuidv4(),
    weekOf,
    maybe: false,
    cancelled: false,
    signedUpAt: new Date().toISOString(),
  });

  return resp(200, { success: true });
}

// GET /admin/players
async function getPlayers(event) {
  const players = await getAllPlayers();
  return resp(200, { players });
}

// POST /admin/players
async function addPlayer(event) {
  const { name, phone } = JSON.parse(event.body || '{}');
  if (!name || !phone) return resp(400, { error: 'Name and phone required.' });

  const formattedPhone = formatPhone(phone);
  const existing = await getPlayer(formattedPhone);
  if (existing) return resp(409, { error: 'A player with that phone number already exists.' });

  const player = { name: name.trim(), phone: formattedPhone, optedIn: true, createdAt: new Date().toISOString() };
  await putPlayer(player);
  return resp(200, { success: true, player });
}

// PATCH /admin/players/{phone}
async function patchPlayer(event) {
  const phone = decodeURIComponent(event.pathParameters?.phone);
  const { opted_in, name } = JSON.parse(event.body || '{}');

  const updates = {};
  if (opted_in !== undefined) updates.optedIn = !!opted_in;
  if (name !== undefined) updates.name = name.trim();

  await updatePlayer(phone, updates);
  return resp(200, { success: true });
}

// DELETE /admin/players/{phone}
async function removePlayer(event) {
  const phone = decodeURIComponent(event.pathParameters?.phone);
  await deletePlayer(phone);
  return resp(200, { success: true });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(200, {});

  if (!checkAdmin(event)) return resp(401, { error: 'Unauthorized.' });

  const method = event.httpMethod;
  const path = event.path;

  try {
    if (method === 'GET'    && path === '/api/admin/signups')              return await getSignups(event);
    if (method === 'POST'   && path === '/api/admin/signups')              return await addSignup(event);
    if (method === 'DELETE' && path.startsWith('/api/admin/signups/'))     return await removeSignup(event);
    if (method === 'GET'    && path === '/api/admin/players')              return await getPlayers(event);
    if (method === 'POST'   && path === '/api/admin/players')              return await addPlayer(event);
    if (method === 'PATCH'  && path.startsWith('/api/admin/players/'))     return await patchPlayer(event);
    if (method === 'DELETE' && path.startsWith('/api/admin/players/'))     return await removePlayer(event);
    return resp(404, { error: 'Not found.' });
  } catch (err) {
    console.error(err);
    return resp(500, { error: 'Internal server error.' });
  }
};
