# n8n — Vendor Document OCR (expiration date)

Reads the **expiration date** off a vendor-uploaded document with **Gemini Flash** (vision) and
writes it back to the Attachments record (fid 7). The vendor portal then flags expired docs.

Workflow file: [`vendor-doc-ocr.json`](./vendor-doc-ocr.json). **Already created + active in n8n**
(`https://n8n.byrdsonservices.com`, id `eqcDVcjThQmWAajZ`) — this file is the source-of-truth copy.

## Flow

```
Portal (document uploaded, no expiration typed)
  └─ POST N8N_OCR_WEBHOOK  { recordId, table:"buskqh28a", fileFid:10, expirationFid:7, type }
        │
   [Webhook]  responds 200 immediately, then:
   [Download file]   GET /v1/files/buskqh28a/{recordId}/10/1   → base64 + content-type
   [Build request]   base64 → Gemini inline_data block + extraction prompt
   [Gemini (vision)] POST generativelanguage…/{model}:generateContent → "YYYY-MM-DD" or "NONE"
   [Parse date]      pull the date; if NONE/none-found → stop (fid 7 stays blank)
   [Write expiration] POST /v1/records  → sets Attachments fid 7 on {recordId}
```

Webhook URL: `https://n8n.byrdsonservices.com/webhook/vendor-doc-ocr`

## Finish (auth + wiring)

The 3 HTTP nodes need credentials. Two ways:

- **n8n credentials (matches your other workflows).** Create two *HTTP Header Auth* creds:
  - Quickbase → header `Authorization` = `QB-USER-TOKEN <your QB token>`
  - Gemini → header `x-goog-api-key` = `<your Google AI Studio key>`

  Then set each HTTP node's *Authentication* → *Generic* → *Header Auth* → that credential.
  (QB nodes also keep the manual `QB-Realm-Hostname` header.)

- **n8n env vars.** If your n8n host allows `$env`, set `QB_USER_TOKEN` and `GEMINI_API_KEY`
  (optional `QB_REALM`, `GEMINI_MODEL`) and the workflow runs as-is.

Then in **Vercel ▸ vendor-access ▸ Settings ▸ Environment Variables**, set
**`N8N_OCR_WEBHOOK`** = the webhook URL above, and redeploy.

## Notes & limits

- **Gemini** reads both PDFs and images from one `inline_data` block (mime type comes straight
  from the QB download's `content-type`) — simpler than the Claude path.
- **Model:** defaults to `gemini-2.5-flash` (override with `GEMINI_MODEL`). Flash is cheap and
  strong at document date extraction.
- **Verified:** the QB download returns the file base64-encoded with the right `content-type`
  (tested on a real ANG *Certificate of Insurance* PDF).
- **Only PDFs and images** are OCR'd. A `.docx`/`.xlsx` won't be read — the vendor can type the
  date manually (the field is always on the upload form).
- If Gemini can't find an expiration it returns `NONE` and fid 7 stays blank — correct for W9s
  and signed agreements.
