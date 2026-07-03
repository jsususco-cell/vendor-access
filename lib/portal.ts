import { queryRecords, createRecord, fv, qbSafe } from "./quickbase";
import {
  TABLES,
  VENDOR_FIELDS as V,
  JOB_FIELDS as J,
  SCHEDULE_FIELDS as S,
  PO_FIELDS as P,
  DAILYLOG_FIELDS as DL,
  ATTACH_FIELDS as A,
} from "./config";

export interface Vendor {
  recordId: number;
  company: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  perms: { jobs: boolean; schedule: boolean; photos: boolean; docs: boolean };
}

export interface Job {
  id: number;
  jobId: number; // the Jobs-table record id (for schedule lookup)
  name: string;
  status: unknown;
  due: unknown;
  address: unknown;
}

/** Resolve an active vendor by their portal token (AccessKey). */
export async function resolveVendor(token: string): Promise<Vendor | null> {
  const safe = qbSafe(token || "");
  if (!safe || V.token <= 0) return null;
  const where = `{${V.token}.EX.'${safe}'}AND{${V.active}.EX.'1'}`;
  const r = await queryRecords({
    from: TABLES.vendors,
    where,
    select: [
      V.recordId, V.name, V.company, V.email, V.phone, V.cell,
      V.street, V.city, V.state, V.postal,
      V.canViewJobs, V.canViewSchedule, V.canViewPhotos, V.canViewDocs,
    ],
    options: { top: 1 },
  });
  const row = r.data?.[0];
  if (!row) return null;
  const cityState = [fv(row, V.city), [fv(row, V.state), fv(row, V.postal)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const address = [fv(row, V.street), cityState].filter(Boolean).join(", ");
  return {
    recordId: Number(fv(row, V.recordId) ?? 0),
    company: String(fv(row, V.company) ?? ""),
    name: String(fv(row, V.name) ?? ""),
    email: String(fv(row, V.email) ?? ""),
    phone: String(fv(row, V.phone) ?? fv(row, V.cell) ?? ""),
    address,
    perms: {
      jobs: Boolean(fv(row, V.canViewJobs)),
      schedule: Boolean(fv(row, V.canViewSchedule)),
      photos: Boolean(fv(row, V.canViewPhotos)),
      docs: Boolean(fv(row, V.canViewDocs)),
    },
  };
}

/** Assigned jobs (Subs/Vendor Assignments), cancelled ones excluded. */
export async function getAssignedJobs(vendorId: number): Promise<Job[]> {
  let where = `{${J.vendorLink}.EX.'${vendorId}'}`;
  if (J.cancelled > 0) where += `AND{${J.cancelled}.EX.'0'}`;
  const r = await queryRecords({
    from: TABLES.jobs,
    where,
    select: [J.recordId, J.job, J.name, J.status, J.dueDate, J.address],
    sortBy: J.dueDate > 0 ? [{ fieldId: J.dueDate, order: "ASC" }] : undefined,
  });
  return (r.data ?? []).map((row) => ({
    id: Number(fv(row, J.recordId) ?? 0),
    jobId: Number(fv(row, J.job) ?? 0),
    name: String(fv(row, J.name) ?? "Job"),
    status: fv(row, J.status),
    due: fv(row, J.dueDate),
    address: fv(row, J.address),
  }));
}

/** Schedule items for all of a vendor's assigned jobs. */
export async function getSchedule(vendorId: number) {
  const jobs = await getAssignedJobs(vendorId);
  const jobIds = Array.from(new Set(jobs.map((j) => j.jobId).filter(Boolean))).slice(0, 120);
  if (!jobIds.length) return [];
  const where = jobIds.map((id) => `{${S.job}.EX.'${id}'}`).join("OR");
  return querySchedule(where);
}

async function querySchedule(where: string) {
  const r = await queryRecords({
    from: TABLES.schedule,
    where,
    select: [S.recordId, S.title, S.complete, S.percent, S.start, S.end, S.jobName, S.notes],
    sortBy: [{ fieldId: S.end, order: "ASC" }],
    options: { top: 300 },
  });
  return (r.data ?? []).map((row) => ({
    title: String(fv(row, S.title) ?? ""),
    job: String(fv(row, S.jobName) ?? ""),
    start: fv(row, S.start),
    end: fv(row, S.end),
    percent: Number(fv(row, S.percent) ?? 0),
    complete: Boolean(fv(row, S.complete)),
    notes: String(fv(row, S.notes) ?? ""),
  }));
}

export interface POQuery {
  vendorId: number;
  skip?: number;
  top?: number;
  status?: string;
  search?: string;
}

/** Purchase Orders for the vendor with optional pagination, status filter, and text search. */
export async function getPurchaseOrders(opts: POQuery): Promise<{ items: any[]; total: number }> {
  let where = `{${P.vendor}.EX.'${opts.vendorId}'}`;
  if (opts.status) where += `AND{${P.status}.EX.'${qbSafe(opts.status)}'}`;
  if (opts.search) {
    const s = qbSafe(opts.search);
    where += `AND({${P.title}.CT.'${s}'}OR{${P.poNum}.CT.'${s}'}OR{${P.jobName}.CT.'${s}'})`;
  }
  return queryPOs(where, { skip: opts.skip, top: opts.top });
}

async function queryPOs(where: string, pag?: { skip?: number; top?: number }): Promise<{ items: any[]; total: number }> {
  const r = await queryRecords({
    from: TABLES.purchaseOrders,
    where,
    select: [P.recordId, P.title, P.poNum, P.status, P.total, P.date, P.jobName, P.approvedBy],
    sortBy: [{ fieldId: P.date, order: "DESC" }],
    options: { skip: pag?.skip ?? 0, top: pag?.top ?? 200 },
  });
  return {
    items: (r.data ?? []).map((row) => ({
      title: String(fv(row, P.title) ?? ""),
      poNum: String(fv(row, P.poNum) ?? ""),
      status: String(fv(row, P.status) ?? ""),
      total: Number(fv(row, P.total) ?? 0),
      date: fv(row, P.date),
      job: String(fv(row, P.jobName) ?? ""),
      approvedBy: String(fv(row, P.approvedBy) ?? ""),
    })),
    total: r.metadata?.totalRecords ?? 0,
  };
}

/** Daily logs linked to this vendor. */
export async function getDailyLogs(vendorId: number) {
  return queryDailyLogs(`{${DL.vendor}.EX.'${vendorId}'}`);
}

async function queryDailyLogs(where: string) {
  const r = await queryRecords({
    from: TABLES.dailyLogs,
    where,
    select: [DL.recordId, DL.title, DL.actualDate, DL.date, DL.jobName, DL.notes, DL.work, DL.weather, DL.employees],
    sortBy: [{ fieldId: DL.actualDate, order: "DESC" }],
    options: { top: 200 },
  });
  return (r.data ?? []).map((row) => ({
    title: String(fv(row, DL.title) ?? "Daily Log"),
    date: fv(row, DL.actualDate) ?? fv(row, DL.date),
    job: String(fv(row, DL.jobName) ?? ""),
    notes: String(fv(row, DL.notes) ?? ""),
    work: String(fv(row, DL.work) ?? ""),
    weather: String(fv(row, DL.weather) ?? ""),
    employees: fv(row, DL.employees),
  }));
}

/** Attachments (photos/documents) linked to this vendor's daily logs. */
export async function getAttachments(vendorId: number) {
  // Step 1: find daily logs belonging to this vendor that have attachments
  const dlWhere = `{${DL.vendor}.EX.'${vendorId}'}AND{${DL.dlAttachCount}.GT.0}`;
  const dlRes = await queryRecords({
    from: TABLES.dailyLogs,
    where: dlWhere,
    select: [DL.recordId],
    options: { top: 500 },
  });
  const dlIds = (dlRes.data ?? []).map((r) => Number(fv(r, DL.recordId))).filter(Boolean);
  if (!dlIds.length) return [];

  // Step 2: fetch attachments linked to those daily logs
  const orClauses = dlIds.map((id) => `{${A.dailyLog}.EX.'${id}'}`);
  return queryAttachments(`(${orClauses.join("OR")})`);
}

async function queryAttachments(where: string) {
  const r = await queryRecords({
    from: TABLES.attachments,
    where,
    select: [A.recordId, A.fileName, A.desc, A.category, A.url, A.altUrl, A.created],
    sortBy: [{ fieldId: A.created, order: "DESC" }],
    options: { top: 200 },
  });
  return (r.data ?? []).map((row) => ({
    recordId: Number(fv(row, A.recordId) ?? 0),
    fileName: String(fv(row, A.fileName) ?? ""),
    desc: String(fv(row, A.desc) ?? ""),
    category: String(fv(row, A.category) ?? ""),
    url: String(fv(row, A.url) ?? fv(row, A.altUrl) ?? ""),
    created: fv(row, A.created),
  }));
}

/** Drill-down: everything tied to one job for this vendor. */
export async function getJobDetail(vendorId: number, jobId: number) {
  if (!jobId) return { schedule: [], pos: [], dailyLogs: [], attachments: [] };
  const [schedule, poResult, dailyLogs, attachments] = await Promise.all([
    querySchedule(`{${S.job}.EX.'${jobId}'}`),
    queryPOs(`{${P.job}.EX.'${jobId}'}AND{${P.vendor}.EX.'${vendorId}'}`),
    queryDailyLogs(`{${DL.job}.EX.'${jobId}'}AND{${DL.vendor}.EX.'${vendorId}'}`),
    queryAttachments(`{${A.job}.EX.'${jobId}'}AND{${A.vendor}.EX.'${vendorId}'}`),
  ]);
  return { schedule, pos: poResult.items, dailyLogs, attachments };
}

export interface DailyLogInput {
  jobId?: number;
  date?: string;
  title?: string;
  work?: string;
  employees?: number;
  phase?: "starting" | "continuing" | "finishing" | "";
  notes?: string;
  weather?: string;
  corrections?: boolean;
  correctionNotes?: string;
}

export async function createDailyLog(vendorId: number, input: DailyLogInput): Promise<number> {
  const data: Record<number, { value: unknown }> = { [DL.vendor]: { value: vendorId } };
  if (input.jobId) data[DL.job] = { value: input.jobId };
  if (input.date) data[DL.date] = { value: input.date };
  if (input.title) data[DL.title] = { value: input.title };
  if (input.work) data[DL.work] = { value: input.work };
  if (input.employees) data[DL.employees] = { value: input.employees };
  if (input.notes) data[DL.notes] = { value: input.notes };
  if (input.weather) data[DL.weather] = { value: input.weather };
  if (input.phase === "starting") data[DL.starting] = { value: true };
  if (input.phase === "continuing") data[DL.continuing] = { value: true };
  if (input.phase === "finishing") data[DL.finishing] = { value: true };
  if (input.corrections) data[DL.corrections] = { value: true };
  if (input.correctionNotes) data[DL.correctionNotes] = { value: input.correctionNotes };
  return createRecord(TABLES.dailyLogs, data);
}

export async function uploadAttachment(
  vendorId: number,
  input: { jobId?: number; fileName: string; base64: string; description?: string }
): Promise<number> {
  const data: Record<number, { value: unknown }> = {
    [A.vendor]: { value: vendorId },
    [A.file]: { value: { fileName: input.fileName, data: input.base64 } },
    [A.fileName]: { value: input.fileName },
  };
  if (input.jobId) data[A.job] = { value: input.jobId };
  if (input.description) data[A.desc] = { value: input.description };
  return createRecord(TABLES.attachments, data);
}
