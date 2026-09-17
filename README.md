# karin-nordin

A self-contained static site — the whole page is a single file, `index.html`,
with no build step and no backend. Hosted on Vercel, which auto-deploys on every
push to `main`.

## Link tracking

Tagged links record who opened the page. Send someone
`https://karin-nordin.vercel.app/?v=CODE`; when the page loads, a small script
posts the code to `/api/visit`, which appends `{code, timestamp, page}` to a
Redis list. No cookies, no IP address, no device details, and the code is
stripped from the address bar so it is not carried into a bookmark or a
forward. Untagged visits are not logged at all.

`api/codes.json` maps each code to a person, so the dashboard can show a name
instead of a code. Codes that are not listed there still get logged.

Read the log at `/api/stats?key=<DASHBOARD_TOKEN>` — visits per recipient, plus
the most recent 200. The page is `noindex`, and without the right key it
answers 404.

### Setup

Both steps happen in the Vercel project settings; until they are done
`/api/visit` quietly does nothing and the site is unaffected.

1. **Storage** → add a Redis store (Storage tab → Upstash Redis) and connect it
   to this project. Vercel injects the credentials itself; the function accepts
   either the `KV_REST_API_*` or the `UPSTASH_REDIS_REST_*` pair.
2. **Dashboard password** → add an environment variable `DASHBOARD_TOKEN` with a
   long random value. That value is the `key` in the stats URL.

Redeploy after adding either one.

### Note on personal data

The log ties a named individual to a timestamp, so it is personal data under
GDPR and Karin is the controller: keep it to people who were actually sent a
link, delete it when the applications are closed, and be ready to say what is
stored if someone asks.
