/**
 * Returns the ISO date string (YYYY-MM-DD) of the current week's Monday.
 * The week rolls over Tuesday at 5am UTC (midnight CT).
 * - Sunday through Monday 11:59pm CT → this Monday
 * - Tuesday onward → next Monday
 */
function getUpcomingMonday() {
  // Use CT offset: UTC-5 (CDT) — shift the "now" to CT
  const now = new Date();
  const ctOffset = 5; // hours behind UTC for CDT
  const ct = new Date(now.getTime() - ctOffset * 60 * 60 * 1000);
  const day = ct.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // If it's Monday in CT, return today's Monday
  // If it's Tue-Sat, return next Monday
  // If it's Sunday, return tomorrow (Monday)
  let daysUntilMonday;
  if (day === 1) {
    daysUntilMonday = 0;
  } else if (day === 0) {
    daysUntilMonday = 1;
  } else {
    daysUntilMonday = 8 - day;
  }

  const monday = new Date(ct);
  monday.setUTCDate(ct.getUTCDate() + daysUntilMonday);
  return monday.toISOString().split('T')[0];
}

module.exports = { getUpcomingMonday };
