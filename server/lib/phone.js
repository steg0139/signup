/**
 * Format a phone number to E.164 (assumes US numbers).
 * Strips all non-digits and prepends +1 if needed.
 */
function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

module.exports = { formatPhone };
