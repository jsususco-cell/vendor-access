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
  jobs: process.env.QB_TABLE_JOBS ?? "buskqh3eh", // Subs/Vendor Assignments
  schedule: "buskqh27f", // Schedule Items
  attachments: "buskqh28a", // Attachments
  dailyLogs: "buskqh3gc", // Daily Logs
  purchaseOrders: "bukmrrvkz", // Purchase Orders
};

// Schedule Items (buskqh27f)
export const SCHEDULE_FIELDS = {
  recordId: 3, title: 8, complete: 9, percent: 10, start: 12, end: 13, job: 20, jobName: 21, notes: 30,
  subVendor: 343,  // Related Sub/Vendor (FK to buskqh272) — filters schedule to a specific subvendor
};

// Purchase Orders (bukmrrvkz)
export const PO_FIELDS = {
  recordId: 3, title: 6, poNum: 17, status: 15, job: 13, jobName: 14, vendor: 21, total: 88, date: 77, approvedBy: 78,
};

// Daily Logs (buskqh3gc) — vendor-fillable subset
export const DAILYLOG_FIELDS = {
  recordId: 3, job: 6, jobName: 7, vendor: 36, date: 109, actualDate: 183,
  title: 9, notes: 16, weather: 15, employees: 113, work: 114,
  starting: 115, continuing: 116, finishing: 117, corrections: 119, correctionNotes: 120,
  permission: 10,    // Permissions (multitext — contains "Sub/Vendors" etc.)
  dlAttachCount: 53, // # of Attachment records
};

// Attachments (buskqh28a)
export const ATTACH_FIELDS = {
  recordId: 3, vendor: 8, job: 21, file: 10, fileName: 20, desc: 16, category: 52, url: 129, altUrl: 68, created: 1,
  dailyLog: 17,  // Related Daily Log (numeric link)
};

// ---- buskqh272 : Vendors (holds accounts + unique invite tokens + access flags) ----
export const VENDOR_FIELDS = {
  recordId: 3, // Record ID#
  name: 100, // Name of Primary Contact Person
  company: 23, // Company
  email: 28, // Email
  phone: 27, // Phone
  cell: 26, // Cell
  street: 7, // Street 1
  city: 9, // City
  state: 10, // State/Region
  postal: 11, // Postal Code
  token: 66, // AccessKey (reused as the unique portal token)
  inviteSent: 96, // Invite Sent? (checkbox)
  active: 168, // Portal: Active
  canViewJobs: 169, // Portal: Can View Jobs
  canViewSchedule: 170, // Portal: Can View Schedule
  canViewPhotos: 171, // Portal: Can View Photos
  canViewDocs: 172, // Portal: Can View Docs
};

// ---- buskqh3eh : Vendor Assignments (a job assigned to a sub/vendor) ----
export const JOB_FIELDS = {
  recordId: 3,
  job: 6, // Related Job (the Jobs-table record id — used to fetch schedule)
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
