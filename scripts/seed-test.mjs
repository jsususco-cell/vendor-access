// Seed isolated test data for the Byrdson vendor portal.
// Creates a test vendor + job assignments, POs, daily logs, and an attachment.
// All records are tagged with "[TEST]" and linked to the test vendor only.
// SAFE: only INSERTs new records, never modifies existing data.
//
// Usage:
//   node --env-file=.env.local scripts/seed-test.mjs            # seed
//   node --env-file=.env.local scripts/seed-test.mjs --cleanup  # remove all test records

const CLEANUP = process.argv.includes("--cleanup");

// ── Environment ───────────────────────────────────────────────────────────────
const realm = process.env.QB_REALM;
const token = process.env.QB_USER_TOKEN;

if (!realm || !token) {
  console.error("ERROR: QB_REALM and QB_USER_TOKEN must be set in .env.local");
  process.exit(1);
}

// ── Table IDs ─────────────────────────────────────────────────────────────────
const VENDORS     = process.env.QB_TABLE_VENDORS ?? "buskqh272";
const JOBS        = process.env.QB_TABLE_JOBS    ?? "buskqh3eh";
const POS         = "bukmrrvkz";
const DAILY_LOGS  = "buskqh3gc";
const ATTACHMENTS = "buskqh28a";

// Anchor used to find the test vendor for both idempotency and cleanup.
// fid 66 (AccessKey) is a QB formula — cannot be set manually.
// We use company name (fid 23) as the stable anchor instead.
const TEST_COMPANY = "[TEST] Byrdson Seed Vendor";

// ── HTTP helpers ──────────────────────────────────────────────────────────────
const headers = {
  "QB-Realm-Hostname": realm,
  Authorization: `QB-USER-TOKEN ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "ByrdsonVendorPortal/1.0",
};

async function qPost(path, body) {
  const r = await fetch(`https://api.quickbase.com/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function qQuery(tableId, select, where) {
  return qPost("records/query", { from: tableId, select, where });
}

async function createRecord(tableId, data) {
  const res = await qPost("records", {
    to: tableId,
    data: [data],
    fieldsToReturn: [3],
  });
  const id =
    res?.metadata?.createdRecordIds?.[0] ??
    res?.data?.[0]?.["3"]?.value;
  if (!id) throw new Error(`createRecord in ${tableId} returned no ID. Response: ${JSON.stringify(res)}`);
  return id;
}

async function qDelete(tableId, where) {
  const r = await fetch(`https://api.quickbase.com/v1/records`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ from: tableId, where }),
  });
  if (!r.ok) throw new Error(`DELETE ${tableId} ${r.status}: ${await r.text()}`);
  return r.json();
}

function whereIds(ids) {
  return ids.map((id) => `{3.EX.'${id}'}`).join("OR");
}

// ── CLEANUP MODE ──────────────────────────────────────────────────────────────
if (CLEANUP) {
  console.log("\nCleaning up test data...\n");

  // Find test vendor by company name (fid 23) — fid 66 is a formula, can't be used as anchor
  const vRes = await qQuery(VENDORS, [3, 66], `{23.EX.'${TEST_COMPANY}'}`);
  if (!vRes.data.length) {
    console.log("No test vendor found — already cleaned up or never seeded.");
    process.exit(0);
  }
  const vendorId = vRes.data[0]["3"].value;
  const vendorToken = vRes.data[0]["66"]?.value ?? "(unknown)";
  console.log(`Found test vendor ID: ${vendorId} (token: ${vendorToken})`);

  // Delete all linked records per table
  const tables = [
    { name: "Job Assignments", tableId: JOBS,        vendorFid: 8  },
    { name: "Purchase Orders", tableId: POS,         vendorFid: 21 },
    { name: "Daily Logs",      tableId: DAILY_LOGS,  vendorFid: 36 },
    { name: "Attachments",     tableId: ATTACHMENTS, vendorFid: 8  },
  ];

  for (const { name, tableId, vendorFid } of tables) {
    const res = await qQuery(tableId, [3], `{${vendorFid}.EX.'${vendorId}'}`);
    if (!res.data.length) {
      console.log(`  ${name}: none found`);
      continue;
    }
    const ids = res.data.map((r) => r["3"].value);
    await qDelete(tableId, whereIds(ids));
    console.log(`  ${name}: deleted ${ids.length} record(s) [${ids.join(", ")}]`);
  }

  // Delete vendor last
  await qDelete(VENDORS, `{3.EX.'${vendorId}'}`);
  console.log(`  Vendor: deleted record ${vendorId}`);

  console.log("\nCleanup complete. All test records removed.\n");
  process.exit(0);
}

