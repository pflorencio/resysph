// frontend/src/lib/api.ts

/** ──────────────────────────────────────────────────────────────────────────
 *  Types
 *  ──────────────────────────────────────────────────────────────────────── */
export type Member = {
  id: number;
  name: string;
  email: string;
  phone: string;
};

export type Table = {
  id: number;
  number: number;
  floorId: number | null;
  capacity: number | null;
  posX?: number | null;
  posY?: number | null;
  width?: number | null;
  height?: number | null;
  rotation?: number | null;
  label?: string | null;
  area?: string | null;
};

export type Reservation = {
  id: number;
  /** ISO string from API. Treat as *wall time*; do not convert with Date(). */
  date: string;
  tableId: number;
  memberId: number;
  status?: string;
  partySize?: number | null;
  notes?: string | null;
};

/** When /reservations/by-date includes relations */
export type ReservationWithRelations = Reservation & {
  member?: Member | null;
  table?: Pick<Table, "id" | "number" | "capacity"> | null;
};

/** ──────────────────────────────────────────────────────────────────────────
 *  Low-level fetch helper
 *  ──────────────────────────────────────────────────────────────────────── */
const BASE =
  process.env.NEXT_PUBLIC_API_URL /* e.g. http://127.0.0.1:8000/api */ ??
  "http://127.0.0.1:8000/api";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

/** ──────────────────────────────────────────────────────────────────────────
 *  Members
 *  ──────────────────────────────────────────────────────────────────────── */
export async function listMembers(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const p = new URLSearchParams();
  if (params?.q) p.set("q", params.q);
  if (params?.limit) p.set("limit", String(params.limit));
  if (params?.offset) p.set("offset", String(params.offset));
  const qs = p.toString();
  return api<Member[]>(`/members${qs ? `?${qs}` : ""}`);
}

export async function createMember(payload: {
  name: string;
  email: string;
  phone: string;
}) {
  return api<Member>("/members", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** ──────────────────────────────────────────────────────────────────────────
 *  Tables
 *  ──────────────────────────────────────────────────────────────────────── */
export async function listTables() {
  return api<Table[]>("/tables");
}

export async function getTablesLayout() {
  return api<Table[]>("/tables/layout");
}

export async function updateTableLayout(id: number, body: Partial<Table>) {
  return api<Table>(`/tables/${id}/layout`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updateTableLayoutBulk(
  items: Array<{ id: number } & Partial<Table>>
) {
  return api<Table[]>(`/tables/layout/bulk`, {
    method: "PATCH",
    body: JSON.stringify(items),
  });
}

/** ──────────────────────────────────────────────────────────────────────────
 *  Reservations
 *  NOTE: reservation_time should be a LOCAL wall-clock string "YYYY-MM-DDTHH:MM"
 *        Do NOT convert with new Date(...).toISOString() — that would shift time.
 *  ──────────────────────────────────────────────────────────────────────── */
type CreateExistingMember = {
  table_id: number;
  member_id: number;
  reservation_time: string; // "YYYY-MM-DDTHH:MM"
  status?: string;
  party_size?: number;
  notes?: string;
};

type CreateNewMember = {
  table_id: number;
  reservation_time: string; // "YYYY-MM-DDTHH:MM"
  name: string;
  email: string;
  phone: string;
  status?: string;
  party_size?: number;
  notes?: string;
};

export async function createReservation(
  body: CreateExistingMember | CreateNewMember
) {
  // We intentionally pass reservation_time through as provided (local string).
  return api<Reservation>("/reservations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Returns reservations for a calendar day, including member & table. */
export async function listReservationsByDate(dateISODate: string) {
  const p = new URLSearchParams({ date: dateISODate }); // e.g. "2025-09-26"
  return api<ReservationWithRelations[]>(
    `/reservations/by-date?${p.toString()}`
  );
}

export async function updateReservation(
  id: number,
  body: {
    table_id?: number;
    reservation_time?: string; // "YYYY-MM-DDTHH:MM" (local)
    status?: string;
    party_size?: number;
    notes?: string;
  }
) {
  return api<Reservation>(`/reservations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updateReservationStatus(id: number, status: string) {
  return api<Reservation>(`/reservations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getDailyStats(date: string) {
  const p = new URLSearchParams({ date });
  return api<{ date: string; total: number; by_status: Record<string, number> }>(
    `/reservations/stats?${p.toString()}`
  );
}
