# n8n — Vendor Document OCR (expiration date)

Reads the **expiration date** off a vendor-uploaded document with Claude vision and writes it
back to the Attachments record (fid 7). The vendor portal then flags expired documents.

Workflow file: [`vendor-doc-ocr.json`](./vendor-doc-ocr.json) — import it into n8n
(**Workflows ▸ ⋯ ▸ Import from File**).

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

## Setup

1. **Import** `vendor-doc-ocr.json` into n8n.
2. **Provide credentials.** The nodes read these n8n environment variables (Settings ▸
   Environment, or your n8n host env):
   - `QB_USER_TOKEN` — a Quickbase user token with access to `buskqh272`/`buskqh28a`.
   - `ANTHROPIC_API_KEY` — your Anthropic API key.
   - `QB_REALM` *(optional)* — defaults to `byrdsonservices.quickbase.com`.
   - `ANTHROPIC_MODEL` *(optional)* — defaults to `claude-opus-5`. **For this simple,
     high-volume extraction, set it to `claude-haiku-4-5` or `claude-sonnet-5` to cut cost.**

   > Prefer n8n **credentials** over env vars? Swap the two QB header params for an
   > *HTTP Header Auth* credential (`Authorization: QB-USER-TOKEN …`) and the Claude
   > `x-api-key` header for an *Anthropic* / *Header Auth* credential. Env vars keep the
   > imported JSON self-contained; credentials keep secrets out of the workflow.

3. **Activate** the workflow, then copy its **Production webhook URL**
   (e.g. `https://<your-n8n>/webhook/vendor-doc-ocr`).
4. In **Vercel ▸ vendor-access ▸ Settings ▸ Environment Variables**, set
   **`N8N_OCR_WEBHOOK`** = that webhook URL, and redeploy.

That's it. When a vendor uploads a **Document** without typing an expiration, the portal calls
the webhook; n8n reads the date and writes fid 7; the expired badge/banner appears on the
vendor's next visit.

## Notes & limits

- **Verified against real data:** the QB download returns the file **base64-encoded** with the
  correct `content-type` (tested on a real ANG *Certificate of Insurance* PDF); Claude reads
  PDFs via a base64 `document` block (no beta header) and images via an `image` block.
- **Only PDFs and images** are OCR'd. A `.docx`/`.xlsx` won't be read — the vendor can type the
  date manually (the field is always available on the upload form).
- **New records only:** the portal fires OCR right after upload, so the file is always
  version `1`. (Re-uploads create new records, also version 1.)
- If Claude can't find an expiration it returns `NONE` and the workflow leaves fid 7 blank —
  correct for W9s and signed agreements that don't expire.
- Cost per doc is roughly one short vision call. Set `ANTHROPIC_MODEL` to a smaller model for
  volume; date extraction doesn't need Opus.
