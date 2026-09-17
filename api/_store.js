// Thin wrapper over the Upstash Redis REST API.
//
// Vercel injects a different pair of names depending on how the store was
// attached — KV_* for a Vercel KV store, UPSTASH_* for one added through the
// Marketplace — so accept either. With neither set the caller treats the
// store as absent and the site carries on without logging.
function config() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

// Runs an array of Redis commands in one round trip.
async function pipeline(commands) {
  const cfg = config();
  if (!cfg) return null;
  const res = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error('store responded ' + res.status + ' ' + (await res.text()).slice(0, 200));
  }
  return res.json();
}

module.exports = { config, pipeline };
