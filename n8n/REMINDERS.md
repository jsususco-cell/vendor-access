# n8n — Vendor Document Expiration Reminders (watcher)

Daily watcher that emails **Erin** + the vendor's **POC**, **BCC admin@byrdsonservices.com**, when a
vendor compliance document is nearing (or just past) its expiration date. When the POC uploads a
newer document of the same type, the old document's pending reminders **stop automatically**.

Workflow file: [`vendor-doc-reminders.json`](./vendor-doc-reminders.json). **Live in n8n**
(`https://n8n.byrdsonservices.com`, id `S3DPfSH9ZFqFgMGr`) — **created INACTIVE** for review.
This file is the source-of-truth copy.

## Milestones (relative to the expiration date)

| Stage | When | Meaning |
|------|------|---------|
| 1 | 30 days before | first heads-up |
| 2 | 15 days before | |
| 3 | 7 days before | |
| 4 | 1 day before | last call |
| 5 | 1 day after | lapsed |
| 6 | 5 days after | final follow-up |

Each stage sends **once**. Progress is stored per document in Attachments field
**fid 152 "Portal Reminder Stage"** (numeric). Because it stores the highest milestone already sent,
a missed cron day **catches up** (sends the current milestone once, never a backlog) and never
double-sends. The email always describes the **actual** days remaining/overdue, not the milestone name.

## Flow

```
[Daily 8am (Central)]  (schedule, timezone America/Chicago)
      │
[Query docs]     POST QB /records/query  buskqh28a  where {8.XEX''}AND{7.XEX''}  select 3,7,8,9,54,152
      │            (all vendor-linked Attachments that have an expiration date — ~24 today)
[Compute due]    group by (vendor fid8 + type fid54), keep the NEWEST record id  ← renewal supersede
      │            for each: daysUntil = exp − today; near-term gate −10..+30;
      │            dueStage = highest milestone reached; emit only if dueStage > stored stage
[Lookup vendor]  POST QB /records/query  buskqh272 {3.EX vendorId}  select 28,100,176 (email, contact, portal)
      │
[Build email]    To = Erin + POC(fid28);  subject/body with vendor, type, date + portal upload link
      │
[Send reminder]  Gmail (Byrdson Admin Gmail account) → To Erin+POC, BCC admin@byrdsonservices.com
      │
[Update stage]   POST QB /records  buskqh28a  set fid152 = dueStage   (only after the email sends)
```

## Renewal supersede ("if the POC uploads the new document, reminders stop")

The watcher groups documents by **vendor + document type** and only ever considers the **newest
record** in each group. When a POC uploads a renewed GL certificate, that new record becomes the
newest in the (vendor, "General Liability Certificate") group, so the old record is dropped from
consideration and its pending reminders stop. The new record starts fresh at stage 0 and is
reminded against its own (later) expiration date.

## First-run behavior (near-term only)

The `−10 .. +30` day gate means activating the watcher will **not** blast reminders for documents
that lapsed long ago (e.g. a COI that expired in 2024). Only documents expiring within ~30 days, or
that lapsed within the last ~10 days, are in scope. Older past-due docs are left untouched.

## Recipients

- **To:** `erin@excellohomes.com` (Erin Broussard) + the vendor's POC email (Subs fid 28), if present.
- **BCC:** `admin@byrdsonservices.com` (the watcher / audit copy).
- **From:** the **Byrdson Admin Gmail account** credential (= admin@byrdsonservices.com).

## Auth (reused, working credentials)

- **Quickbase (query + write):** n8n Header Auth credential **"Quickbase"** (`mcl3DtqT5jquGme8`) +
  manual `QB-Realm-Hostname: byrdsonservices.quickbase.com` header. Same credential the OCR workflow uses.
- **Gmail:** n8n **"Byrdson Admin Gmail account"** (`VFSVlQJu0WvJeCVE`), gmailOAuth2.

## Turn it on

Open the workflow in n8n, click **Execute workflow** once to preview (it runs the whole chain; with
recipients live it will email — to preview without sending, disable the *Send reminder* node first).
When satisfied, toggle the workflow **Active**. It then runs every day at **8:00 AM Central**.

## Notes & gotchas

- **Timezone is pinned** to `America/Chicago` in workflow settings (n8n schedules otherwise drift).
- **Stage field fid 152** on Attachments (buskqh28a) is the idempotency key — do not repurpose it.
- Any Attachment with an expiration date (fid 7) and a vendor link (fid 8) is watched, including W9 /
  MSA records that happen to have a date set. If a document type should never remind, leave fid 7 blank.
- Volume is tiny (~24 docs today); the per-item vendor lookup is fine. If it ever grows large, batch
  the vendor lookups into a single query.
