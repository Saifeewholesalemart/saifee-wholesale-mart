/**
 * Salesman location tracking (server side).
 * Table: salesman_locations (supabase/019_salesman_tracking.sql)
 *
 * Salesmen send points only while on duty (PWA open). Admin reads them.
 * Points older than RETENTION_DAYS are removed automatically.
 */

import { executeRawQuery } from './serverDb';

export const TRACKING_KINDS = ['ping', 'duty_start', 'duty_end', 'order', 'consent'] as const;
export type TrackingKind = typeof TRACKING_KINDS[number];

export const RETENTION_DAYS = 90;
const MAX_POINTS_PER_REQUEST = 100;

export interface TrackingPointInput {
  kind: TrackingKind;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  battery?: number | null;
  ref_id?: string | null;
  ref_label?: string | null;
  recorded_at: string;
}

export type TrackingPoint = {
  user_id: string;
  kind: TrackingKind;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  battery_pct: number | null;
  ref_id: string | null;
  ref_label: string | null;
  recorded_at: string;
};

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function text(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, maxLen) : null;
}

/** Cleans what the phone sent. Bad points are dropped, never trusted. */
export function sanitizePoints(raw: unknown): TrackingPointInput[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const out: TrackingPointInput[] = [];
  for (const p of raw.slice(0, MAX_POINTS_PER_REQUEST)) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Record<string, unknown>;
    const kind = r.kind as TrackingKind;
    if (!TRACKING_KINDS.includes(kind)) continue;
    const t = Date.parse(String(r.recorded_at || ''));
    // Accept points from the last 7 days (offline queue) up to 10 min in the future (phone clock drift)
    if (!Number.isFinite(t) || t < now - 7 * 86400000 || t > now + 10 * 60000) continue;
    const lat = num(r.lat, -90, 90);
    const lng = num(r.lng, -180, 180);
    if (kind === 'ping' && (lat === null || lng === null)) continue;
    out.push({
      kind,
      lat,
      lng,
      accuracy: num(r.accuracy, 0, 100000),
      battery: num(r.battery, 0, 100),
      ref_id: text(r.ref_id, 120),
      ref_label: text(r.ref_label, 200),
      recorded_at: new Date(t).toISOString()
    });
  }
  return out;
}

