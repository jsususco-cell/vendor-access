# n8n — Invoice upload notification (Puerto Rico)

When a vendor uploads an invoice in the portal (Photos / Documents ▸ **🧾 Invoice**), the portal
saves it to Attachments (`buskqh28a`, Type fid 54 = `Invoice`, Related Job fid 21) and tells n8n.
n8n emails staff **only if the vendor's State/Region (fid 10) is `Puerto Rico`**.

Workflow: **Vendor Portal - Invoice uploaded (PR notify)** — `https://n8n.byrdsonservices.com/workflow/tmr2OAFmIttwFHmB`
(Admin Byrdson project, published). Webhook: `https://n8n.byrdsonservices.com/webhook/vendor-invoice-uploaded`

```
Portal  upload-invoice (job required, must be one of the vendor's assignments)
  └─ POST N8N_INVOICE_WEBHOOK  header x-portal-key: N8N_INVOICE_KEY
       { notifyTo, company, contact, vendorEmail, state, jobId, jobName,
         fileName, description, recordId, recordUrl, testMode, uploadedAt }
       [Webhook] → [Settings] → [PR vendor + valid key?] ──true──► [Email staff] (Gmail → notifyTo)
                                                        └─false─► (nothing)
```

## Change who gets emailed

Set **`INVOICE_NOTIFY_TO`** in `.env.local` (and in Vercel for production), comma-separated:

```
INVOICE_NOTIFY_TO=leah@byrdsonservices.com,jonah@byrdsonservices.com
```

Locally the dev server picks the change up on save; on Vercel it needs a redeploy. Empty = no email.
Sender = Gmail credential **Rob Byrdson Gmail** on the *Email staff* node.

## Shared key

Because the portal now chooses the recipients, the public webhook would otherwise let anyone send
mail from the sender account to any address. The portal sends `N8N_INVOICE_KEY` as `x-portal-key`;
n8n compares its sha256 to `keyHash` in the **Settings** node and sends nothing on a mismatch.
To rotate: generate a new key, put it in the env, and put its sha256 in `keyHash`.

## Test locally without touching Quickbase

In `.env.local`:

```
INVOICE_TEST_MODE=1              # skip the Quickbase write (recordId 0, no link in email)
INVOICE_TEST_STATE=Puerto Rico   # treat the test vendor as PR to exercise the email path
N8N_INVOICE_WEBHOOK=https://n8n.byrdsonservices.com/webhook/vendor-invoice-uploaded
N8N_INVOICE_KEY=<shared key>
INVOICE_NOTIFY_TO=<comma-separated recipients>
```

Never set the two `INVOICE_TEST_*` vars in Vercel. Production needs `N8N_INVOICE_WEBHOOK`,
`N8N_INVOICE_KEY` and `INVOICE_NOTIFY_TO`.

## Gotchas

- The Gmail credential's Google Cloud project must have the **Gmail API enabled**, or sends fail
  with `403 SERVICE_DISABLED`.
- No Puerto Rico vendor currently has `Portal: Active` (fid 168) on, so none can reach the
  portal yet; test with an active vendor plus `INVOICE_TEST_STATE`.
