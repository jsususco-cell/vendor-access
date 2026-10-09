import { NextResponse } from "next/server";
import {
  resolveVendor,
  getSchedule,
  getPurchaseOrders,
  getDailyLogs,
  getAttachments,
  getJobDetail,
  createDailyLog,
  uploadAttachment,
  getAssignedJobs,
} from "@/lib/portal";
import { QB_REALM, TABLES, INVOICE_TYPE } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const token = String(body?.token ?? "");
    const action = String(body?.action ?? "");

    const vendor = await resolveVendor(token);
    if (!vendor) {
      return NextResponse.json({ error: "invalid or disabled link" }, { status: 401 });
    }
    const id = vendor.recordId;
    const p = vendor.perms;

    switch (action) {
      case "schedule":
        if (!p.schedule) return NextResponse.json({ error: "no access" }, { status: 403 });
        return NextResponse.json({ items: await getSchedule(id) });

      case "purchase-orders": {
        if (!p.jobs) return NextResponse.json({ error: "no access" }, { status: 403 });
        const result = await getPurchaseOrders({
          vendorId: id,
          skip: body.skip ? Number(body.skip) : undefined,
          top: body.top ? Number(body.top) : undefined,
          status: body.status ? String(body.status) : undefined,
          search: body.search ? String(body.search) : undefined,
        });
        return NextResponse.json(result);
      }

      case "daily-logs":
        return NextResponse.json({ items: await getDailyLogs(id) });

      case "attachments":
        if (!p.photos && !p.docs) return NextResponse.json({ error: "no access" }, { status: 403 });
        return NextResponse.json({ items: await getAttachments(id) });

      case "job-detail":
        if (!p.jobs) return NextResponse.json({ error: "no access" }, { status: 403 });
        return NextResponse.json(await getJobDetail(id, Number(body.jobId)));

      case "create-daily-log": {
        const recordId = await createDailyLog(id, body.log ?? {});
        return NextResponse.json({ ok: true, recordId });
      }

      case "upload-attachment": {
        if (!p.photos && !p.docs) return NextResponse.json({ error: "no access" }, { status: 403 });
        const f = body.file ?? {};
        if (!f.fileName || !f.base64) {
          return NextResponse.json({ error: "file required" }, { status: 400 });
        }
        const jobId = body.jobId ? Number(body.jobId) : undefined;
        const dailyLogId = body.dailyLogId ? Number(body.dailyLogId) : undefined;
        const type = body.type ? String(body.type) : undefined;
        const expiration = body.expiration ? String(body.expiration) : undefined;
        const isPhoto = type === "Image" || !type;
        // Documents attach to the vendor (fid 8) — no job needed, so vendors with no
        // assigned jobs can still upload their certs/W9/COI. Photos may pin to a job.
        const recordId = await uploadAttachment(id, {
          jobId,
          dailyLogId,
          fileName: String(f.fileName),
          base64: String(f.base64),
          description: body.description ? String(body.description) : undefined,
          type,
          expiration,
        });
        // For documents with no expiration entered, hand off to the n8n Claude-vision
        // OCR pipeline (if configured) to read + write the expiration date (fid 7).
        if (!isPhoto && !expiration && process.env.N8N_OCR_WEBHOOK) {
          try {
            await fetch(process.env.N8N_OCR_WEBHOOK, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recordId, table: "buskqh28a", fileFid: 10, expirationFid: 7, type }),
            });
          } catch {
            /* non-fatal — vendor can still enter the date manually */
          }
        }
        return NextResponse.json({ ok: true, recordId });
      }

      case "upload-invoice": {
        if (!p.photos && !p.docs) return NextResponse.json({ error: "no access" }, { status: 403 });
        const f = body.file ?? {};
        if (!f.fileName || !f.base64) {
          return NextResponse.json({ error: "file required" }, { status: 400 });
        }
        // Job is required and must be one of this vendor's own assignments.
        const jobId = Number(body.jobId) || 0;
        const job = jobId ? (await getAssignedJobs(id)).find((j) => j.jobId === jobId) : undefined;
        if (!job) return NextResponse.json({ error: "Pick one of your jobs." }, { status: 400 });

        const description = body.description ? String(body.description) : undefined;
        // INVOICE_TEST_MODE=1 skips the Quickbase write so local runs never touch live
        // data; INVOICE_TEST_STATE lets a non-PR test vendor exercise the PR email path.
        const testMode = process.env.INVOICE_TEST_MODE === "1";
        const recordId = testMode
          ? 0
          : await uploadAttachment(id, {
              jobId,
              fileName: String(f.fileName),
              base64: String(f.base64),
              description,
              type: INVOICE_TYPE,
            });
        const state = (testMode && process.env.INVOICE_TEST_STATE) || vendor.state;

        // Recipients come from INVOICE_NOTIFY_TO; n8n only emails for PR vendors and
        // rejects calls without the shared key — see n8n/INVOICES.md.
        const notifyTo = (process.env.INVOICE_NOTIFY_TO ?? "")
          .split(",").map((s) => s.trim()).filter(Boolean).join(",");
        if (process.env.N8N_INVOICE_WEBHOOK && notifyTo) {
          try {
            await fetch(process.env.N8N_INVOICE_WEBHOOK, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-portal-key": process.env.N8N_INVOICE_KEY ?? "" },
              body: JSON.stringify({
                notifyTo,
                testMode,
                recordId,
                recordUrl: recordId ? `https://${QB_REALM}/db/${TABLES.attachments}?a=dr&rid=${recordId}` : "",
                vendorId: id,
                company: vendor.company,
                contact: vendor.name,
                vendorEmail: vendor.email,
                state,
                jobId,
                jobName: job.name,
                fileName: String(f.fileName),
                description: description ?? "",
                uploadedAt: new Date().toISOString(),
              }),
            });
          } catch {
            /* non-fatal — the invoice is saved either way */
          }
        }
        return NextResponse.json({ ok: true, recordId, testMode });
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
