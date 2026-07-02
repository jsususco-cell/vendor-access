import { NextResponse } from "next/server";
import { resolveVendor } from "@/lib/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proxy a Quickbase file attachment to the browser with inline disposition
 *  so PDFs/images render in-browser instead of downloading. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const qbUrl = searchParams.get("url") ?? "";
  const fileName = searchParams.get("fileName") ?? "file";

  // Auth check — same as the POST endpoint
  let vendor = null;
  try {
    vendor = await resolveVendor(token);
  } catch {
    // fall through
  }
  if (!vendor) {
    return NextResponse.json({ error: "invalid or disabled link" }, { status: 401 });
  }

  if (!qbUrl) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let fileRes: Response;
  try {
    fileRes = await fetch(qbUrl, { cache: "no-store" });
  } catch (e) {
    console.error("[file-proxy] fetch error", e);
    return NextResponse.json({ error: "failed to reach Quickbase" }, { status: 502 });
  }

  if (!fileRes.ok) {
    console.error("[file-proxy] QB returned", fileRes.status);
    return NextResponse.json(
      { error: `Quickbase returned ${fileRes.status}` },
      { status: 502 },
    );
  }

  const contentType =
    fileRes.headers.get("content-type") ?? "application/octet-stream";

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const inline =
    ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "txt"].includes(ext);

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set(
    "Content-Disposition",
    inline ? `inline; filename="${fileName}"` : `attachment; filename="${fileName}"`,
  );
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(fileRes.body, {
    status: fileRes.status,
    headers,
  });
}