// ── SEED MODE ─────────────────────────────────────────────────────────────────

// Idempotency guard — find by company name
const existingCheck = await qQuery(VENDORS, [3, 66], `{23.EX.'${TEST_COMPANY}'}`);
if (existingCheck.data.length) {
  const existingId = existingCheck.data[0]["3"].value;
  const existingToken = existingCheck.data[0]["66"]?.value ?? "(unknown)";
  const base = process.env.PORTAL_BASE ?? "http://localhost:3000";
  console.error(
    `\nTest vendor already exists (ID: ${existingId}).\n` +
    `Portal URL: ${base}/v/${existingToken}\n\n` +
    `To remove it first:\n  node --env-file=.env.local scripts/seed-test.mjs --cleanup\n`
  );
  process.exit(1);
}

console.log("\nSeeding test data...\n");

// ── Step 1: Discover real job references ──────────────────────────────────────
// fid 7 (Job Name) and other fields in buskqh3eh are formulas/lookups.
// We only write fid 6 (Related Job) + fid 8 (Vendor) — job name auto-populates.
console.log("Looking up existing job records for reference...");
const jobsRes = await qQuery(JOBS, [3, 6, 7], "{6.GT.'0'}");
const realJobs = jobsRes.data
  .filter((r) => r["6"]?.value)
  .slice(0, 2)
  .map((r) => ({
    jobRecordId: r["6"].value,
    jobName: r["7"]?.value || "(job)",
  }));

if (!realJobs.length) {
  console.warn("WARNING: No existing job records found. Job assignments will be skipped.");
} else {
  realJobs.forEach((j, i) =>
    console.log(`  Job ref ${i + 1}: record #${j.jobRecordId} — "${j.jobName}"`)
  );
}

// ── Step 2: Create test vendor ────────────────────────────────────────────────
// fid 10 (State) is a dropdown — omitted to avoid invalid-choice errors.
// fid 66 (AccessKey) is a QB formula — QB auto-generates it; we read it back after creation.
console.log("\nCreating test vendor...");
const vendorId = await createRecord(VENDORS, {
  "23":  { value: TEST_COMPANY },                      // Company
  "100": { value: "Test Contact" },                    // Name
  "28":  { value: "test-seed@byrdson-noreply.test" }, // Email
  "26":  { value: "555-000-0000" },                   // Cell
  "7":   { value: "123 Test Street" },                // Street
  "9":   { value: "Testville" },                      // City
  "11":  { value: "00000" },                          // Postal
  "168": { value: true },                             // Portal: Active
  "169": { value: true },                             // Can View Jobs
  "170": { value: true },                             // Can View Schedule
  "171": { value: true },                             // Can View Photos
  "172": { value: true },                             // Can View Docs
});
console.log(`  Created vendor ID: ${vendorId}`);

// Read back the auto-generated portal token (fid 66 is a formula field)
const vRead = await qQuery(VENDORS, [66], `{3.EX.'${vendorId}'}`);
const portalToken = vRead.data[0]?.["66"]?.value ?? "";
if (!portalToken) {
  console.warn("  WARNING: Could not read portal token (fid 66). Portal URL may be incomplete.");
} else {
  console.log(`  Portal token (auto-generated): ${portalToken}`);
}

// ── Step 3: Create job assignments ────────────────────────────────────────────
const assignmentIds = [];
if (realJobs.length) {
  console.log("\nCreating job assignments...");
  for (const job of realJobs) {
    const id = await createRecord(JOBS, {
      "6": { value: job.jobRecordId }, // Related Job
      "8": { value: vendorId },        // Related Sub/Vendor
      // fid 12, 30, 35, 43 are lookup fields — QB rejects writes to them
    });
    assignmentIds.push(id);
    console.log(`  Created assignment ID: ${id} → job #${job.jobRecordId} "${job.jobName}"`);
  }
}

// ── Step 4: Create purchase orders ────────────────────────────────────────────
console.log("\nCreating purchase orders...");
const job1 = realJobs[0]?.jobRecordId ?? null;
const job2 = realJobs[1]?.jobRecordId ?? job1;

const po1 = await createRecord(POS, {
  "6":  { value: "[TEST] Framing Materials" }, // Title
  "15": { value: "Approved" },                 // Status
  "21": { value: vendorId },                   // Related Vendor
  "77": { value: "2026-06-01" },               // Date
  "78": { value: "Seed Script" },              // Approved By
  // fid 17 (PO Number) is a formula — auto-generated
  // fid 88 (Total) is a summary field — auto-calculated
  ...(job1 ? { "13": { value: job1 } } : {}), // Related Job
});
console.log(`  Created PO ID: ${po1} — "[TEST] Framing Materials"`);

