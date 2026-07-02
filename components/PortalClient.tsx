"use client";

import { useEffect, useState } from "react";

interface Vendor {
  recordId: number;
  company: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  perms: { jobs: boolean; schedule: boolean; photos: boolean; docs: boolean };
}
interface Job {
  id: number;
  jobId: number;
  name: string;
  status: unknown;
  due: unknown;
  address: unknown;
}

type Modal = null | "daily" | "photos" | "schedule" | "jobs" | "pos";

function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function money(n: number): string {
  return "$" + Math.round(n || 0).toLocaleString();
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(new Error("could not read file"));
    r.readAsDataURL(file);
  });
}

export default function PortalClient({
  token,
  vendor,
  jobs,
}: {
  token: string;
  vendor: Vendor;
  jobs: Job[];
}) {
  const [modal, setModal] = useState<Modal>(null);

  async function api(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "HTTP " + res.status);
    return d;
  }

  const p = vendor.perms;

  return (
    <main className="content">
      {/* ===== Section 1: Vendor Information ===== */}
      <div className="section-label">Vendor Information</div>
      <div className="card full info">
        <div className="info-row"><span>Vendor</span><b>{vendor.company || vendor.name || "—"}</b></div>
        {vendor.name && vendor.company && (
          <div className="info-row"><span>Contact</span><b>{vendor.name}</b></div>
        )}
        <div className="info-row"><span>Address</span><b>{vendor.address || "—"}</b></div>
        <div className="info-row"><span>Email</span><b>{vendor.email || "—"}</b></div>
        <div className="info-row"><span>Phone</span><b>{vendor.phone || "—"}</b></div>
      </div>

      {/* ===== Section 2: Reporting ===== */}
      <div className="section-label">Reporting</div>
      <div className="grid">
        <Tile icon="📝" title="Daily Logs" sub="Submit a daily site log" onClick={() => setModal("daily")} />
        {(p.photos || p.docs) && (
          <Tile icon="📎" title="Photos / Documents" sub="Upload & view files" onClick={() => setModal("photos")} />
        )}
        {p.schedule && (
          <Tile icon="📅" title="View Schedule" sub="Milestone dates" onClick={() => setModal("schedule")} />
        )}
      </div>

      {/* ===== Section 3: Assignments ===== */}
      {p.jobs && (
        <>
          <div className="section-label">Assignments</div>
          <div className="grid">
            <Tile icon="🏗️" title="Assigned Jobs" sub={`${jobs.length} job${jobs.length === 1 ? "" : "s"}`} onClick={() => setModal("jobs")} />
            <Tile icon="🧾" title="Purchase Orders" sub="Your POs" onClick={() => setModal("pos")} />
          </div>
        </>
      )}

      <div className="footnote">Byrdson Services · Private vendor access</div>

      {modal === "daily" && (
        <DailyLogModal jobs={jobs} api={api} onClose={() => setModal(null)} />
      )}
      {modal === "photos" && (
        <PhotosModal jobs={jobs} api={api} onClose={() => setModal(null)} />
      )}
      {modal === "schedule" && (
        <ListModal title="Schedule" api={api} action="schedule" onClose={() => setModal(null)} render={renderSchedule} empty="No schedule items yet." />
      )}
      {modal === "jobs" && (
        <JobsModal jobs={jobs} onClose={() => setModal(null)} />
      )}
      {modal === "pos" && (
        <ListModal title="Purchase Orders" api={api} action="purchase-orders" onClose={() => setModal(null)} render={renderPOs} empty="No purchase orders yet." />
      )}
    </main>
  );
}

