// Central Quickbase configuration.
//
// Table IDs are known. Field IDs (fids) below are placeholders (0) until you run
// `npm run introspect`, which prints every field's id/label so you can fill these in.
// The vendor portal renders a "needs configuration" notice for any section whose
// fids are still 0, so nothing breaks before the mapping is complete.

export const QB_REALM = process.env.QB_REALM ?? "";
export const QB_TOKEN = process.env.QB_USER_TOKEN ?? "";

export const TABLES = {
  vendors: process.env.QB_TABLE_VENDORS ?? "buskqh272",
  jobs: process.env.QB_TABLE_JOBS ?? "buskqh3eh",
  schedule: "buskqh27f",
  attachments: "buskqh28a",
  purchaseOrders: "bukmrrvkz",
};

// ---- buskqh272 : Vendors (holds accounts + unique invite tokens + access flags) ----
export const VENDOR_FIELDS = {
  recordId: 3, // Record ID#
  name: 100, // Name of Primary Contact Person
  company: 23, // Company
  email: 28, // Email
  token: 66, // AccessKey (reused as the unique portal token)
  active: 168, // Portal: Active
  canViewJobs: 169, // Portal: Can View Jobs
  canViewSchedule: 170, // Portal: Can View Schedule
  canViewPhotos: 171, // Portal: Can View Photos
  canViewDocs: 172, // Portal: Can View Docs
};

// ---- buskqh3eh : Vendor Assignments (a job assigned to a sub/vendor) ----
export const JOB_FIELDS = {
  recordId: 3,
  name: 7, // Job Name
  status: 35, // Job - Average Percent Complete (rendered as "NN% complete")
  startDate: 0, // no start-date field on this table
  dueDate: 43, // Schedule Item - Editable End Date
  address: 30, // Job - Address
  cancelled: 12, // Cancelled Job (checkbox) — filtered out
  // Links an assignment to a vendor: fid 8 stores the vendor's Record ID#.
  vendorLink: 8, // Related Sub/Vendor
  vendorLinkIsName: false,
};

// ---- buskqh27f : Schedule Items (milestones, phases, dates) ----
export const SCHEDULE_FIELDS = {
  recordId: 3,
  title: 8, // Title
  phase: 11, // Phase (e.g. "1. Pre Construction")
  percentComplete: 10, // Percent Complete
  startDate: 12, // Start Date
  endDate: 92, // Editable End Date
  relatedJob: 20, // Related Job → buskqh27b
  jobName: 21, // Job Name (lookup)
  relatedSubVendor: 343, // Related Sub/Vendor → buskqh272
};

// ---- buskqh28a : Attachments (files, photos, compliance docs) ----
export const ATTACHMENT_FIELDS = {
  recordId: 3,
  type: 6, // Type - Historical (Image / File / W9 / BMSA / GLC / etc.)
  expirationDate: 7, // Expiration Date
  relatedSubVendor: 8, // Related Sub/Vendor → buskqh272
  subVendorCompany: 9, // Sub/Vendor - Company (lookup)
  attachment: 10, // Attachment (file field)
  relatedJob: 21, // Related Job → buskqh27b
  jobName: 22, // Job Name (lookup)
  cancelledJob: 28, // Cancelled Job (lookup)
};

// ---- bukmrrvkz : Purchase Orders ----
export const PO_FIELDS = {
  recordId: 3,
  title: 6, // Title
  poNumber: 17, // PO #
  poStatus: 15, // PO Status (Approved / Unreleased / Released)
  workStatus: 16, // Work Status Options
  relatedJob: 13, // Related Job → buskqh27b
  jobName: 14, // Job Name (lookup)
  relatedSubVendor: 21, // Related Sub/Vendor → buskqh272
  performedBy: 22, // Performed By (lookup)
  email: 45, // Email (lookup)
};

export function sectionConfigured(fids: number[]): boolean {
  return fids.every((f) => f > 0);
}
