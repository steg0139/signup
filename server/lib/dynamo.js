const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.DYNAMODB_TABLE;

// ── Key helpers ──────────────────────────────────────────────────────────────

function playerKey(phone) {
  return { pk: `PLAYER#${phone}`, sk: `PLAYER#${phone}` };
}

function signupKey(weekOf, phone) {
  return { pk: `SIGNUP#${weekOf}`, sk: `PHONE#${phone}` };
}

function cancelTokenKey(token) {
  return { pk: `TOKEN#${token}`, sk: `TOKEN#${token}` };
}

// ── Players ──────────────────────────────────────────────────────────────────

async function getPlayer(phone) {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: playerKey(phone),
  }));
  return res.Item || null;
}

async function putPlayer(player) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { ...playerKey(player.phone), ...player, itemType: 'PLAYER' },
  }));
}

async function updatePlayer(phone, updates) {
  const entries = Object.entries(updates);
  const expr = entries.map((_, i) => `#f${i} = :v${i}`).join(', ');
  const names = Object.fromEntries(entries.map(([k], i) => [`#f${i}`, k]));
  const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]));

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: playerKey(phone),
    UpdateExpression: `SET ${expr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

async function deletePlayer(phone) {
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: playerKey(phone),
  }));
}

async function getAllPlayers() {
  // Scan for all PLAYER items
  const res = await ddb.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'itemType = :t',
    ExpressionAttributeValues: { ':t': 'PLAYER' },
  }));
  return (res.Items || []).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Signups ──────────────────────────────────────────────────────────────────

async function getSignup(weekOf, phone) {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: signupKey(weekOf, phone),
  }));
  return res.Item || null;
}

async function getSignupByToken(token) {
  // Token items store a reference to the real signup
  const tokenItem = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: cancelTokenKey(token),
  }));
  if (!tokenItem.Item) return null;
  return getSignup(tokenItem.Item.weekOf, tokenItem.Item.phone);
}

async function putSignup(signup) {
  // Write the signup item
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...signupKey(signup.weekOf, signup.phone),
      ...signup,
      itemType: 'SIGNUP',
    },
  }));
  // Write a token lookup item
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...cancelTokenKey(signup.cancelToken),
      weekOf: signup.weekOf,
      phone: signup.phone,
      itemType: 'TOKEN',
    },
  }));
}

async function cancelSignup(weekOf, phone) {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: signupKey(weekOf, phone),
    UpdateExpression: 'SET cancelled = :t, cancelledAt = :ts',
    ExpressionAttributeValues: {
      ':t': true,
      ':ts': new Date().toISOString(),
    },
  }));
}

async function getWeekSignups(weekOf) {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `SIGNUP#${weekOf}` },
  }));
  return (res.Items || []).sort((a, b) => {
    // confirmed before maybes, then by signup time
    if (a.maybe !== b.maybe) return a.maybe ? 1 : -1;
    return a.signedUpAt.localeCompare(b.signedUpAt);
  });
}

module.exports = {
  getPlayer, putPlayer, updatePlayer, deletePlayer, getAllPlayers,
  getSignup, getSignupByToken, putSignup, cancelSignup, getWeekSignups,
};
