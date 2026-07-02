import { queryRecords, fv, qbSafe, type QBRecord } from "@/lib/quickbase";
import {
  TABLES,
  VENDOR_FIELDS as V,
  JOB_FIELDS as J,
  SCHEDULE_FIELDS as S,
  ATTACHMENT_FIELDS as A,
  PO_FIELDS as P,
  sectionConfigured,
} from "@/lib/config";
import { VendorPortalView, extractAttachments } from "@/components/VendorPortalView";

export const dynamic = "force-dynamic";

/* ---------- Types ---------- */

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

/* ---------- Data loaders ---------- */

async function loadVendor(token: string): Promise<VendorAccess | null> {
  if (V.token <= 0) return null;
  const safe = qbSafe(token);
  if (!safe) return null;

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
  if (J.cancelled > 0) where += `AND{${J.cancelled}.EX.'0'}`;
  const select = [J.recordId, J.name, J.status, J.startDate, J.dueDate, J.address].filter(
    (f) => f > 0
  );
  const sortBy = J.dueDate > 0 ? [{ fieldId: J.dueDate, order: "ASC" as const }] : undefined;
  const res = await queryRecords({ from: TABLES.jobs, where, select, sortBy });
  return res.data ?? [];
}

async function loadSchedule(vendor: VendorAccess): Promise<QBRecord[]> {
  // Schedule Items linked directly to this vendor via Related Sub/Vendor (fid 343)
  const where = `{${S.relatedSubVendor}.EX.'${vendor.recordId}'}`;
  const select = [
    S.recordId, S.title, S.phase, S.percentComplete,
    S.startDate, S.endDate, S.jobName,
  ].filter((f) => f > 0);
  const sortBy = [{ fieldId: S.startDate, order: "ASC" as const }];
  const res = await queryRecords({ from: TABLES.schedule, where, select, sortBy });
  return res.data ?? [];
}

async function loadAttachments(vendor: VendorAccess): Promise<QBRecord[]> {
  // All attachments for this vendor (vendor-level + via jobs)
  const where = `{${A.relatedSubVendor}.EX.'${vendor.recordId}'}`;
  const select = [
    A.recordId, A.type, A.expirationDate, A.attachment, A.jobName,
  ].filter((f) => f > 0);
  const res = await queryRecords({ from: TABLES.attachments, where, select });
  return res.data ?? [];
}

async function loadPurchaseOrders(vendor: VendorAccess): Promise<QBRecord[]> {
  const where = `{${P.relatedSubVendor}.EX.'${vendor.recordId}'}`;
  const select = [
    P.recordId, P.title, P.poNumber, P.poStatus, P.workStatus, P.jobName,
  ].filter((f) => f > 0);
  const res = await queryRecords({ from: TABLES.purchaseOrders, where, select });
  return res.data ?? [];
}

/* ---------- Error / empty states ---------- */

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

function ErrorState() {
  return (
    <div className="center">
      <div className="card">
        <h1>Temporarily unavailable</h1>
        <p>We couldn&apos;t load your portal right now. Please try again shortly.</p>
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */

export default async function VendorPortal({ params }: { params: { token: string } }) {
  let vendor: VendorAccess | null = null;
  let loadError = false;
  try {
    vendor = await loadVendor(params.token);
  } catch {
    loadError = true;
  }

  if (loadError) return <ErrorState />;
  if (!vendor) return <InvalidLink />;

  // Fetch all data sections in parallel
  const [jobs, scheduleItems, attachmentRecords, purchaseOrders] = await Promise.all([
    vendor.jobs ? loadJobs(vendor).catch(() => [] as QBRecord[]) : ([] as QBRecord[]),
    vendor.schedule ? loadSchedule(vendor).catch(() => [] as QBRecord[]) : ([] as QBRecord[]),
    (vendor.photos || vendor.docs) ? loadAttachments(vendor).catch(() => [] as QBRecord[]) : ([] as QBRecord[]),
    vendor.jobs ? loadPurchaseOrders(vendor).catch(() => [] as QBRecord[]) : ([] as QBRecord[]),
  ]);

  const attachments = extractAttachments(attachmentRecords);
  const needsMapping = V.token > 0 && !sectionConfigured([J.name, J.vendorLink]);

  return (
    <VendorPortalView
      vendor={vendor}
      jobs={jobs}
      scheduleItems={scheduleItems}
      attachments={attachments}
      purchaseOrders={purchaseOrders}
      needsMapping={needsMapping}
    />
  );
}
