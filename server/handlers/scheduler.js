const { getWeekSignups } = require('../lib/dynamo');
const { sendAdminEmail } = require('../lib/email');
const { getUpcomingMonday } = require('../lib/weekOf');

/**
 * EventBridge triggers this Lambda with a "type" in the event detail.
 * Two rules:
 *   - type: "sunday-reminder"  → Saturday 12:30pm ET
 *   - type: "monday-reminder"  → Monday 8:30am ET
 */
exports.handler = async (event) => {
  const type = event['detail-type'] || event.type;
  const siteUrl = process.env.SITE_URL;

  console.log('Scheduler triggered:', type);

  if (type === 'sunday-reminder') {
    const monday = getUpcomingMonday();
    const mondayLabel = new Date(monday + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const messageText = `🏀 Monday hoops signup is open! Game is ${mondayLabel} 7:30-9:30pm. Sign up here: ${siteUrl}`;

    await sendAdminEmail(
      '🏀 Hoops — Sunday 1pm reminder (send this to the group)',
      `Hey! Here's your reminder text to send to the group at 1pm today:\n\n` +
      `---\n${messageText}\n---\n\n` +
      `Send it to your group chat and let the signups roll in.`
    );
    console.log('Sunday reminder email sent.');
    return;
  }

  if (type === 'monday-reminder') {
    const weekOf = getUpcomingMonday();
    const signups = await getWeekSignups(weekOf);
    const active = signups.filter(s => !s.cancelled);
    const confirmed = active.filter(s => !s.maybe);
    const maybes = active.filter(s => s.maybe);
    const count = active.length;

    const confirmedList = confirmed.map((s, i) => `  ${i + 1}. ${s.name}`).join('\n') || '  (none yet)';
    const maybeList = maybes.length ? `\nMaybes:\n${maybes.map(s => `  - ${s.name}`).join('\n')}` : '';
    const messageText = `🏀 Hoops reminder! Tonight 7:30-9:30pm. ${count}/15 spots filled. Sign up: ${siteUrl}`;

    await sendAdminEmail(
      `🏀 Hoops — Monday 9am reminder (${count}/15 signed up)`,
      `Hey! Here's your reminder text to send to the group at 9am:\n\n` +
      `---\n${messageText}\n---\n\n` +
      `Current signup list (${confirmed.length} confirmed, ${maybes.length} maybe):\n${confirmedList}${maybeList}\n\n` +
      `Manage signups: ${siteUrl}/admin`
    );
    console.log('Monday reminder email sent.');
    return;
  }

  console.warn('Unknown scheduler event type:', type);
};
