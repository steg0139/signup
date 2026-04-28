/**
 * Returns the ISO date string (YYYY-MM-DD) of the upcoming Monday
 * (or today if today is Monday).
 */
function getUpcomingMonday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  return monday.toISOString().split('T')[0];
}

module.exports = { getUpcomingMonday };
