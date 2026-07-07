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
} from "@/lib/portal";

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
        if (!jobId && !dailyLogId) {
          return NextResponse.json({ error: "job or daily log required" }, { status: 400 });
        }
        const recordId = await uploadAttachment(id, {
          jobId,
          dailyLogId,
          fileName: String(f.fileName),
          base64: String(f.base64),
          description: body.description ? String(body.description) : undefined,
        });
        return NextResponse.json({ ok: true, recordId });
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