const po2 = await createRecord(POS, {
  "6":  { value: "[TEST] Electrical Rough-In" }, // Title
  "21": { value: vendorId },                     // Related Vendor
  "77": { value: "2026-06-15" },                 // Date
  // fid 15 (Status) omitted — dropdown with restricted choices
  // fid 17 (PO Number) is a formula — auto-generated
  // fid 88 (Total) is a summary field — auto-calculated
  ...(job2 ? { "13": { value: job2 } } : {}),   // Related Job
});
console.log(`  Created PO ID: ${po2} — "[TEST] Electrical Rough-In"`);
const poIds = [po1, po2];

// ── Step 5: Create daily logs ─────────────────────────────────────────────────
// fid 10 (Permission) must be set to "Subs/Vendors" to match the portal filter
// {10.CT.'Subs/Vendors'} in getDailyLogs(). QB automation sets "Internal Users"
// by default, so we must set it explicitly here.
console.log("\nCreating daily logs...");
const log1 = await createRecord(DAILY_LOGS, {
  "36":  { value: vendorId },                             // Related Vendor
  "10":  { value: ["Subs/Vendors"] },                    // Permission — must match portal filter
  "109": { value: "2026-07-01" },                        // Date
  "9":   { value: "[TEST] Foundation Inspection Day" },  // Title
  "15":  { value: "Sunny, 82°F" },                       // Weather
  "16":  { value: "Seed test log 1. No action required." }, // Notes
  "113": { value: 3 },                                   // Employees
  "114": { value: "Inspected foundation forms. Verified rebar placement." }, // Work
  "115": { value: true },                                // Starting
  "116": { value: false },                               // Continuing
  "117": { value: false },                               // Finishing
  "119": { value: false },                               // Corrections Needed
  ...(job1 ? { "6": { value: job1 } } : {}),
});
console.log(`  Created daily log ID: ${log1} — "[TEST] Foundation Inspection Day"`);

const log2 = await createRecord(DAILY_LOGS, {
  "36":  { value: vendorId },                         // Related Vendor
  "10":  { value: ["Subs/Vendors"] },                 // Permission — must match portal filter
  "109": { value: "2026-07-02" },                     // Date
  "9":   { value: "[TEST] Framing Progress" },        // Title
  "15":  { value: "Partly Cloudy, 78°F" },            // Weather
  "16":  { value: "Seed test log 2. No action required." }, // Notes
  "113": { value: 5 },                                // Employees
  "114": { value: "Completed exterior wall framing on north side." }, // Work
  "115": { value: false },                            // Starting
  "116": { value: true },                             // Continuing
  "117": { value: false },                            // Finishing
  "119": { value: false },                            // Corrections Needed
  ...(job1 ? { "6": { value: job1 } } : {}),
});
console.log(`  Created daily log ID: ${log2} — "[TEST] Framing Progress"`);
const logIds = [log1, log2];

// ── Step 6: Create attachment record ─────────────────────────────────────────
// Posted directly on the Attachments table with vendor + job links (no daily log needed).
// Requires a job — skipped if none exist.
let attachmentId = null;
if (!job1) {
  console.log("\nSkipping attachment — no job record available.");
} else {
  console.log("\nCreating attachment record...");
  attachmentId = await createRecord(ATTACHMENTS, {
    "8":  { value: vendorId },                                        // Related Sub/Vendor
    "21": { value: job1 },                                           // Related Job
    "20": { value: "test-placeholder.txt" },                         // File Name
    "16": { value: "[TEST] Placeholder attachment for seed script" }, // Description
    // fid 52 (Category) omitted — restricted dropdown, unknown valid choices
    // fid 129 (URL) omitted — formula field, cannot be written
  });
  console.log(`  Created attachment ID: ${attachmentId}`);
}

// ── Manifest ──────────────────────────────────────────────────────────────────
const base = process.env.PORTAL_BASE ?? "http://localhost:3000";
console.log(`
╔══════════════════════════════════════════════════╗
║           SEED TEST DATA COMPLETE                ║
╚══════════════════════════════════════════════════╝

  Vendor ID:       ${vendorId}
  Assignment IDs:  ${assignmentIds.length ? assignmentIds.join(", ") : "(skipped — no existing jobs found)"}
  PO IDs:          ${poIds.join(", ")}
  Daily Log IDs:   ${logIds.join(", ")}
  Attachment ID:   ${attachmentId ?? "(skipped — no job)"}

  Portal URL:      ${base}/v/${portalToken}

  To clean up all test records:
    node --env-file=.env.local scripts/seed-test.mjs --cleanup
`);
