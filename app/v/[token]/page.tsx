import { queryRecords, fv, qbSafe, type QBRecord } from "@/lib/quickbase";
import {
  TABLES,
  VENDOR_FIELDS as V,
  JOB_FIELDS as J,
  sectionConfigured,
} from "@/lib/config";

export const dynamic = "force-dynamic";

interface VendorAccess {
  record: QBRecord;
  name: string;
  company: string;
  jobs: boolean;
  schedule: boolean;
  photos: boolean;
  docs: boolean;
  recordId: number;
}

async function loadVendor(token: string): Promise<VendorAccess | null> {
  if (V.token <= 0) return null; // not configured yet
  const safe = qbSafe(token);
  if (!safe) return null;

  // Only return an active/enabled invite. If the "active" flag isn't mapped yet,
  // fall back to matching on the token alone.
  const where =
    V.active > 0
      ? `{${V.token}.EX.'${safe}'}AND{${V.active}.EX.'1'}`
      : `{${V.token}.EX.'${safe}'}`;

  const select = [
    V.recordId,
    V.name,
    V.company,
    V.canViewJobs,
    V.canViewSchedule,
    V.canViewPhotos,
    V.canViewDocs,
  ].filter((f) => f > 0);

  const res = await queryRecords({ from: TABLES.vendors, where, select, options: { top: 1 } });
  const record = res.data?.[0];
  if (!record) return null;

  return {
    record,
    recordId: Number(fv(record, V.recordId) ?? 0),
    name: String(fv(record, V.name) ?? "Vendor"),
    company: String(fv(record, V.company) ?? ""),
    jobs: Boolean(fv(record, V.canViewJobs)),
    schedule: Boolean(fv(record, V.canViewSchedule)),
    photos: Boolean(fv(record, V.canViewPhotos)),
    docs: Boolean(fv(record, V.canViewDocs)),
  };
}

async function loadJobs(vendor: VendorAccess): Promise<QBRecord[]> {
  if (!sectionConfigured([J.name, J.vendorLink])) return [];
  const key = J.vendorLinkIsName ? qbSafe(vendor.name) : String(vendor.recordId);
  let where = `{${J.vendorLink}.EX.'${key}'}`;
  if (J.cancelled > 0) where += `AND{${J.cancelled}.EX.'0'}`; // hide cancelled jobs
  const select = [J.recordId, J.name, J.status, J.startDate, J.dueDate, J.address].filter(
    (f) => f > 0
  );
  const sortBy = J.dueDate > 0 ? [{ fieldId: J.dueDate, order: "ASC" as const }] : undefined;
  const res = await queryRecords({ from: TABLES.jobs, where, select, sortBy });
  return res.data ?? [];
}

function fmtDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// "Job - Average Percent Complete" comes back as a fraction (0.45) or a number (45).
function fmtStatus(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  if (isNaN(n)) return String(value);
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)}% complete`;
}

function InvalidLink() {
  return (
    <div className="center">
      <div className="card">
        <h1>Link not recognized</h1>
        <p>
          This invite link is invalid or has been disabled. Please contact your Byrdson
          project manager for a new link.
        </p>
      </div>
    </div>
  );
}

export default async function VendorPortal({ params }: { params: { token: string } }) {
  let vendor: VendorAccess | null = null;
  let loadError = false;
  try {
    vendor = await loadVendor(params.token);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="center">
        <div className="card">
          <h1>Temporarily unavailable</h1>
          <p>We couldn&apos;t load your portal right now. Please try again shortly.</p>
        </div>
      </div>
    );
  }
  if (!vendor) return <InvalidLink />;

  const jobs = vendor.jobs ? await loadJobs(vendor).catch(() => []) : [];
  const needsMapping = V.token > 0 && !sectionConfigured([J.name, J.vendorLink]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">B</span>
          BYRDSON SERVICES
        </div>
        <h1 className="page-title">Vendor Portal</h1>
        <p className="welcome">
          Welcome{vendor.company ? `, ${vendor.company}` : `, ${vendor.name}`}
        </p>
      </header>

      <main className="content">
        {needsMapping && (
          <div className="notice">
            Setup in progress — job field mapping isn&apos;t complete yet. Run
            <code> npm run introspect</code> and finish <code>lib/config.ts</code>.
          </div>
        )}

        {vendor.jobs && (
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
        )}

        {vendor.schedule && (
          <>
            <div className="section-label">Schedule</div>
            <div className="card full">
              {jobs.filter((j) => fv(j, J.dueDate) || fv(j, J.startDate)).length === 0 ? (
                <div className="empty">No scheduled dates yet.</div>
              ) : (
                jobs.map((job, i) => {
                  const start = fv(job, J.startDate);
                  const due = fv(job, J.dueDate);
                  if (!start && !due) return null;
                  return (
                    <div className="job" key={i}>
                      <div>
                        <div className="j-name">{String(fv(job, J.name) ?? "Job")}</div>
                        <div className="j-meta">
                          {start ? `Start ${fmtDate(start)}` : ""}
                          {start && due ? " · " : ""}
                          {due ? `Due ${fmtDate(due)}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {(vendor.photos || vendor.docs) && (
          <>
            <div className="section-label">Resources</div>
            <div className="grid">
              {vendor.photos && (
                <div className="card tile">
                  <div className="icon">▣</div>
                  <div className="t-title">Photos &amp; Receipts</div>
                  <div className="t-sub">Field photos and receipts</div>
                </div>
              )}
              {vendor.docs && (
                <div className="card tile">
                  <div className="icon">▤</div>
                  <div className="t-title">Documents &amp; Notes</div>
                  <div className="t-sub">Reports and shared files</div>
                </div>
              )}
            </div>
          </>
        )}

        {!vendor.jobs && !vendor.schedule && !vendor.photos && !vendor.docs && (
          <div className="notice">
            No sections have been enabled for your account yet. Your Byrdson project
            manager will grant access shortly.
          </div>
        )}

        <div className="footnote">Byrdson Services · Private vendor access</div>
      </main>
    </div>
  );
}
