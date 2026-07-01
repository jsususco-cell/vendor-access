# Byrdson Services — Vendor Portal

Login-free portal that lets external subcontractors/vendors view their assigned jobs,
schedule, photos/receipts, and documents — all backed by **Quickbase**, with per-vendor
access control.

## Architecture

| Piece | Where it runs | Auth |
|-------|---------------|------|
| **Vendor Portal Manager** (`code-page/vendor-access-manager.html`) | Quickbase **Code Page** (staff-only) | Staff's own QB session (temp token — no secret embedded) |
| **Vendor Portal** (`app/v/[token]`) | **Vercel** (Next.js) | Vendor's unique link token; QB user token held server-side |
| **Vendors + tokens + access flags** | Quickbase table `buskqh272` | — |
| **Assigned jobs** | Quickbase table `buskqh3eh` (Vendor Assignments) | — |

### Field mapping (already wired in `lib/config.ts` and the Code Page)

Vendors (`buskqh272`): name **100**, company **23**, email **28**, **token = AccessKey 66**
(reused, never overwritten), Portal: Active **168**, Can View Jobs/Schedule/Photos/Docs
**169 / 170 / 171 / 172** (created via `scripts/setup-fields.mjs`).

Assignments (`buskqh3eh`): job name **7**, address **30**, % complete **35**, due date **43**,
cancelled **12** (filtered out), **linked to vendor via fid 8 `Related Sub/Vendor`** = vendor Record ID#.

Why two pieces: a Quickbase Code Page can only load for someone **logged into your QB
realm**. Vendors have no QB account, so the *viewing* half must be served externally
(Vercel), which is where the login-free magic link resolves. The QB user token lives only
in Vercel's server environment — never in the browser.

## 1. Quickbase fields (already set up)

The five access-control checkboxes were created in `buskqh272` via
`scripts/setup-fields.mjs` (fids 168–172). The portal token reuses the existing
**AccessKey** (fid 66) on each vendor. Nothing else to add — the mapping is already in
`lib/config.ts` and the Code Page.

To re-run introspection at any time: `npm run introspect`.

## 2. Configure

```bash
cd byrdson-vendor-portal
npm install
```

`.env.local` already has `QB_REALM` + the token. **Rotate the token** — it was shared in
chat. In production it lives only in Vercel env vars.

## 3. Run locally

```bash
npm run dev
# then open a vendor's link:  http://localhost:3000/v/<their AccessKey from buskqh272>
```

To enable a vendor for a quick local test without the Code Page:
`node --env-file=.env.local scripts/seed-demo.mjs` (activates the vendor with the most
assignments and prints their link). Re-run with flags reset when done.

## 4. Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (or `vercel` CLI).
2. In **Vercel ▸ Project ▸ Settings ▸ Environment Variables**, add:
   - `QB_REALM`
   - `QB_USER_TOKEN`  ← secret
   - `QB_TABLE_VENDORS` = `buskqh272`
   - `QB_TABLE_JOBS` = `buskqh3eh`
   - `GMAIL_USER` = `admin@byrdsonservices.com`  *(automated email — see §6)*
   - `GMAIL_APP_PASSWORD` = *(16-char Google App Password — see §6)*  ← secret
   - `PORTAL_SEND_KEY` = *(random string; must match `SEND_KEY` in the Code Page)*  ← secret
   - `PORTAL_BASE` = your deployed URL (used to build links inside emails)
3. Deploy. Your portal base URL becomes e.g. `https://byrdson-vendors.vercel.app`.
4. Put that URL into the Code Page's `PORTAL_BASE`.

## 6. Automated invite email (Gmail)

The **Send invite** button POSTs to `/api/send-invite`, which emails the vendor from
`admin@byrdsonservices.com` via Gmail SMTP and marks `Invite Sent?` — no compose window.

**Google no longer allows SMTP with the normal account password.** You must use an
**App Password**:

1. On `admin@byrdsonservices.com`, enable **2-Step Verification**
   (Google Account ▸ Security).
2. Generate an **App Password** at <https://myaccount.google.com/apppasswords>
   (name it e.g. "Vendor Portal"). You get a 16-character code.
3. Put that code in Vercel as `GMAIL_APP_PASSWORD` (and in local `.env.local`).
4. Pick any random string for `PORTAL_SEND_KEY` (Vercel) and paste the **same** value into
   `SEND_KEY` in the Code Page CONFIG **inside Quickbase only** — the GitHub repo is public,
   so `SEND_KEY` stays blank in source.

If auto-send ever fails, staff can still **Copy → Email in Gmail** (opens Gmail compose).

> Workspace admins can alternatively use a Gmail **OAuth2 / service account** instead of an
> App Password; swap the nodemailer `auth` block in `app/api/send-invite/route.ts`.

## 5. Add the Code Page in Quickbase

1. Set `PORTAL_BASE` in `vendor-access-manager.html` to your Vercel URL.
2. Quickbase ▸ your app ▸ **Settings ▸ Pages ▸ New page ▸ Code page**, paste the file, save.
3. Add a button/link to it from the Field Hub dashboard for staff.

## How staff use it (Vendor Portal Manager)

- **Search** an existing vendor (it manages your `buskqh272` vendors — it does not create
  new records, so it never conflicts with your existing vendor/AccessKey system).
- Tick **Jobs / Schedule / Photos / Docs** to control what they see (saved instantly). #3 ✔
- Flip **Active** on. Un-flip it to revoke the link instantly. ✔
- Click **Copy link** → the vendor's private `…/v/<AccessKey>` URL. #2, #4 ✔
- Send that link. It opens with **no login**. #2 ✔

## Security notes

- The QB user token lives **only** in Vercel server env + your local `.env.local` — never in
  the browser, never in the Code Page (which uses a temp token from the staff session).
- The token reuses each vendor's existing **AccessKey** (256-bit hex). The portal returns a
  vendor only when the AccessKey matches **and** `Portal: Active` is checked.
- The portal `where` clause strips quotes/braces from the URL token to prevent query injection.
- **Rotate the QB user token** that was shared in chat.
- Consider adding an **Expires** date field later and filtering on it for time-limited links.
