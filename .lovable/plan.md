
## Read this first — what I can and can't do

You want a full Lovable Cloud → Cloudflare Workers + D1 migration. I have to be straight with you about the limits before we spend effort on it:

1. **Lovable's backend tooling is Supabase-only.** My migration tool, auth middleware, generated types, `supabase` client, RLS scanner, edge-function deploys, AI Gateway key — all of these are wired to Lovable Cloud (Supabase). Once you cut over to Cloudflare, none of those tools work for the new backend. Future AI edits to backend logic get much harder because I can't read your D1, run migrations on it, deploy your Worker, or rotate its secrets.
2. **I can't deploy to your Cloudflare account.** I can write the Worker source, `wrangler.toml`, and the D1 schema into your repo. You run `wrangler deploy` (or let GitHub → Cloudflare Pages/Workers do it). I can't verify it works end-to-end from here.
3. **The preview inside Lovable will stop working for anything backend-related** the moment we rip out the Supabase client, unless we keep both stacks side by side during the cutover. The Lovable preview URL calls TanStack server functions inside Lovable's runtime — it does not proxy to your Cloudflare Worker.
4. **Google Sign-In via your own `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`** means we write the full OAuth 2.0 flow ourselves in the Worker (auth code exchange, session cookies, CSRF state, refresh). That's a real chunk of code, not a one-liner.

Given all that, here's what I recommend, in order.

## Stage 0 — Quick wins we do today (safe, reversible)

These land now, regardless of the Cloudflare decision.

1. **Google Analytics (gtag `G-1369P6EE4C`).** Add to `src/routes/__root.tsx` `head.scripts` so it renders in `<head>` on every page via `HeadContent`. No other file changes.
2. **Redesign `/auth`.** Rebuild `src/routes/auth.tsx` around a prominent "Continue with Google" button plus a compact email/password fallback. Blush & Lavender palette, Outfit + Figtree, soft gradient blobs, single viewport (no scroll on 360×640), tight spacing. The Google button hooks into `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` — Lovable Cloud already manages a Google provider, so this works instantly without the Cloudflare piece.
   - If you also want the button to use **your own** `VITE_GOOGLE_CLIENT_ID` (BYO credentials), we do that inside Lovable Cloud's managed provider config in the Cloud dashboard — not in code. The button code stays identical.

## Stage 1 — Cloudflare migration (delivered as code, not a live cutover)

I'll ship a complete Cloudflare backend into a new folder `cloudflare/` in your repo. It won't be wired into the running app — Lovable Cloud stays live in parallel. You deploy it to Cloudflare, verify, then flip the frontend over in one commit.

### What lands in the repo

```text
cloudflare/
  wrangler.toml              # Worker + D1 binding + env vars
  schema.sql                 # full D1 schema (all tables below)
  seed.sql                   # default expense categories, wallets on signup
  src/
    index.ts                 # Hono router mounted at /*
    auth/
      google.ts              # OAuth 2.0 code flow (login, callback, logout, me)
      session.ts             # HMAC-signed httpOnly session cookie
    db.ts                    # typed D1 helpers
    routes/
      products.ts
      materials.ts
      recipes.ts
      inventory.ts
      orders.ts
      customers.ts
      expenses.ts
      wallets.ts
      feedback.ts
      goals.ts
      analytics.ts
      dashboard.ts
    middleware/
      requireAuth.ts
      cors.ts
    lib/
      pricing.ts             # unit-cost + amortized recipe logic ported from products.functions.ts
migrations/
  0001_from_supabase.sql     # optional: import script for existing Lovable Cloud data
```

### D1 schema (matches current Supabase tables)

Ported 1:1 from your current Cloud DB: `profiles`, `wallets`, `expense_categories`, `suppliers`, `customers`, `materials`, `material_purchases`, `product_recipe_items`, `products`, `orders`, `order_items`, `expenses`, `feedback`, `goals`. D1 is SQLite, so:

- `uuid` → `TEXT` with `lower(hex(randomblob(16)))` default.
- `timestamptz` → `TEXT` ISO-8601 with `datetime('now')` default.
- `numeric` → `REAL` (we already treat money as numbers client-side).
- `auth.uid()` doesn't exist. Every table gets a `user_id TEXT NOT NULL` column and every query filters by the session's `userId` — RLS is replaced by explicit `WHERE user_id = ?` in every handler + a `requireAuth` middleware. This is a real behavior change: forgetting the filter = data leak. I'll centralize it in `db.ts` helpers so it can't be skipped.
- The two Postgres triggers (`tg_apply_material_purchase`, `handle_new_user`) become application code in `routes/materials.ts` (on purchase insert) and `auth/google.ts` (on first login).

### Auth flow (Google, no Supabase)

