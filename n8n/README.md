# n8n — Vendor Document OCR (expiration date)

Reads the **expiration date** off a vendor-uploaded document with **OpenAI vision** and writes it
back to the Attachments record (fid 7). The vendor portal then flags expired documents.

Workflow file: [`vendor-doc-ocr.json`](./vendor-doc-ocr.json). **Live + active in n8n**
(`https://n8n.byrdsonservices.com`, id `eqcDVcjThQmWAajZ`) — this file is the source-of-truth copy.
✅ **Verified end-to-end** on a real Certificate of Insurance PDF (extracted `2024-12-31`).

## Flow

```
Portal (document uploaded, no expiration typed)
  └─ POST N8N_OCR_WEBHOOK  { recordId, table:"buskqh28a", fileFid:10, expirationFid:7, type }
        │
   [Webhook]  responds 200 immediately, then:
   [Download file]   GET /v1/files/buskqh28a/{recordId}/10/1   → base64 (in .json.data) + content-type
   [Build request]   base64 → OpenAI input_file(PDF)/input_image + extraction prompt
   [OpenAI (vision)] POST api.openai.com/v1/responses (gpt-4o-mini) → "YYYY-MM-DD" or "NONE"
   [Parse date]      pull the date; if NONE/none-found → stop (fid 7 stays blank)
   [Write expiration] POST /v1/records  → sets Attachments fid 7 on {recordId}
```

Webhook URL: `https://n8n.byrdsonservices.com/webhook/vendor-doc-ocr`

## Auth (wired, working)

- **OpenAI (vision):** n8n Header Auth credential **"OpenAI - Authorization"** (`Authorization: Bearer …`). ✅
- **Quickbase (Download + Write):** n8n Header Auth credential **"Quickbase"** (`Authorization: QB-USER-TOKEN …`),
  plus the manual `QB-Realm-Hostname` header. ✅

## Turn it on for vendors

In **Vercel ▸ vendor-access ▸ Settings ▸ Environment Variables**, set
**`N8N_OCR_WEBHOOK`** = `https://n8n.byrdsonservices.com/webhook/vendor-doc-ocr`, and redeploy.
Then any Document uploaded without a typed expiration gets its date read + fid 7 filled automatically.

## Notes & gotchas (learned while wiring)

- **`n8n` env vars are blocked** in this instance (`access to env vars denied`) — so the model is
  hardcoded (`gpt-4o-mini`) and auth uses credentials, not `$env`.
- **The QB download's base64 lands in `item.json.data`** (n8n "Full Response"), **not** `.body` —
  the Build node reads `item.data`. Content-type (mime) comes from `item.headers['content-type']`.
- **OpenAI file input** uses the **Responses API** (`/v1/responses`) with `input_file`
  (`data:application/pdf;base64,…`) for PDFs and `input_image` for images.
- **Model:** `gpt-4o-mini` (cheap, vision + PDF). Change it in the Build request node if desired.
- **Only PDFs and images** are OCR'd; other types → vendor types the date manually.
- If OpenAI can't find an expiration it returns `NONE` and fid 7 stays blank (correct for W9s, agreements).
- **Fallback (optional):** a Google Gemini(PaLM) credential also exists in n8n — an error branch to
  Gemini can be added for resilience if OpenAI ever errors.
