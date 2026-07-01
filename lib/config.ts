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

export function sectionConfigured(fids: number[]): boolean {
  return fids.every((f) => f > 0);
}
