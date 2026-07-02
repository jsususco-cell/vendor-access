import { fv, type QBRecord } from "@/lib/quickbase";
import { JOB_FIELDS as J, SCHEDULE_FIELDS as S, ATTACHMENT_FIELDS as A, PO_FIELDS as P } from "@/lib/config";

/* ---------- Interfaces ---------- */

export interface VendorPortalVendor {
  name: string;
  company: string;
  jobs: boolean;
  schedule: boolean;
  photos: boolean;
  docs: boolean;
}

export interface AttachmentFile {
  url: string;
  fileName: string;
  uploaded: string;
  type: string; // "Image" | "File" | "W9" | "Byrdson Master Service Agreement" | etc.
  jobName: string;
  expirationDate: string;
}

/* ---------- Helpers ---------- */

function fmtDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtStatus(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  if (isNaN(n)) return String(value);
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)}% complete`;
}

function buildProxyUrl(rawUrl: string): string {
  // Quickbase returns "/files/buskqh28a/88/10/1" — proxy through /api/file/...
  if (!rawUrl) return "";
  return rawUrl.replace(/^\/files\//, "/api/file/");
}

export function extractAttachments(records: QBRecord[]): AttachmentFile[] {
  return records
    .map((rec) => {
      const fileField = fv<{ url?: string; versions?: { fileName?: string; uploaded?: string }[] }>(rec, A.attachment);
      const version = fileField?.versions?.[0];
      if (!version || !version.fileName) return null;
      return {
        url: buildProxyUrl(fileField?.url ?? ""),
        fileName: version.fileName,
        uploaded: version.uploaded ?? "",
        type: String(fv(rec, A.type) ?? "File"),
        jobName: String(fv(rec, A.jobName) ?? ""),
        expirationDate: String(fv(rec, A.expirationDate) ?? ""),
      };
    })
    .filter((a): a is AttachmentFile => a !== null);
}

function fileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "🖼";
  if (ext === "pdf") return "📄";
  return "📎";
}

/* ---------- Section Components ---------- */

function JobsSection({ jobs }: { jobs: QBRecord[] }) {
  return (
    <>
      <div className="section-label">Assigned Jobs</div>
      <div className="card full">
        {jobs.length === 0 ? (
          <div className="empty">No jobs are currently assigned to you.</div>
        ) : (
          jobs.map((job, i) => (
            <div className="job" key={i}>
              <div>
                <div className="j-name">{String(fv(job, J.name) ?? "Job")}</div>
                <div className="j-meta">
                  {[
                    fv(job, J.address),
                    J.dueDate > 0 && fv(job, J.dueDate)
                      ? `Due ${fmtDate(fv(job, J.dueDate))}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {J.status > 0 && fmtStatus(fv(job, J.status)) ? (
                <span className="pill">{fmtStatus(fv(job, J.status))}</span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function ScheduleSection({ scheduleItems }: { scheduleItems: QBRecord[] }) {
  const itemsWithDates = scheduleItems.filter(
    (si) => fv(si, S.startDate) || fv(si, S.endDate)
  );

  return (
    <>
      <div className="section-label">Schedule</div>
      <div className="card full">
        {itemsWithDates.length === 0 ? (
          <div className="empty">No scheduled milestones yet.</div>
        ) : (
          itemsWithDates.map((si, i) => {
            const phase = fv(si, S.phase);
            const pct = fv(si, S.percentComplete);
            return (
              <div className="job" key={i}>
                <div>
                  <div className="j-name">{String(fv(si, S.title) ?? "Milestone")}</div>
                  <div className="j-meta">
                    {phase ? `${String(phase)} · ` : ""}
                    {fv(si, S.startDate) ? `Start ${fmtDate(fv(si, S.startDate))}` : ""}
                    {fv(si, S.startDate) && fv(si, S.endDate) ? " → " : ""}
                    {fv(si, S.endDate) ? `End ${fmtDate(fv(si, S.endDate))}` : ""}
                    {fv(si, S.jobName) ? ` · ${String(fv(si, S.jobName))}` : ""}
                  </div>
                </div>
                {pct !== undefined && pct !== null ? (
                  <span className="pill">{fmtStatus(pct)}</span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function PhotosSection({ photos }: { photos: AttachmentFile[] }) {
  const imageFiles = photos.filter(
    (a) =>
      a.type === "Image" ||
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(a.fileName)
  );
  const otherFiles = photos.filter((a) => !imageFiles.includes(a));

  return (
    <>
      <div className="section-label">Photos &amp; Receipts</div>
      {photos.length === 0 ? (
        <div className="card full">
          <div className="empty">No photos or receipts uploaded yet.</div>
        </div>
      ) : (
        <>
          {imageFiles.length > 0 && (
            <div className="photo-grid">
              {imageFiles.map((file, i) => (
                <a
                  key={i}
                  href={file.url}
                  className="photo-tile"
                  title={`${file.fileName}${file.jobName ? ` — ${file.jobName}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="photo-icon">{fileIcon(file.fileName)}</div>
                  <div className="photo-name">{file.fileName}</div>
                  {file.jobName && <div className="photo-job">{file.jobName}</div>}
                </a>
              ))}
            </div>
          )}
          {otherFiles.length > 0 && (
            <div className="card full" style={{ marginTop: imageFiles.length > 0 ? 12 : 0 }}>
              {otherFiles.map((file, i) => (
                <div className="job" key={i}>
                  <div>
                    <div className="j-name">{file.fileName}</div>
                    <div className="j-meta">
                      {file.jobName ? `${file.jobName}` : ""}
                    </div>
                  </div>
                  <a href={file.url} className="pill" target="_blank" rel="noopener noreferrer">
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function DocsSection({ docs }: { docs: AttachmentFile[] }) {
  const complianceTypes = [
    "W9",
    "Byrdson Master Service Agreement",
    "General Liability Certificate",
    "Worker's Comp Certificate",
  ];
  const complianceDocs = docs.filter((a) => complianceTypes.includes(a.type));
  const otherDocs = docs.filter((a) => !complianceTypes.includes(a.type));

  return (
    <>
      <div className="section-label">Documents &amp; Notes</div>
      {docs.length === 0 ? (
        <div className="card full">
          <div className="empty">No documents available yet.</div>
        </div>
      ) : (
        <div className="card full">
          {complianceDocs.length > 0 && (
            <>
              <div className="sub-label">Compliance</div>
              {complianceDocs.map((doc, i) => (
                <div className="job" key={`c-${i}`}>
                  <div>
                    <div className="j-name">{doc.fileName}</div>
                    <div className="j-meta">
                      {doc.type}
                      {doc.expirationDate ? ` · Expires ${fmtDate(doc.expirationDate)}` : ""}
                      {doc.jobName ? ` · ${doc.jobName}` : ""}
                    </div>
                  </div>
                  <a href={doc.url} className="pill" target="_blank" rel="noopener noreferrer">
                    View
                  </a>
                </div>
              ))}
            </>
          )}
          {otherDocs.length > 0 && (
            <>
              {complianceDocs.length > 0 && <div style={{ marginTop: 8 }} />}
              {complianceDocs.length === 0 && <div className="sub-label">Files</div>}
              {otherDocs.map((doc, i) => (
                <div className="job" key={`o-${i}`}>
                  <div>
                    <div className="j-name">{doc.fileName}</div>
                    <div className="j-meta">
                      {doc.type !== "File" ? doc.type : "File"}
                      {doc.jobName ? ` · ${doc.jobName}` : ""}
                    </div>
                  </div>
                  <a href={doc.url} className="pill" target="_blank" rel="noopener noreferrer">
                    View
                  </a>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}

function PurchaseOrdersSection({ purchaseOrders }: { purchaseOrders: QBRecord[] }) {
  const statusColor = (status: string): string => {
    switch (status) {
      case "Released":
        return "var(--green)";
      case "Approved":
        return "var(--accent)";
      default:
        return "var(--muted)";
    }
  };

  return (
    <>
      <div className="section-label">Purchase Orders</div>
      <div className="card full">
        {purchaseOrders.length === 0 ? (
          <div className="empty">No purchase orders yet.</div>
        ) : (
          purchaseOrders.map((po, i) => {
            const status = String(fv(po, P.poStatus) ?? "");
            const work = String(fv(po, P.workStatus) ?? "");
            return (
              <div className="job" key={i}>
                <div>
                  <div className="j-name">{String(fv(po, P.title) ?? "Purchase Order")}</div>
                  <div className="j-meta">
                    {String(fv(po, P.poNumber) ?? "")}
                    {fv(po, P.jobName) ? ` · ${String(fv(po, P.jobName))}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {status && (
                    <span
                      className="pill"
                      style={{ color: statusColor(status), background: "var(--blue-soft)" }}
                    >
                      {status}
                    </span>
                  )}
                  {work && (
                    <span className="pill" style={{ fontSize: 10 }}>
                      {work}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* ---------- Main View ---------- */

export function VendorPortalView({
  vendor,
  jobs,
  scheduleItems,
  attachments,
  purchaseOrders,
  needsMapping,
}: {
  vendor: VendorPortalVendor;
  jobs: QBRecord[];
  scheduleItems: QBRecord[];
  attachments: AttachmentFile[];
  purchaseOrders: QBRecord[];
  needsMapping: boolean;
}) {
  const anySectionEnabled =
    vendor.jobs || vendor.schedule || vendor.photos || vendor.docs;

  return (
    <div className="shell">
      <header className="site-header">
        <div className="logo">
          <svg
            className="shield"
            viewBox="0 0 100 116"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Byrdson shield"
          >
            <path
              d="M50 4 L92 20 L92 60 C92 86 73 104 50 112 C27 104 8 86 8 60 L8 20 Z"
              fill="#ED2C20"
              stroke="#ffffff"
              strokeWidth="3"
            />
            <path d="M50 26 L74 44 L74 50 L68 50 L68 84 L32 84 L32 50 L26 50 L26 44 Z" fill="#ffffff" />
            <rect x="44" y="60" width="12" height="24" fill="#ED2C20" />
          </svg>
          <div>
            <div className="brandname">
              BYRDSON <span>SERVICES</span>
            </div>
            <div className="brandsub">Excello Homes</div>
          </div>
        </div>
        <div className="htitle">
          <h1>Vendor Portal</h1>
          <div className="stamp">
            Welcome{vendor.company ? `, ${vendor.company}` : `, ${vendor.name}`}
          </div>
        </div>
      </header>

      <main className="content">
        {needsMapping && (
          <div className="notice">
            Setup in progress — job field mapping isn&apos;t complete yet. Run
            <code> npm run introspect</code> and finish <code>lib/config.ts</code>.
          </div>
        )}

        {!anySectionEnabled && (
          <div className="notice">
            No sections have been enabled for your account yet. Your Byrdson project
            manager will grant access shortly.
          </div>
        )}

        {vendor.jobs && <JobsSection jobs={jobs} />}

        {vendor.schedule && <ScheduleSection scheduleItems={scheduleItems} />}

        {vendor.photos && <PhotosSection photos={attachments} />}

        {vendor.docs && (
          <DocsSection docs={attachments.filter((a) => a.type !== "Image")} />
        )}

        {/* Purchase Orders are always visible if there's data and Jobs are enabled */}
        {vendor.jobs && purchaseOrders.length > 0 && (
          <PurchaseOrdersSection purchaseOrders={purchaseOrders} />
        )}

        <div className="footnote">Byrdson Services · Private vendor access</div>
      </main>
    </div>
  );
}
