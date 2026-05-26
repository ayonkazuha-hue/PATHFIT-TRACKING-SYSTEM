// Utility to escape HTML special characters, preventing XSS when rendering user data in EJS.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const type = typeof str;
  if (type === 'number' || type === 'boolean') return String(str);
  if (type === 'string') {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  return '';
}

module.exports = { escapeHtml };
