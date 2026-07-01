// One-off: find a vendor that has assignments in buskqh3eh, enable the portal for
// them (AccessKey token + Portal:Active + all view flags), and print the test link.
// Usage: node --env-file=.env.local scripts/seed-demo.mjs

const realm = process.env.QB_REALM;
const token = process.env.QB_USER_TOKEN;
const VENDORS = process.env.QB_TABLE_VENDORS ?? "buskqh272";
const JOBS = process.env.QB_TABLE_JOBS ?? "buskqh3eh";
const headers = {
  "QB-Realm-Hostname": realm,
  Authorization: `QB-USER-TOKEN ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "ByrdsonVendorPortal/1.0",
};

async function q(path, body) {
  const r = await fetch(`https://api.quickbase.com/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

// Which vendor has the most assignments?
const asg = await q("records/query", { from: JOBS, select: [8], where: "{8.GT.'0'}" });
const counts = {};
for (const rec of asg.data) {
  const v = rec["8"]?.value;
  if (v) counts[v] = (counts[v] || 0) + 1;
}
const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
if (!ranked.length) {
  console.log("No vendor assignments found in " + JOBS);
  process.exit(0);
}
const [vendorId, n] = ranked[0];
const demoToken = "demo-" + vendorId + "-portal";

await q("records", {
  to: VENDORS,
  data: [
    {
      "3": { value: Number(vendorId) },
      "66": { value: demoToken },
      "168": { value: true },
      "169": { value: true },
      "170": { value: true },
      "171": { value: true },
      "172": { value: true },
    },
  ],
});

// read back the name
const v = await q("records/query", {
  from: VENDORS,
  select: [3, 100, 23],
  where: `{3.EX.'${vendorId}'}`,
});
const name = v.data[0]?.["100"]?.value || v.data[0]?.["23"]?.value || "(vendor)";
console.log(`\nEnabled portal for vendor #${vendorId} "${name}" (${n} assignments)`);
console.log(`Test link:  /v/${demoToken}\n`);
