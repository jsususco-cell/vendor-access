# n8n — Vendor Document OCR (expiration date)

Reads the **expiration date** off a vendor-uploaded document with **Claude vision** and writes it
back to the Attachments record (fid 7). The vendor portal then flags expired documents.

Workflow file: [`vendor-doc-ocr.json`](./vendor-doc-ocr.json). **Live + active in n8n**
(`https://n8n.byrdsonservices.com`, id `eqcDVcjThQmWAajZ`) — this file is the source-of-truth copy.

## Flow

```
Portal (document uploaded, no expiration typed)
  └─ POST N8N_OCR_WEBHOOK  { recordId, table:"buskqh28a", fileFid:10, expirationFid:7, type }
        │
   [Webhook]  responds 200 immediately, then:
   [Download file]   GET /v1/files/buskqh28a/{recordId}/10/1   → base64 + content-type
   [Build request]   base64 → Claude document(PDF)/image block + extraction prompt
   [Claude (vision)] POST api.anthropic.com/v1/messages        → "YYYY-MM-DD" or "NONE"
   [Parse date]      pull the date; if NONE/none-found → stop (fid 7 stays blank)
   [Write expiration] POST /v1/records  → sets Attachments fid 7 on {recordId}
```

Webhook URL: `https://n8n.byrdsonservices.com/webhook/vendor-doc-ocr`

## Auth (how it's wired)

- **Claude (vision):** uses the existing n8n **"Anthropic API"** Header Auth credential
  (`x-api-key`). Already attached. ✅
- **Quickbase (Download + Write nodes):** set to *Header Auth* — attach a Quickbase credential:
  *HTTP Header Auth*, header `Authorization` = `QB-USER-TOKEN <your QB token>`. The realm header
  (`QB-Realm-Hostname: byrdsonservices.quickbase.com`) is already on the nodes.

Then in **Vercel ▸ vendor-access ▸ Settings ▸ Environment Variables**, set
**`N8N_OCR_WEBHOOK`** = the webhook URL above, and redeploy.

## Notes & limits

- **Model:** defaults to `claude-haiku-4-5` (cheap, fine for date extraction — matches the "flash"
  cost tier). Override with an `ANTHROPIC_MODEL` env var (e.g. `claude-sonnet-5`, `claude-opus-5`).
  Haiku takes no `effort`/thinking param, so the request omits `output_config`.
- **Claude** reads PDFs via a base64 `document` block (no beta header) and images via an `image`
  block; the media type comes from the QB download's `content-type`.
- **Verified:** the QB download returns the file base64-encoded with the right `content-type`
  (tested on a real ANG *Certificate of Insurance* PDF).
- **Only PDFs and images** are OCR'd. A `.docx`/`.xlsx` won't be read — the vendor can type the
  date manually (the field is always on the upload form).
- If Claude can't find an expiration it returns `NONE` and fid 7 stays blank — correct for W9s
  and signed agreements.
