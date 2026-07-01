// Create the portal's access-control checkbox fields in the Vendors table (buskqh272).
// Idempotent: skips any field whose label already exists. Prints the resulting fids.
//
// Usage:  node --env-file=.env.local scripts/setup-fields.mjs

const realm = process.env.QB_REALM;
const token = process.env.QB_USER_TOKEN;
const table = process.env.QB_TABLE_VENDORS ?? "buskqh272";

const headers = {
  "QB-Realm-Hostname": realm,
  Authorization: `QB-USER-TOKEN ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "ByrdsonVendorPortal/1.0",
};

const WANT = [
  "Portal: Active",
  "Portal: Can View Jobs",
  "Portal: Can View Schedule",
  "Portal: Can View Photos",
  "Portal: Can View Docs",
];

// existing fields
const existRes = await fetch(`https://api.quickbase.com/v1/fields?tableId=${table}`, { headers });
const existing = await existRes.json();
const byLabel = new Map(existing.map((f) => [f.label, f.id]));

const result = {};
for (const label of WANT) {
  if (byLabel.has(label)) {
    result[label] = { id: byLabel.get(label), created: false };
    continue;
  }
  const res = await fetch(`https://api.quickbase.com/v1/fields?tableId=${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ label, fieldType: "checkbox", addToForms: true }),
  });
  if (!res.ok) {
    console.error(`FAILED to create "${label}" (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  const f = await res.json();
  result[label] = { id: f.id, created: true };
}

console.log("\nPortal access fields in " + table + ":");
for (const [label, info] of Object.entries(result)) {
  console.log(`  fid ${String(info.id).padStart(4)}  ${info.created ? "(created)" : "(existing)"}  ${label}`);
}
console.log("");
