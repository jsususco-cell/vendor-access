import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { queryRecords, fv, updateField } from "@/lib/quickbase";
import { TABLES, VENDOR_FIELDS as V } from "@/lib/config";

export const runtime = "nodejs"; // nodemailer needs the Node runtime, not edge
export const dynamic = "force-dynamic";

const SEND_KEY = process.env.PORTAL_SEND_KEY || "";
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || "";

// Only the Byrdson Quickbase realm may call this from the browser.
const ALLOWED_ORIGIN = "https://byrdsonservices.quickbase.com";
function cors() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-portal-key",
    Vary: "Origin",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

export async function POST(req: Request) {
  const headers = cors();
  try {
    // 1) auth
    if (!SEND_KEY || req.headers.get("x-portal-key") !== SEND_KEY) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    }
    if (!GMAIL_USER || !GMAIL_PASS) {
      return NextResponse.json(
        { error: "Email not configured — set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel." },
        { status: 500, headers }
      );
    }

    // 2) which vendor
    const body = await req.json().catch(() => ({}));
    const recordId = Number(body?.recordId);
    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400, headers });
    }

    // 3) look up email + token
    const res = await queryRecords({
      from: TABLES.vendors,
      where: `{3.EX.'${recordId}'}`,
      select: [V.recordId, V.name, V.company, V.email, V.token],
    });
    const row = res.data?.[0];
    if (!row) return NextResponse.json({ error: "vendor not found" }, { status: 404, headers });

    const email = String(fv(row, V.email) ?? "").trim();
    const token = String(fv(row, V.token) ?? "").trim();
    const name = String(fv(row, V.name) ?? fv(row, V.company) ?? "").trim();
    if (!email) {
      return NextResponse.json({ error: "vendor has no email on file" }, { status: 400, headers });
    }
    if (!token) {
      return NextResponse.json(
        { error: "vendor has no AccessKey/token yet" },
        { status: 400, headers }
      );
    }

    const origin = process.env.PORTAL_BASE?.replace(/\/$/, "") || new URL(req.url).origin;
    const link = `${origin}/v/${token}`;

    // 4) send via Gmail (App Password required — normal account passwords are rejected)
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });

    const subject = "Your Byrdson Services vendor portal access";
    const greeting = name ? ` ${name}` : "";
    const text =
      `Hello${greeting},\n\n` +
      `You've been given access to the Byrdson Services vendor portal. Use your private ` +
      `link below to view your assigned jobs, schedule, photos, and documents:\n\n${link}\n\n` +
      `This link is unique to you — please don't share it.\n\nThank you,\nByrdson Services`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2a37;line-height:1.55">
      <p>Hello${escapeHtml(greeting)},</p>
      <p>You've been given access to the <b>Byrdson Services vendor portal</b>. Use your private link below to view your assigned jobs, schedule, photos, and documents:</p>
      <p><a href="${link}" style="background:#00183D;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-weight:600">Open my vendor portal</a></p>
      <p style="font-size:12px;color:#6b7280">Or paste this link into your browser:<br><span style="font-family:monospace">${link}</span></p>
      <p style="font-size:12px;color:#6b7280">This link is unique to you — please don't share it.</p>
      <p>Thank you,<br><b>Byrdson Services</b></p>
    </div>`;

    await transporter.sendMail({
      from: `"Byrdson Services" <${GMAIL_USER}>`,
      to: email,
      subject,
      text,
      html,
    });

    // 5) mark Invite Sent? (best-effort)
    try {
      await updateField(TABLES.vendors, recordId, V.inviteSent, true);
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ ok: true, sentTo: email }, { headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502, headers });
  }
}
