# ARCHITECTURE.md — 師傅CRM (Shifu CRM)

Living document. Update this alongside `db/schema.sql` whenever a
session makes a real architectural decision, not just a new feature.
The blueprint describes the *plan*; this describes what's *actually
true* about the running app, including gaps the blueprint didn't
anticipate.

## Stack
- Next.js 16 (Turbopack), App Router, TypeScript
- Neon Postgres (serverless HTTP driver `@neondatabase/serverless`)
- NextAuth v4 (Credentials provider, JWT sessions)
- Vercel (hosting, Blob storage)
- LINE Messaging API (multi-tenant, one shared webhook URL)

## Multi-tenancy model
- `businesses` is the tenant root **and** the login/user table — there
  is no separate `users` table. Signing up creates one `businesses` row
  with `email` + `password_hash`.
- `businesses` itself has **no RLS** — a business can't leak into
  another business's `businesses` row scenario doesn't apply the same
  way (auth queries look up by `email`, not `business_id`).
- Every other tenant-owned table has RLS enforcing
  `business_id = current_setting('app.current_business_id')::bigint`
  (directly, or via a join up to `customers`/`quotes`/`jobs` for
  tables one level removed, like `properties` or `payments`).

## RLS wiring — read this before touching `lib/db.ts`
Neon's HTTP driver is **stateless per call** — there's no persistent
session, so a bare `SET app.current_business_id = X` in one request
would not carry over to the next. `queryUnsafe()` in `lib/db.ts` uses
`sql.transaction([...])` to send `set_config('app.current_business_id',
X, true)` and the real query as ONE atomic HTTP round-trip, every time.
Never call the database any other way for tenant-scoped tables.

**Neon-specific gotcha:** the default `neondb_owner` role has
`BYPASSRLS` permanently baked in. `FORCE ROW LEVEL SECURITY` (set on
every tenant table) only closes the table-*owner* bypass loophole —
it does nothing against a role with the separate `BYPASSRLS`
attribute. This means:
- The app's `DATABASE_URL` (in `.env.local` and Vercel) must point to
  the **`app_user`** role, which was created specifically without
  `BYPASSRLS`.
- `neondb_owner`'s connection string is reserved for running migrations
  in Neon's SQL Editor only — never use it as the app's `DATABASE_URL`,
  or every RLS policy silently does nothing.

## Auth
- NextAuth Credentials provider (`lib/auth.ts`), JWT session strategy.
- `session.user.businessId` is the one piece of data every API route
  needs — it's set in the `jwt`/`session` callbacks from the business's
  `id` at login.
- `/dashboard`, `/settings`, and everything else under the
  `app/(dashboard)/` route group is gated by
  `app/(dashboard)/layout.tsx` (server-side `getServerSession` redirect).

## Folder structure gotcha
`app/(dashboard)/...` is a Next.js **route group** — the parentheses
are invisible in the URL. `app/(dashboard)/settings/page.tsx` becomes
`/settings`, NOT `/dashboard/settings`. The actual `/dashboard` URL
needed its own nested folder: `app/(dashboard)/dashboard/page.tsx`.
Don't assume a page's URL includes `/dashboard` just because its file
lives under the `(dashboard)` folder.

## LINE integration — multi-tenant webhook routing
All businesses' LINE bots point their webhook at the SAME url:
`https://<domain>/api/line/webhook`. To figure out which business an
incoming event belongs to:
1. LINE includes a top-level `destination` field in every webhook
   payload — this is the bot's own LINE user ID.
2. We look up `businesses.line_bot_user_id = destination` to find the
   owning business.
3. THEN we verify the HMAC signature using that business's own
   `line_channel_secret` (never trust a request before this check).
4. Only after that do we process `events[]` (find/create the customer
   by `line_user_id`, scoped to that `business_id`, and insert into
   `messages`).

Common setup mistake (happened once already): pasting your own
personal LINE User ID into the "Bot User ID" field instead of the
bot's own ID (found in LINE console → Basic settings → "Your user
ID"). If the webhook returns 401 "Unknown channel" and you're sure the
values are right, expand the actual log entry in Vercel — don't trust
truncated log list previews, get the full value LINE actually sent.

## File storage — Vercel Blob
- Must explicitly choose **Public** access at store-creation time — the
  current dashboard UI defaults to Private, and access mode **cannot
  be changed after creation** (confirmed via Vercel's own docs). A
  Private store will make `put()` throw
  `"Cannot use public access on a private store."`
- Because of an earlier mis-click, this project has multiple Blob
  stores connected. The one actually in use is named with a
  `v3_` prefix (`v3_READ_WRITE_TOKEN`, `v3_STORE_ID`) — NOT the plain
  `BLOB_READ_WRITE_TOKEN` name you'd expect by default. Check
  `app/api/business/logo/route.ts` for which env var name is actually
  referenced before assuming the default name works.

## Known environment quirks (Windows/PowerShell)
- `Out-File -Encoding utf8` in Windows PowerShell adds a UTF-8 BOM,
  which breaks strict JSON parsers (this broke `vercel.json` once).
  Use `[System.IO.File]::WriteAllText(path, content, (New-Object
  System.Text.UTF8Encoding $false))` instead for any file a strict
  parser will read.
- Garbled Chinese text in PowerShell's `Get-Content` output (e.g.
  `撣怠?CRM` instead of `師傅CRM`) is just a terminal codepage display
  glitch, not real file corruption — confirmed harmless multiple times.

## Fixed reference data
- Trade type checkboxes (signup + settings): 水電, 家電維修, 鎖匠, 木工, 裝修
  — confirmed as the final list, not a placeholder.

## API route caching gotcha
GET API routes that read from the database must explicitly set
`export const dynamic = "force-dynamic";` and client-side `fetch()`
calls against them should pass `{ cache: "no-store" }`. Without both,
a plain browser refresh (not a hard refresh) can serve a stale
response — this caused customer list duplicates in Session 10 because
saves were succeeding but the list wasn't refetching. Apply this
pattern to every future list/detail API route, not just customers.

## Auth UX
`components/dashboard-nav.tsx` provides the sign-out button
(`next-auth/react`'s `signOut()`) plus quick links, rendered from
`app/(dashboard)/layout.tsx` so it appears on every gated page. There
was no way to log out at all until this was added in Session 10 —
worth remembering if a future session's UI seems to be missing basic
navigation, since more may still be missing.

## PowerShell text-editing gotcha
`Get-Content -Raw` / `-replace` / `Set-Content` on a file containing
Chinese (or any non-ASCII) text can silently corrupt it — PowerShell
reads/writes using the wrong codepage under the hood. This actually
happened once (not just the harmless terminal-display glitch
mentioned above — real corruption requiring a full file rewrite).
For any edit to a file with non-ASCII content, either use `str_replace`
equivalent tools carefully, or just rewrite the whole file fresh via
`[System.IO.File]::WriteAllText(path, content, (New-Object
System.Text.UTF8Encoding $false))` rather than a Get-Content/-replace
pipeline.

## Deployment
- Vercel project: `shifu-crm`, connected to
  `github.com/verymeanguy13-lab/shifu-crm`, `main` branch.
- Env vars needed in Vercel (Production/Preview/Development):
  `DATABASE_URL` (app_user connection string), `NEXTAUTH_SECRET`,
  `NEXTAUTH_URL` (real domain in prod, localhost in dev),
  `v3_READ_WRITE_TOKEN` (Blob).