function Tile({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button className="card tile tile-btn" onClick={onClick}>
      <div className="icon">{icon}</div>
      <div className="t-title">{title}</div>
      <div className="t-sub">{sub}</div>
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Generic list modal (schedule, POs) ---------- */
function ListModal({
  title, api, action, render, empty, onClose,
}: {
  title: string;
  api: (a: string, e?: Record<string, unknown>) => Promise<any>;
  action: string;
  render: (items: any[]) => React.ReactNode;
  empty: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api(action).then((d) => setItems(d.items || [])).catch((e) => setErr(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Modal title={title} onClose={onClose}>
      {err ? <div className="m-err">{err}</div> : items === null ? <div className="m-muted">Loading…</div> : items.length === 0 ? <div className="m-muted">{empty}</div> : render(items)}
    </Modal>
  );
}

function renderSchedule(items: any[]) {
  return items.map((s, i) => (
    <div className="lrow" key={i}>
      <div><div className="l-name">{s.title}</div><div className="l-meta">{[s.job, s.start ? "Start " + fmtDate(s.start) : "", s.end ? "Due " + fmtDate(s.end) : ""].filter(Boolean).join(" · ")}</div></div>
      <span className="pill">{s.complete ? "Done" : Math.round((s.percent <= 1 ? s.percent * 100 : s.percent)) + "%"}</span>
    </div>
  ));
}
function renderPOs(items: any[]) {
  return items.map((po, i) => (
    <div className="lrow" key={i}>
      <div><div className="l-name">{po.poNum ? "PO " + po.poNum : po.title || "PO"}</div><div className="l-meta">{[po.job, po.date ? fmtDate(po.date) : ""].filter(Boolean).join(" · ")}</div></div>
      <div style={{ textAlign: "right" }}>
        {po.total ? <div className="l-name">{money(po.total)}</div> : null}
        {po.status ? <span className="pill">{po.status}</span> : null}
      </div>
    </div>
  ));
}

/* ---------- Assigned jobs (already loaded on the server) ---------- */
function JobsModal({ jobs, onClose }: { jobs: Job[]; onClose: () => void }) {
  return (
    <Modal title="Assigned Jobs" onClose={onClose}>
      {jobs.length === 0 ? <div className="m-muted">No jobs are currently assigned to you.</div> : jobs.map((j, i) => (
        <div className="lrow" key={i}>
          <div><div className="l-name">{j.name}</div><div className="l-meta">{[String(j.address || ""), j.due ? "Due " + fmtDate(j.due) : ""].filter(Boolean).join(" · ")}</div></div>
        </div>
      ))}
    </Modal>
  );
}

/* ---------- Daily Log create + list ---------- */
function DailyLogModal({ jobs, api, onClose }: { jobs: Job[]; api: any; onClose: () => void }) {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [f, setF] = useState<any>({ jobId: "", date: today(), title: "", employees: "", work: "", phase: "", weather: "", notes: "", corrections: false, correctionNotes: "" });
  const set = (k: string, v: unknown) => setF((s: any) => ({ ...s, [k]: v }));

  useEffect(() => {
    api("daily-logs").then((d: any) => setLogs(d.items || [])).catch(() => setLogs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setErr(""); setMsg("");
    if (!f.title && !f.work) return setErr("Add a title or describe the work done.");
    setSaving(true);
    try {
      await api("create-daily-log", {
        log: {
          jobId: f.jobId ? Number(f.jobId) : undefined,
          date: f.date || undefined,
          title: f.title || undefined,
          employees: f.employees ? Number(f.employees) : undefined,
          work: f.work || undefined,
          phase: f.phase || undefined,
          weather: f.weather || undefined,
          notes: f.notes || undefined,
          corrections: !!f.corrections,
          correctionNotes: f.correctionNotes || undefined,
        },
      });
      setMsg("Daily log submitted.");
      setF({ jobId: "", date: today(), title: "", employees: "", work: "", phase: "", weather: "", notes: "", corrections: false, correctionNotes: "" });
      api("daily-logs").then((d: any) => setLogs(d.items || []));
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Daily Logs" onClose={onClose}>
      <div className="m-sec">New Daily Log</div>
      <div className="m-grid">
        <label>Job
          <select value={f.jobId} onChange={(e) => set("jobId", e.target.value)}>
            <option value="">— select —</option>
            {jobs.map((j) => <option key={j.id} value={j.jobId}>{j.name}</option>)}
          </select>
        </label>
        <label>Date<input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
        <label>Title<input type="text" value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label># on site<input type="number" min="0" value={f.employees} onChange={(e) => set("employees", e.target.value)} /></label>
      </div>
      <label className="m-full">Work done today<textarea value={f.work} onChange={(e) => set("work", e.target.value)} /></label>
      <div className="m-radios">
        {["starting", "continuing", "finishing"].map((ph) => (
          <label key={ph}><input type="radio" name="phase" checked={f.phase === ph} onChange={() => set("phase", ph)} /> {ph[0].toUpperCase() + ph.slice(1)}</label>
        ))}
      </div>
      <label className="m-full">Weather<input type="text" value={f.weather} onChange={(e) => set("weather", e.target.value)} /></label>
      <label className="m-full">Notes<textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      <label className="m-check"><input type="checkbox" checked={f.corrections} onChange={(e) => set("corrections", e.target.checked)} /> Corrections needed?</label>
      {f.corrections && <label className="m-full">What corrections<textarea value={f.correctionNotes} onChange={(e) => set("correctionNotes", e.target.value)} /></label>}
      <div className="m-actions">
        <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit daily log"}</button>
        {msg && <span className="m-ok">{msg}</span>}
        {err && <span className="m-err">{err}</span>}
      </div>

      <div className="m-sec">Submitted logs</div>
      {logs === null ? <div className="m-muted">Loading…</div> : logs.length === 0 ? <div className="m-muted">None yet.</div> : logs.map((l, i) => (
        <div className="lrow" key={i}>
          <div><div className="l-name">{l.title}</div><div className="l-meta">{[l.job, l.date ? fmtDate(l.date) : ""].filter(Boolean).join(" · ")}</div></div>
        </div>
      ))}
    </Modal>
  );
}

/* ---------- Photos / Documents upload + list ---------- */
function PhotosModal({ jobs, api, onClose }: { jobs: Job[]; api: any; onClose: () => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api("attachments").then((d: any) => setItems(d.items || [])).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload() {
    setErr(""); setMsg("");
    if (!file) return setErr("Choose a file first.");
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      await api("upload-attachment", {
        file: { fileName: file.name, base64 },
        jobId: jobId ? Number(jobId) : undefined,
        description: desc || undefined,
      });
      setMsg("Uploaded.");
      setFile(null); setDesc("");
      api("attachments").then((d: any) => setItems(d.items || []));
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Photos / Documents" onClose={onClose}>
      <div className="m-sec">Upload a file</div>
      <div className="m-grid">
        <label>Job
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">— select —</option>
            {jobs.map((j) => <option key={j.id} value={j.jobId}>{j.name}</option>)}
          </select>
        </label>
        <label>Description<input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      </div>
      <label className="m-full">File<input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      <div className="m-actions">
        <button className="btn-primary" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
        {msg && <span className="m-ok">{msg}</span>}
        {err && <span className="m-err">{err}</span>}
      </div>

      <div className="m-sec">Files</div>
      {items === null ? <div className="m-muted">Loading…</div> : items.length === 0 ? <div className="m-muted">No files yet.</div> : items.map((a, i) => (
        <div className="lrow" key={i}>
          <div><div className="l-name">{a.fileName || "File"}</div><div className="l-meta">{[a.category, a.desc, a.created ? fmtDate(a.created) : ""].filter(Boolean).join(" · ")}</div></div>
          {a.url ? <a className="pill link-pill" href={a.url} target="_blank" rel="noopener">View</a> : null}
        </div>
      ))}
    </Modal>
  );
}
