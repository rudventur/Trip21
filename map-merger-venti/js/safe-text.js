// ═══════════════════════════════════════════════════════════════
//  safe-text.js — put user text into page markup safely
//  Pet names, nicknames, bios, tags, sniffs, notes and anything that
//  comes from the shared database or another website must go through
//  escHtml() (or textContent) before it is placed inside innerHTML.
// ═══════════════════════════════════════════════════════════════

function escHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"'`]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
  }[c]));
}

// For a text argument inside an inline onclick="fn(...)" attribute.
function escJsArg(value) {
  return escHtml(JSON.stringify(String(value == null ? '' : value)));
}

// Only let web links (http / https) through; anything else becomes '#'.
function safeUrl(url) {
  const s = String(url == null ? '' : url).trim();
  return /^https?:\/\//i.test(s) ? escHtml(s) : '#';
}

// Database keys and pet ids are only ever letters, digits, '-' and '_'.
function safeId(id) {
  return String(id == null ? '' : id).replace(/[^A-Za-z0-9_-]/g, '');
}

// Shared coordinates are rounded to 3 decimals (roughly 100 metres).
function roundShared(v) {
  return Math.round(Number(v) * 1000) / 1000;
}
