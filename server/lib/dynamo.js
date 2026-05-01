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

/**
 * Delete a player and all their signup history.
 * Uses the phone-index GSI to find all signup items, then batch deletes them.
 */
async function deletePlayerAndHistory(phone) {
  // Delete the player record (ignore if already gone)
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: playerKey(phone),
  })).catch(() => {});

  // Find all signup items via GSI
  const gsiRes = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'phone-index',
    KeyConditionExpression: 'phone = :phone',
    ExpressionAttributeValues: { ':phone': phone },
  }));

  // Also scan for any items written before the GSI existed (missing phone attribute)
  const scanRes = await ddb.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'sk = :sk AND itemType = :t',
    ExpressionAttributeValues: {
      ':sk': `PHONE#${phone}`,
      ':t': 'SIGNUP',
    },
  }));

  // Merge and deduplicate by pk+sk
  const seen = new Set();
  const items = [...(gsiRes.Items || []), ...(scanRes.Items || [])].filter(item => {
    const key = `${item.pk}|${item.sk}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const item of items) {
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
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
  const items = (res.Items || []).map(item => ({
    ...item,
    // Ensure phone is always available (parse from sk if missing)
    phone: item.phone || item.sk?.replace('PHONE#', ''),
  }));
  return items.sort((a, b) => {
    if (a.maybe !== b.maybe) return a.maybe ? 1 : -1;
    return (a.signedUpAt || '').localeCompare(b.signedUpAt || '');
  });
}

/**
 * Get all signups for a specific phone number across all weeks.
 * Uses the phone-index GSI.
 */
async function getSignupsByPhone(phone) {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'phone-index',
    KeyConditionExpression: 'phone = :phone',
    ExpressionAttributeValues: { ':phone': phone },
  }));
  return res.Items || [];
}

/**
 * Compute attendance stats for all players.
 * Scans all SIGNUP items, groups by phone, calculates streaks.
 */
async function getAttendanceStats() {
  const res = await ddb.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'itemType = :t',
    ExpressionAttributeValues: { ':t': 'SIGNUP' },
  }));

  const items = res.Items || [];

  // Group by phone
  const byPhone = {};
  for (const item of items) {
    if (!item.phone) continue;
    if (!byPhone[item.phone]) byPhone[item.phone] = [];
    byPhone[item.phone].push(item);
  }

  const stats = [];

  for (const [phone, signups] of Object.entries(byPhone)) {
    // Sort by weekOf ascending
    const sorted = signups.sort((a, b) => a.weekOf.localeCompare(b.weekOf));

    // Most recently used name
    const latestSignup = [...sorted].reverse().find(s => s.name);
    const name = latestSignup?.name || 'Unknown';

    // Count attended (not cancelled)
    const attended = sorted.filter(s => !s.cancelled);
    const total = attended.length;

    // Build a set of attended weeks for streak calculation
    const attendedWeeks = new Set(attended.map(s => s.weekOf));

    // Get all unique weeks across all signups (to know the full timeline)
    // We'll compute streaks based on consecutive Mondays in attendedWeeks
    const weeksSorted = [...attendedWeeks].sort();

    // Current streak — walk backwards from most recent week
    let currentStreak = 0;
    if (weeksSorted.length > 0) {
      // Start from the most recent attended week and walk back
      let checkDate = new Date(weeksSorted[weeksSorted.length - 1] + 'T12:00:00');
      while (attendedWeeks.has(checkDate.toISOString().split('T')[0])) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 7);
      }
    }

    // Longest streak
    let longestStreak = 0;
    let streak = 0;
    let prevDate = null;
    for (const week of weeksSorted) {
      const curr = new Date(week + 'T12:00:00');
      if (prevDate) {
        const diff = (curr - prevDate) / (1000 * 60 * 60 * 24);
        if (Math.round(diff) === 7) {
          streak++;
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      longestStreak = Math.max(longestStreak, streak);
      prevDate = curr;
    }

    stats.push({
      phone,
      name,
      total,
      currentStreak,
      longestStreak,
      lastPlayed: weeksSorted[weeksSorted.length - 1] || null,
    });
  }

  // Sort by total descending, exclude anyone with 0 attended games
  return stats.filter(s => s.total > 0).sort((a, b) => b.total - a.total);
}

module.exports = {
  getPlayer, putPlayer, updatePlayer, deletePlayer, deletePlayerAndHistory, getAllPlayers,
  getSignup, getSignupByToken, putSignup, cancelSignup, getWeekSignups,
  getSignupsByPhone, getAttendanceStats,
};
