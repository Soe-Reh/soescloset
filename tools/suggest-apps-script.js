// Paste this into the Google Sheet's Apps Script editor (Extensions > Apps Script), replacing what is there.
// The site posts each suggestion here; one row per suggestion: time, link, page it came from.
function doPost(e) {
  const p = (e && e.parameter) || {};
  const url = String(p.url || '').trim();
  // Bots fill every field; people never see "website", so anything in it is spam.
  if (p.website) return ok();
  if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url) || url.length > 500) return ok();
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Link', 'From page']);
    // A leading = + - @ would run as a formula in the sheet; the quote keeps it plain text.
    const safe = s => /^[=+\-@]/.test(s) ? "'" + s : s;
    sheet.appendRow([new Date(), safe(url), safe(String(p.page || '').slice(0, 200))]);
  } finally {
    lock.releaseLock();
  }
  return ok();
}
function ok() {
  return ContentService.createTextOutput('ok');
}