export async function insertTrackingPoints(businessId: string, userId: string, points: TrackingPointInput[]): Promise<number> {
  if (points.length === 0) return 0;
  const values: unknown[] = [];
  const rows: string[] = [];
  points.forEach((p, i) => {
    const b = i * 10;
    rows.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`);
    values.push(
      businessId, userId, p.kind, p.lat ?? null, p.lng ?? null,
      p.accuracy ?? null, p.battery === null || p.battery === undefined ? null : Math.round(p.battery),
      p.ref_id ?? null, p.ref_label ?? null, p.recorded_at
    );
  });
  await executeRawQuery(
    `INSERT INTO salesman_locations
       (business_id, user_id, kind, lat, lng, accuracy_m, battery_pct, ref_id, ref_label, recorded_at)
     VALUES ${rows.join(',')}`,
    values
  );

  // Housekeeping: now and then remove old points (keeps the table small)
  if (Math.random() < 0.02) {
    executeRawQuery(
      `DELETE FROM salesman_locations WHERE business_id = $1 AND recorded_at < now() - ($2 || ' days')::interval`,
      [businessId, String(RETENTION_DAYS)]
    ).catch(() => undefined);
  }
  return points.length;
}

/** India day (IST) as UTC range. date = 'YYYY-MM-DD'. */
export function istDayRange(date: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = Date.parse(`${date}T00:00:00+05:30`);
  if (!Number.isFinite(start)) return null;
  return { from: new Date(start).toISOString(), to: new Date(start + 86400000).toISOString() };
}

export interface SalesmanSummary {
  user_id: string;
  name: string;
  mobile: string;
  role: string;
  consent: boolean;
  on_duty: boolean;
  duty_started_at: string | null;
  last: TrackingPoint | null;
  today_orders: number;
}

/** All salesmen of the business with their latest point and duty state. */
export async function getSalesmenSummary(businessId: string, todayRange: { from: string; to: string }): Promise<SalesmanSummary[]> {
  const people = await executeRawQuery<{ id: string; name: string; mobile: string; role: string }>(
    `SELECT id, coalesce(nullif(name,''), full_name, id) AS name, coalesce(mobile,'') AS mobile, role
       FROM profiles
      WHERE business_id = $1 AND role IN ('sales_dist','sales_co')
        AND coalesce(active, TRUE) AND coalesce(status, 'ACTIVE') <> 'INACTIVE'
      ORDER BY name`,
    [businessId]
  );

  const last = await executeRawQuery<TrackingPoint>(
    `SELECT DISTINCT ON (user_id) user_id, kind, lat, lng, accuracy_m, battery_pct, ref_id, ref_label,
            to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS recorded_at
       FROM salesman_locations
      WHERE business_id = $1 AND lat IS NOT NULL
      ORDER BY user_id, recorded_at DESC`,
    [businessId]
  );

  const duty = await executeRawQuery<{ user_id: string; kind: string; recorded_at: string }>(
    `SELECT DISTINCT ON (user_id) user_id, kind,
            to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS recorded_at
       FROM salesman_locations
      WHERE business_id = $1 AND kind IN ('duty_start','duty_end')
      ORDER BY user_id, recorded_at DESC`,
    [businessId]
  );

  const consent = await executeRawQuery<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM salesman_locations WHERE business_id = $1 AND kind = 'consent'`,
    [businessId]
  );

  const orders = await executeRawQuery<{ user_id: string; n: string }>(
    `SELECT user_id, count(*)::text AS n FROM salesman_locations
      WHERE business_id = $1 AND kind = 'order' AND recorded_at >= $2 AND recorded_at < $3
      GROUP BY user_id`,
    [businessId, todayRange.from, todayRange.to]
  );

  type DutyRow = { user_id: string; kind: string; recorded_at: string };
  const lastBy = new Map<string, TrackingPoint>(last.rows.map((r: TrackingPoint) => [r.user_id, r] as [string, TrackingPoint]));
  const dutyBy = new Map<string, DutyRow>(duty.rows.map((r: DutyRow) => [r.user_id, r] as [string, DutyRow]));
  const consentSet = new Set<string>(consent.rows.map((r: { user_id: string }) => r.user_id));
  const ordersBy = new Map<string, number>(orders.rows.map((r: { user_id: string; n: string }) => [r.user_id, Number(r.n) || 0] as [string, number]));

  return people.rows.map((p: { id: string; name: string; mobile: string; role: string }) => {
    const d = dutyBy.get(p.id);
    // Duty that was never ended counts as off after 14 hours (phone closed / forgot to end)
    const onDuty = !!d && d.kind === 'duty_start' && Date.now() - Date.parse(d.recorded_at) < 14 * 3600000;
    return {
      user_id: p.id,
      name: p.name,
      mobile: p.mobile,
      role: p.role,
      consent: consentSet.has(p.id),
      on_duty: onDuty,
      duty_started_at: onDuty ? d!.recorded_at : null,
      last: lastBy.get(p.id) || null,
      today_orders: ordersBy.get(p.id) || 0
    };
  });
}

/** All points of one salesman for one IST day, oldest first. */
export async function getSalesmanDay(businessId: string, userId: string, range: { from: string; to: string }): Promise<TrackingPoint[]> {
  const res = await executeRawQuery<TrackingPoint>(
    `SELECT user_id, kind, lat, lng, accuracy_m, battery_pct, ref_id, ref_label,
            to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS recorded_at
       FROM salesman_locations
      WHERE business_id = $1 AND user_id = $2 AND recorded_at >= $3 AND recorded_at < $4
      ORDER BY recorded_at ASC
      LIMIT 5000`,
    [businessId, userId, range.from, range.to]
  );
  return res.rows;
}
