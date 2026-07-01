// Discover the field ids in your Quickbase tables so you can fill in lib/config.ts.
//
// Usage:  npm run introspect        (loads .env.local automatically)
//
// Requires QB_REALM + QB_USER_TOKEN in .env.local.

const realm = process.env.QB_REALM;
const token = process.env.QB_USER_TOKEN;
const tables = {
  "Vendors (buskqh272)": process.env.QB_TABLE_VENDORS ?? "buskqh272",
  "Jobs (buskqh3eh)": process.env.QB_TABLE_JOBS ?? "buskqh3eh",
};

if (!realm || !token) {
  console.error("\n  Missing QB_REALM or QB_USER_TOKEN in .env.local\n");
  process.exit(1);
}

const headers = {
  "QB-Realm-Hostname": realm,
  Authorization: `QB-USER-TOKEN ${token}`,
  "User-Agent": "ByrdsonVendorPortal/1.0",
};

for (const [label, tableId] of Object.entries(tables)) {
  const res = await fetch(`https://api.quickbase.com/v1/fields?tableId=${tableId}`, {
    headers,
  });
  if (!res.ok) {
    console.error(`\n${label}: request failed (${res.status})`);
    console.error(await res.text());
    continue;
  }
  const fields = await res.json();
  console.log(`\n===== ${label} =====`);
  for (const f of fields.sort((a, b) => a.id - b.id)) {
    console.log(`  fid ${String(f.id).padStart(4)}  ${f.fieldType.padEnd(14)}  ${f.label}`);
  }
}
console.log("\nCopy the relevant fids into lib/config.ts.\n");
