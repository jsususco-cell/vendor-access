import { QB_REALM, QB_TOKEN } from "./config";

const API = "https://api.quickbase.com/v1";

function headers(): Record<string, string> {
  return {
    "QB-Realm-Hostname": QB_REALM,
    Authorization: `QB-USER-TOKEN ${QB_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "ByrdsonVendorPortal/1.0",
  };
}

export type QBRecord = Record<string, { value: unknown }>;

export interface QueryResult {
  data: QBRecord[];
  fields: { id: number; label: string; type: string }[];
  metadata: { totalRecords: number; numRecords: number };
}

/** Run a Quickbase records query. Token stays server-side. */
export async function queryRecords(params: {
  from: string;
  select?: number[];
  where?: string;
  sortBy?: { fieldId: number; order: "ASC" | "DESC" }[];
  options?: { top?: number };
}): Promise<QueryResult> {
  const res = await fetch(`${API}/records/query`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Quickbase query failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Update a single field on one record (by Record ID#). */
export async function updateField(
  tableId: string,
  recordId: number,
  fid: number,
  value: unknown
): Promise<void> {
  const res = await fetch(`${API}/records`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ to: tableId, data: [{ "3": { value: recordId }, [fid]: { value } }] }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Quickbase update failed (${res.status}): ${await res.text()}`);
  }
}

/** List a table's fields (used by the introspection script). */
export async function getFields(
  tableId: string
): Promise<{ id: number; label: string; fieldType: string }[]> {
  const res = await fetch(`${API}/fields?tableId=${tableId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Quickbase fields failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Safely read a value out of a Quickbase record by field id. */
export function fv<T = unknown>(record: QBRecord | undefined, fid: number): T | undefined {
  if (!record || fid <= 0) return undefined;
  return record[String(fid)]?.value as T | undefined;
}

/**
 * Escape a value for use inside a Quickbase query string literal.
 * Invite tokens come from the URL, so we strip characters that could break out
 * of the {fid.EX.'...'} literal. Tokens are UUID/hex, so this never alters a
 * legitimate value.
 */
export function qbSafe(value: string): string {
  return value.replace(/['"{}\\]/g, "");
}
