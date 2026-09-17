const { config, pipeline } = require('./_store');

const KEY_LOG = 'visits';      // list of visit records, oldest first
const KEY_COUNTS = 'counts';   // hash of code -> total visits
const MAX_LOG = 2000;          // keep the log bounded

// Codes are ours, so they can be strict: short, and only characters that are
// safe to read back out in a table or a URL.
function cleanCode(raw) {
  const v = String(raw || '').trim().slice(0, 64);
  return /^[A-Za-z0-9._@+-]+$/.test(v) ? v : '';
}

function cleanPath(raw) {
  const v = String(raw || '/').trim().slice(0, 120);
  return /^[A-Za-z0-9/_.?=&%-]*$/.test(v) ? v || '/' : '/';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  // Nothing is configured yet, or the link carried no code: succeed quietly.
  // A visit log is never worth breaking the page over.
  const code = cleanCode(req.query && req.query.v);
  if (!config() || !code) return res.status(204).end();

  const record = {
    code,
    at: new Date().toISOString(),   // server clock, not the visitor's
    page: cleanPath(req.query && req.query.p),
  };

  try {
    await pipeline([
      ['RPUSH', KEY_LOG, JSON.stringify(record)],
      ['LTRIM', KEY_LOG, -MAX_LOG, -1],
      ['HINCRBY', KEY_COUNTS, code, 1],
    ]);
  } catch (err) {
    console.error('visit log failed:', err.message);
  }
  return res.status(204).end();
};
