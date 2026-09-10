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
   [Webhook] responds 200, then:
   [Download file] GET /v1/files/buskqh28a/{recordId}/10/1 → base64 (.json.data) + content-type
   [Build request] base64 → OpenAI input_file(PDF)/input_image + prompt
   [OpenAI (vision)] POST api.openai.com/v1/responses (gpt-4o-mini) ──ok──► [Parse date] ─┐
        └──on error──► [Build Gemini request] → [Gemini (vision)] → [Parse date (Gemini)] ─┤
                                                                                            ▼
                                                            [Write expiration] → fid 7 on {recordId}
```

**Fallback:** if the OpenAI node errors (credits/outage), the item routes to the Gemini branch
(`gemini-2.5-flash`, `googlePalmApi` credential) which reads the same file and writes the date.
✅ Verified: forcing an OpenAI failure, Gemini extracted + wrote `2024-12-31`.

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
- **Gemini gotcha:** `gemini-2.5-flash` spends "thinking" tokens that count against `maxOutputTokens`,
  so the fallback sets `thinkingConfig.thinkingBudget: 0` (and `maxOutputTokens: 256`) — otherwise the
  date gets truncated.
