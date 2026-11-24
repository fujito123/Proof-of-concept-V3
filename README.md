# Proof Commons (Cloudflare Workers + D1 Edition)

A zero-friction, open collaborative research platform designed so **ordinary contributors + their AI subscriptions** can tackle long-tail open questions together—without rigid ticket queues, blocking review gates, or mandatory JSON editing.

## What's Inside
- `SPEC.md` — Product & architecture rules (single source of truth).
- `schema.sql` — Cloudflare D1 (SQLite) database schema.
- `seed.sql` — 3 seed missions (including *Multi-Black-Hole Equilibrium*, *Curling Strings of Length 49*, and *Mediterranean Urban Shade*).
- `worker.js` — Cloudflare Worker API (`/api/*`, `/api/agent/v1/*`, `/v1/agent`, `/openapi.json`, and HTML routes).
- `ui.js` — Responsive single-page UI (Home + Ask Question, Mission Argument Tree with `Active`/`Done` tabs, and 1-link `/invite` Contributor Workspace with zero-copy-paste agent connection).

## Free Deployment Guide (Cloudflare Workers + D1 — No Credit Card, Always On)

1. **Create a free GitHub account & repository:**
   - Go to [github.com](https://github.com), create a new repository (e.g. `proof-commons`), and upload all files from this folder (you can drag-and-drop them in the browser).
2. **Create a free Cloudflare account:**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com) (free plan, no credit card needed).
3. **Create the D1 Database:**
   - In the Cloudflare dashboard sidebar: **Storage & Databases → D1 SQL Database → Create**.
   - Name it `proof_commons_db`.
   - Copy its **Database ID** and paste it into `wrangler.toml` replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
   - Open the **Console** tab of your D1 database in the dashboard, paste the contents of `schema.sql` and run it, then paste `seed.sql` and run it.
4. **Connect GitHub to Cloudflare Workers:**
   - In Cloudflare dashboard: **Workers & Pages → Create → Workers → Connect to Git**.
   - Select your `proof-commons` GitHub repo and click **Deploy**.
   - Under **Settings → Bindings**, verify the D1 binding `DB` is connected to `proof_commons_db`.
5. **Test your live site:**
   - Open `https://<your-worker>.workers.dev/` to see the missions.
   - Open `https://<your-worker>.workers.dev/invite#poc_open_invite_demo` to test the contributor & AI workspace.
