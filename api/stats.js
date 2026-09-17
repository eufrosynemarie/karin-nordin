const { config, pipeline } = require('./_store');
const codes = require('./codes.json');

const KEY_LOG = 'visits';
const KEY_COUNTS = 'counts';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function label(code) {
  const name = codes[code];
  return name && code !== '_comment' ? name : '';
}

function page(title, body) {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  :root{--pw:#7C7BE0;--violet:#5B3FA8;--ink:#241C3D;--muted:#6F6796;--line:rgba(91,63,168,.14)}
  body{margin:0;background:#F7F5FF;color:var(--ink);
       font:15px/1.5 Inter,system-ui,-apple-system,sans-serif;padding:32px 20px 64px}
  main{max-width:840px;margin:0 auto}
  h1{font-size:28px;margin:0 0 4px}
  p.sub{color:var(--muted);margin:0 0 28px}
  h2{font-size:17px;margin:32px 0 10px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);
        border-radius:14px;overflow:hidden}
  th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--line);font-size:14px}
  th{background:#F2EFFF;color:var(--violet);font-weight:600}
  tr:last-child td{border-bottom:none}
  td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
  code{background:#EDEBFF;padding:1px 6px;border-radius:5px;font-size:13px}
  .empty{color:var(--muted);background:#fff;border:1px solid var(--line);
         border-radius:14px;padding:18px}
  @media(max-width:520px){th,td{padding:8px 10px;font-size:13px}}
</style>
<main>${body}</main>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  const secret = process.env.DASHBOARD_TOKEN || '';
  if (!secret) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(503).send(page('Not set up', '<h1>Not set up yet</h1>' +
      '<p class="sub">Set <code>DASHBOARD_TOKEN</code> in the Vercel project settings, ' +
      'then open this page as <code>/api/stats?key=YOUR_TOKEN</code>.</p>'));
  }
  if ((req.query && req.query.key) !== secret) return res.status(404).send('Not found');

  if (!config()) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(503).send(page('No store', '<h1>No store connected</h1>' +
      '<p class="sub">Attach a Redis store to the project in Vercel. Visits are not ' +
      'being recorded until then — the site itself is unaffected.</p>'));
  }

  let visits = [];
  let counts = {};
  try {
    const out = await pipeline([
      ['LRANGE', KEY_LOG, -500, -1],
      ['HGETALL', KEY_COUNTS],
    ]);
    visits = (out[0].result || []).map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean).reverse();                       // newest first
    const flat = out[1].result || [];                   // [field, value, field, value, …]
    for (let i = 0; i < flat.length; i += 2) counts[flat[i]] = Number(flat[i + 1]);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(502).send(page('Store error',
      '<h1>Could not read the store</h1><p class="sub">' + esc(err.message) + '</p>'));
  }

  const byCode = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const summary = byCode.length
    ? '<table><tr><th>Who</th><th>Code</th><th>Visits</th><th>Last seen</th></tr>' +
      byCode.map((c) => {
        const last = visits.find((v) => v.code === c);
        return '<tr><td>' + (esc(label(c)) || '<span style="color:#6F6796">—</span>') +
          '</td><td><code>' + esc(c) + '</code></td><td class="n">' + counts[c] +
          '</td><td class="n">' + esc(last ? last.at.replace('T', ' ').slice(0, 16) : '—') +
          '</td></tr>';
      }).join('') + '</table>'
    : '<p class="empty">No visits recorded yet.</p>';

  const recent = visits.length
    ? '<table><tr><th>When (UTC)</th><th>Who</th><th>Code</th><th>Page</th></tr>' +
      visits.slice(0, 200).map((v) =>
        '<tr><td class="n">' + esc(v.at.replace('T', ' ').slice(0, 16)) +
        '</td><td>' + (esc(label(v.code)) || '<span style="color:#6F6796">—</span>') +
        '</td><td><code>' + esc(v.code) + '</code></td><td>' + esc(v.page || '/') +
        '</td></tr>').join('') + '</table>'
    : '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(page('Link visits',
    '<h1>Link visits</h1><p class="sub">Who opened a tagged link, and when. ' +
    'Times are UTC. The log keeps the most recent 2000 visits.</p>' +
    '<h2>By recipient</h2>' + summary +
    (recent ? '<h2>Most recent</h2>' + recent : '')));
};