1. `GET /api/auth/google/start` → generates `state` (CSRF), sets it in a short-lived cookie, redirects to `accounts.google.com/o/oauth2/v2/auth` with your `VITE_GOOGLE_CLIENT_ID`, scopes `openid email profile`, `redirect_uri=https://<worker>/api/auth/google/callback`.
2. `GET /api/auth/google/callback` → verifies `state`, exchanges `code` at `oauth2.googleapis.com/token` with `GOOGLE_CLIENT_SECRET`, fetches userinfo, upserts `profiles` row (seeding wallets + default expense categories the way `handle_new_user` did), then sets an HMAC-signed httpOnly `session` cookie for 30 days. Redirects to `/dashboard`.
3. `GET /api/auth/me` → returns the session's user or 401.
4. `POST /api/auth/logout` → clears the cookie.

Session cookie is signed with a `SESSION_SECRET` (I'll add to `wrangler.toml` as a required env var). No email/password path — Google-only, matching your request.

### Frontend changes (deferred until you're ready to cut over)

When you decide to flip, we replace `src/integrations/supabase/*` imports with a small `src/lib/api.ts` fetch client pointing at `VITE_API_BASE_URL` (your Worker URL), and swap every `.functions.ts` call site from `useServerFn(getXxx)` to `useQuery({ queryFn: () => api.getXxx() })`. I'll do this in one PR so you can review the diff before merging.

### Data migration from Lovable Cloud → D1

Since Lovable Cloud is Supabase, I can `psql` your current DB via my exec tool (you have PG env vars available) and dump each table to CSV under `/mnt/documents/`. You then `wrangler d1 execute <db> --file=<insert.sql>` locally. I'll generate:
- `cloudflare/migrations/import.sh` — dumps all 14 tables to CSV.
- `cloudflare/migrations/csv-to-sqlite.sql` — `INSERT` statements template.
This is a one-shot import; new signups after cutover only land in D1.

### Deployment pipeline

You already have GitHub → Cloudflare connected. I'll add:
- `wrangler.toml` with `d1_databases`, `vars`, and route pattern.
- `.github/workflows/deploy-worker.yml` running `wrangler deploy` on push to `main` for the `cloudflare/` folder.
- Vite frontend keeps deploying to Cloudflare Pages the way it already does; only new env var: `VITE_API_BASE_URL`.

## What I need from you before I write the Worker

Reply with these values (or paste them into the chat and I'll pick them up as secrets where needed):

1. **Cloudflare Account ID** — top-right of Cloudflare dashboard. Needed for `wrangler.toml`.
2. **D1 database name and ID** — from `wrangler d1 list` or the Cloudflare dashboard → Workers & Pages → D1.
3. **D1 binding name** — the name you'll reference in the Worker (e.g. `DB`). Whatever you set in your existing binding.
4. **Worker name** — e.g. `hanami-api`. This determines the URL `https://hanami-api.<subdomain>.workers.dev`.
5. **Worker custom subdomain** (or the `workers.dev` default) — I need the full origin to set `redirect_uri` and CORS.
6. **`SESSION_SECRET`** — I'll generate this for you if you want; it's just a random 64-char string used to sign session cookies. Say the word and I'll mint it.
7. **Confirm the Google OAuth authorized redirect URIs** you've registered in Google Cloud Console include `https://<worker-origin>/api/auth/google/callback` and `http://localhost:8787/api/auth/google/callback` (for local dev). If not, you'll need to add them before login works.
8. **Which Lovable preview do you want to keep working during migration?** i.e. do we leave Supabase code in place until the Worker is proven up, or delete it immediately? I recommend leaving it until the Worker is verified.

## Why this shape and not "just rip out Supabase now"

- If I delete `src/integrations/supabase/*` today, your preview inside Lovable stops working for every screen. You lose the ability to test anything until the Worker is live and pointed at.
- Delivering the Worker as a parallel `cloudflare/` folder means: (a) your live app keeps working, (b) you can deploy the Worker at your pace, (c) if something is wrong we can iterate without breaking preview, (d) the cutover is one focused PR.
- Workers + D1 is the right Cloudflare architecture for this app. Not Pages Functions (D1 binding story is worse), not Durable Objects (overkill), not KV (wrong shape for relational data). D1 for OLTP, R2 later only if you add file uploads.

## Order of build (once you send the info above)

1. Stage 0 (gtag + auth redesign) — 1 turn.
2. Write `cloudflare/schema.sql` + `wrangler.toml` — 1 turn.
3. Write Worker auth + all route handlers — 2–3 turns.
4. Write data import script — 1 turn.
5. Frontend cutover PR (only when you say go) — 1 turn.

## Explicit non-goals

- I will not rotate or fabricate `SUPABASE_SERVICE_ROLE_KEY` or the Lovable Cloud DB password for the migration — they aren't accessible on Lovable Cloud. Data export uses my `psql` tool via the sandbox env vars, not those keys.
- I will not remove Lovable Cloud from the project mid-migration. Even after cutover, disabling Cloud is a one-way action done from the Connectors panel — not something I do in code.
- No email/password path in the new backend. Google-only, per your ask. If you later want email/password, that's a separate build.

Reply with the 8 items in "What I need from you" and I'll start with Stage 0 immediately and queue Stage 1.
