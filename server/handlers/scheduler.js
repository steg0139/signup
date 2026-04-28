const { getWeekSignups } = require('../lib/dynamo');
const { sendAdminEmail } = require('../lib/email');
const { getUpcomingMonday } = require('../lib/weekOf');

/**
 * EventBridge triggers this Lambda with a "detail-type" in the event.
 * Three rules:
 *   - type: "sunday-reminder"       → Saturday 12:30pm CT
 *   - type: "monday-reminder"       → Monday 8:30am CT
 *   - type: "monday-noon-reminder"  → Monday 12:00pm CT
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

    const confirmedList = confirmed.map((s, i) => `  ${i + 1}. ${s.name}`).join('\n') || '  (none yet)';
    const maybeList = maybes.length ? `\nMaybes:\n${maybes.map(s => `  - ${s.name}`).join('\n')}` : '';
    const maybeNote = maybes.length ? ` (+ ${maybes.length} maybe)` : '';
    const messageText = `🏀 Hoops reminder! Tonight 7:30-9:30pm. ${confirmed.length} confirmed${maybeNote}. Sign up: ${siteUrl}`;

    await sendAdminEmail(
      `🏀 Hoops — Monday 9am reminder (${confirmed.length} confirmed${maybeNote})`,
      `Hey! Here's your reminder text to send to the group at 9am:\n\n` +
      `---\n${messageText}\n---\n\n` +
      `Current signup list (${confirmed.length} confirmed, ${maybes.length} maybe):\n${confirmedList}${maybeList}\n\n` +
      `Manage signups: ${siteUrl}/admin`
    );
    console.log('Monday reminder email sent.');
    return;
  }

  if (type === 'monday-noon-reminder') {
    const weekOf = getUpcomingMonday();
    const signups = await getWeekSignups(weekOf);
    const active = signups.filter(s => !s.cancelled);
    const confirmed = active.filter(s => !s.maybe);
    const maybes = active.filter(s => s.maybe);

    const maybeNote = maybes.length ? ` (+ ${maybes.length} maybe)` : '';
    const statusLine = confirmed.length < 10
      ? `Only ${confirmed.length} confirmed${maybeNote} — need a few more guys!`
      : `We're good to go for tonight! ${confirmed.length} confirmed${maybeNote}.`;

    const messageText = `🏀 Hoops tonight 7:30-9:30pm. ${statusLine} Sign up: ${siteUrl}`;

    await sendAdminEmail(
      `🏀 Hoops noon check-in (${confirmed.length} confirmed${maybeNote})`,
      `Here's your noon check-in text to send to the group:\n\n` +
      `---\n${messageText}\n---\n\n` +
      `Manage signups: ${siteUrl}/admin`
    );
    console.log('Monday noon reminder email sent.');
    return;
  }

  console.warn('Unknown scheduler event type:', type);
};
