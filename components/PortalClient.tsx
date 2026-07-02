"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const FileViewer = dynamic(() => import("./FileViewer"), { ssr: false });

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
function pct(n: number): string {
  return Math.round((n <= 1 ? n * 100 : n) || 0) + "%";
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
  const [viewFile, setViewFile] = useState<{ fileName: string; proxyUrl: string; rawUrl: string } | null>(null);

  const makeProxyUrl = useCallback(
    (rawUrl: string, fileName: string) =>
      `/api/portal/file?token=${encodeURIComponent(token)}&url=${encodeURIComponent(rawUrl)}&fileName=${encodeURIComponent(fileName)}`,
    [token],
  );

  function openFileViewer(recordId: number, fileName: string, rawUrl: string) {
    const proxyUrl = makeProxyUrl(rawUrl, fileName);
    setViewFile({ fileName, proxyUrl, rawUrl });
  }

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

      {modal === "daily" && <DailyLogModal jobs={jobs} api={api} onClose={() => setModal(null)} />}
      {modal === "photos" && <PhotosModal jobs={jobs} api={api} onViewFile={openFileViewer} onClose={() => setModal(null)} />}
      {modal === "schedule" && (
        <ListModal title="Schedule" api={api} action="schedule" onClose={() => setModal(null)} empty="No schedule items yet." row={rowSchedule} detail={detailSchedule} />
      )}
      {modal === "jobs" && <JobsModal jobs={jobs} api={api} onViewFile={openFileViewer} onClose={() => setModal(null)} />}
      {modal === "pos" && <POModal api={api} onClose={() => setModal(null)} />}

      {viewFile && (
        <FileViewer
          fileName={viewFile.fileName}
          proxyUrl={viewFile.proxyUrl}
          rawUrl={viewFile.rawUrl}
          onClose={() => setViewFile(null)}
        />
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

function Modal({ title, onClose, onBack, children }: { title: string; onClose: () => void; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {onBack && <button className="modal-back" onClick={onBack} aria-label="Back">←</button>}
          <h2>{title}</h2>
          <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  return <div className="kv"><span>{label}</span><b>{String(value)}</b></div>;
}

function Row({ onClick, main, meta, right }: { onClick?: () => void; main: string; meta?: string; right?: React.ReactNode }) {
  return (
    <div className={"lrow" + (onClick ? " click" : "")} onClick={onClick}>
      <div><div className="l-name">{main}</div>{meta ? <div className="l-meta">{meta}</div> : null}</div>
      <div className="l-right">{right}{onClick ? <span className="chev">›</span> : null}</div>
    </div>
  );
}

/* ---------- Generic list modal with per-item drill-down ---------- */
function ListModal({
  title, api, action, onClose, empty, row, detail,
}: {
  title: string;
  api: (a: string, e?: Record<string, unknown>) => Promise<any>;
  action: string;
  onClose: () => void;
  empty: string;
  row: (item: any, i: number, onClick: () => void) => React.ReactNode;
  detail: (item: any) => React.ReactNode;
}) {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    api(action).then((d) => setItems(d.items || [])).catch((e) => setErr(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sel !== null && items) {
    return <Modal title={title} onClose={onClose} onBack={() => setSel(null)}>{detail(items[sel])}</Modal>;
  }
  return (
    <Modal title={title} onClose={onClose}>
      {err ? <div className="m-err">{err}</div> : items === null ? <div className="m-muted">Loading…</div> : items.length === 0 ? <div className="m-muted">{empty}</div> : items.map((it, i) => row(it, i, () => setSel(i)))}
    </Modal>
  );
}

const rowSchedule = (s: any, i: number, onClick: () => void) => (
  <Row key={i} onClick={onClick} main={s.title} meta={[s.job, s.start ? "Start " + fmtDate(s.start) : "", s.end ? "Due " + fmtDate(s.end) : ""].filter(Boolean).join(" · ")} right={<span className="pill">{s.complete ? "Done" : pct(s.percent)}</span>} />
);
const detailSchedule = (s: any) => (
  <div className="detail">
    <KV label="Task" value={s.title} />
    <KV label="Job" value={s.job} />
    <KV label="Start" value={s.start ? fmtDate(s.start) : ""} />
    <KV label="Due" value={s.end ? fmtDate(s.end) : ""} />
    <KV label="Progress" value={s.complete ? "Complete" : pct(s.percent)} />
    <KV label="Notes" value={s.notes} />
  </div>
);

const rowPO = (po: any, i: number, onClick: () => void) => (
  <Row key={i} onClick={onClick} main={po.poNum ? "PO " + po.poNum : po.title || "PO"} meta={[po.job, po.date ? fmtDate(po.date) : ""].filter(Boolean).join(" · ")} right={<>{po.total ? <span className="l-amt">{money(po.total)}</span> : null}{po.status ? <span className="pill">{po.status}</span> : null}</>} />
);
const detailPO = (po: any) => (
  <div className="detail">
    <KV label="PO #" value={po.poNum} />
    <KV label="Title" value={po.title} />
    <KV label="Job" value={po.job} />
    <KV label="Status" value={po.status} />
    <KV label="Total" value={po.total ? money(po.total) : ""} />
    <KV label="Date" value={po.date ? fmtDate(po.date) : ""} />
    <KV label="Approved by" value={po.approvedBy} />
  </div>
);

/* ---------- Job drill-down: mini-report ---------- */
function SubList({ title, items, render, links, onLinkClick }: { title: string; items: any[]; render: (it: any) => string; links?: boolean; onLinkClick?: (it: any) => void }) {
  return (
    <div className="sub">
      <div className="sub-h">{title}<span className="sub-cnt">{items.length}</span></div>
      {items.length === 0 ? <div className="m-muted sm">None</div> : items.map((it, i) =>
        links && onLinkClick && it.recordId
          ? <button key={i} className="sub-row link link-btn" onClick={() => onLinkClick(it)}>{render(it)}</button>
          : links && it.url
          ? <a key={i} className="sub-row link" href={it.url} target="_blank" rel="noopener">{render(it)}</a>
          : <div key={i} className="sub-row">{render(it)}</div>
      )}
    </div>
  );
}

function JobsModal({ jobs, api, onViewFile, onClose }: { jobs: Job[]; api: any; onViewFile: (recordId: number, fileName: string, rawUrl: string) => void; onClose: () => void }) {
  const [sel, setSel] = useState<Job | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState("");

  function open(job: Job) {
    setSel(job); setData(null); setErr("");
    api("job-detail", { jobId: job.jobId }).then(setData).catch((e: any) => setErr(String(e.message || e)));
  }

  if (sel) {
    return (
      <Modal title={sel.name} onClose={onClose} onBack={() => setSel(null)}>
        <div className="detail">
          <KV label="Address" value={String(sel.address || "")} />
          <KV label="Due" value={sel.due ? fmtDate(sel.due) : ""} />
        </div>
        {err ? <div className="m-err">{err}</div> : !data ? <div className="m-muted">Loading…</div> : (
          <>
            <SubList title="Schedule" items={data.schedule} render={(s) => `${s.title}${s.end ? " — " + fmtDate(s.end) : ""}`} />
            <SubList title="Purchase Orders" items={data.pos} render={(po) => `${po.poNum ? "PO " + po.poNum : po.title}${po.total ? " — " + money(po.total) : ""}${po.status ? " · " + po.status : ""}`} />
            <SubList title="Daily Logs" items={data.dailyLogs} render={(l) => `${l.title}${l.date ? " — " + fmtDate(l.date) : ""}`} />
            <SubList title="Files" items={data.attachments} render={(a) => a.fileName || "File"} links onLinkClick={(a) => a.recordId && onViewFile(a.recordId, a.fileName || "File", a.url || "")} />
          </>
        )}
      </Modal>
    );
  }

  return (
    <Modal title="Assigned Jobs" onClose={onClose}>
      {jobs.length === 0 ? <div className="m-muted">No jobs are currently assigned to you.</div> : jobs.map((j, i) => (
        <Row key={i} onClick={() => open(j)} main={j.name} meta={[String(j.address || ""), j.due ? "Due " + fmtDate(j.due) : ""].filter(Boolean).join(" · ")} />
      ))}
    </Modal>
  );
}

/* ---------- Purchase Orders with search, status filter, pagination ---------- */
const PAGE = 10;

function POModal({ api, onClose }: { api: any; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<any | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  const load = useCallback(
    async (pg: number, s: string, st: string) => {
      setLoading(true);
      try {
        const d = await api("purchase-orders", {
          skip: (pg - 1) * PAGE,
          top: PAGE,
          search: s || undefined,
          status: st || undefined,
        });
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
      } catch {
        // keep whatever we have
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    load(1, search, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setPage(1);
    load(1, search, status);
  }

  function goPage(pg: number) {
    if (pg < 1 || pg > totalPages || pg === page) return;
    setPage(pg);
    load(pg, search, status);
  }

  // Build visible page numbers (show up to 5 with ellipsis)
  function pageNumbers(): (number | "...")[] {
    const pages: (number | "...")[] = [];
    const max = 5;
    let start = Math.max(1, page - Math.floor(max / 2));
    let end = start + max - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - max + 1);
    }
    if (start > 1) pages.push(1, "...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) pages.push("...", totalPages);
    return pages;
  }

  if (sel) {
    return (
      <Modal title="Purchase Order" onClose={onClose} onBack={() => setSel(null)}>
        <div className="detail">
          <KV label="PO #" value={sel.poNum} />
          <KV label="Title" value={sel.title} />
          <KV label="Job" value={sel.job} />
          <KV label="Status" value={sel.status} />
          <KV label="Total" value={sel.total ? money(sel.total) : ""} />
          <KV label="Date" value={sel.date ? fmtDate(sel.date) : ""} />
          <KV label="Approved by" value={sel.approvedBy} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Purchase Orders" onClose={onClose}>
      <div className="po-toolbar">
        <input
          ref={searchRef}
          className="po-input"
          type="text"
          placeholder="Search title, PO #, job…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
        />
        <input
          ref={statusRef}
          className="po-input po-status"
          type="text"
          placeholder="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
        />
        <button className="po-btn" onClick={applyFilters}>Go</button>
      </div>

      {items.length === 0 && !loading && (
        <div className="m-muted">No purchase orders match.</div>
      )}
      {items.map((po, i) => (
        <Row
          key={`${(page - 1) * PAGE + i}`}
          onClick={() => setSel(po)}
          main={po.poNum ? "PO " + po.poNum : po.title || "PO"}
          meta={[po.job, po.date ? fmtDate(po.date) : ""].filter(Boolean).join(" · ")}
          right={
            <>
              {po.total ? <span className="l-amt">{money(po.total)}</span> : null}
              {po.status ? <span className="pill">{po.status}</span> : null}
            </>
          }
        />
      ))}
      {loading && <div className="m-muted">Loading…</div>}

      {totalPages > 1 && !loading && (
        <div className="po-pages">
          <button className="po-pg-btn" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            &lsaquo;
          </button>
          {pageNumbers().map((p, i) =>
            p === "..."
              ? <span key={`e${i}`} className="po-pg-ellipsis">&hellip;</span>
              : <button key={p} className={`po-pg-btn${p === page ? " po-pg-active" : ""}`} onClick={() => goPage(p)}>{p}</button>
          )}
          <button className="po-pg-btn" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
            &rsaquo;
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Daily Log create + list + per-log detail ---------- */
function DailyLogModal({ jobs, api, onClose }: { jobs: Job[]; api: any; onClose: () => void }) {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [f, setF] = useState<any>({ jobId: "", date: today(), title: "", employees: "", work: "", phase: "", weather: "", notes: "", corrections: false, correctionNotes: "" });
  const set = (k: string, v: unknown) => setF((s: any) => ({ ...s, [k]: v }));

  useEffect(() => {
    api("daily-logs").then((d: any) => setLogs(d.items || [])).catch(() => setLogs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sel !== null && logs) {
    const l = logs[sel];
    return (
      <Modal title="Daily Log" onClose={onClose} onBack={() => setSel(null)}>
        <div className="detail">
          <KV label="Title" value={l.title} />
          <KV label="Job" value={l.job} />
          <KV label="Date" value={l.date ? fmtDate(l.date) : ""} />
          <KV label="# on site" value={l.employees} />
          <KV label="Work done" value={l.work} />
          <KV label="Weather" value={l.weather} />
          <KV label="Notes" value={l.notes} />
        </div>
      </Modal>
    );
  }

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
        <Row key={i} onClick={() => setSel(i)} main={l.title} meta={[l.job, l.date ? fmtDate(l.date) : ""].filter(Boolean).join(" · ")} />
      ))}
    </Modal>
  );
}

/* ---------- Photos / Documents upload + list ---------- */
function PhotosModal({ jobs, api, onViewFile, onClose }: { jobs: Job[]; api: any; onViewFile: (recordId: number, fileName: string, rawUrl: string) => void; onClose: () => void }) {
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
        <Row
          key={i}
          onClick={a.recordId ? () => onViewFile(a.recordId, a.fileName || "File", a.url || "") : undefined}
          main={a.fileName || "File"}
          meta={[a.category, a.desc, a.created ? fmtDate(a.created) : ""].filter(Boolean).join(" · ")}
          right={a.recordId ? <span className="pill">View</span> : null}
        />
      ))}
    </Modal>
  );
}
