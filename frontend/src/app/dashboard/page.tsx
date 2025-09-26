"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listTables,
  listMembers,
  createReservation,       // ✅ keep only this import (no second line)
  listReservationsByDate,
  updateReservation,       // used for assign-on-click
  updateReservationStatus,
  updateTableLayoutBulk,
  type ReservationWithRelations,
  type Table,
  type Member,
  type Reservation,
} from "@/lib/api";


/** -----------------------------------------------------------------------
 * Helpers that treat times as local “wall-clock” strings (YYYY-MM-DDTHH:MM)
 * ----------------------------------------------------------------------*/

/** Remove trailing 'Z' (UTC marker) and trim to minute precision. */
function toLocalMinute(s: string) {
  if (!s) return s;
  let v = s.trim();
  if (v.endsWith("Z")) v = v.slice(0, -1);
  // keep only "YYYY-MM-DDTHH:MM"
  if (v.length >= 16) v = v.slice(0, 16);
  return v;
}

/** DEPRECATED: Avoid converting to UTC. Keep for compatibility. */
function toISO(localDateTime: string) {
  // Do NOT convert with toISOString(); return the local minute string instead.
  return toLocalMinute(localDateTime);
}

/** Minute-precision epoch in LOCAL time (safe for sorting/comparing). */
function mmEpoch(isoOrLocal: string) {
  const v = toLocalMinute(isoOrLocal);
  const [date, time] = v.split("T");
  if (!date || !time) return 0;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Construct a Date in local tz (not UTC) to preserve wall-clock meaning.
  return Math.floor(new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime() / 60000);
}

/** Format HH:MM from an ISO/local string without timezone shifting. */
function fmtHM(iso: string) {
  const v = toLocalMinute(iso);
  return v.slice(11, 16); // "HH:MM"
}

/** Compare two timestamps by minute in LOCAL wall time. */
function sameMinuteLocal(iso: string, local: string) {
  return toLocalMinute(iso) === toLocalMinute(local);
}

/** Alias kept for callers that expect a “local” formatter. */
function fmtHMLocal(iso: string) {
  return fmtHM(iso);
}

// alias for legacy calls
const hhmm = fmtHM;

// When using /by-date we get relations; widen the type for render only
type ReservationWithRelations = Reservation & {
  member?: { id: number; name?: string | null; email?: string | null; phone?: string | null } | null;
  table?: { id: number; number: number; capacity?: number | null } | null;
};

const STATUS_OPTS = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
type Mode = "existing" | "new";
type ViewMode = "tables" | "list";

export default function CommandCenterPage() {
  // ====== Time / data ======
  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);
  const defaultTime = "19:00";
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const selectedDateTimeLocal = `${date}T${time}`;
  const selectedDateTimeISO = toISO(selectedDateTimeLocal);

  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ====== Create form ======
  const [mode, setMode] = useState<Mode>("existing");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberOptions, setMemberOptions] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [formTableId, setFormTableId] = useState<number | "">("");
  const [partySize, setPartySize] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  // ====== Selection for assign via grid ======
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);

  // ====== Layout + view toggle ======
  const [layoutMode, setLayoutMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tables");
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [draftLayout, setDraftLayout] = useState<Record<number, { x: number; y: number }>>({});

  // ====== Load tables ======
  useEffect(() => {
    listTables()
      .then((t) => {
        setTables(t);
        const seed: Record<number, { x: number; y: number }> = {};
        t.forEach((tb) => {
          if (tb.posX != null && tb.posY != null) seed[tb.id] = { x: tb.posX, y: tb.posY };
        });
        setDraftLayout(seed);
      })
      .catch((e) => setErr(`Failed to load tables: ${e.message}`));
  }, []);

  // ====== Load reservations for day ======
  async function refreshDay() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const list = await listReservationsByDate(date);
      setReservations(list);
    } catch (e: any) {
      setErr(e.message || "Failed to load reservations.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refreshDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ====== Member search ======
  useEffect(() => {
    if (mode !== "existing") return;
    const q = memberQuery.trim();
    if (!q) {
      setMemberOptions([]);
      setSelectedMemberId(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await listMembers({ q, limit: 8 });
        setMemberOptions(res);
      } catch (e: any) {
        setErr(e.message || "Member search failed.");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [mode, memberQuery]);

  // ====== At-selected-minute occupancy & lookup ======
  const occupantByTable = useMemo(() => {
    const map = new Map<number, ReservationWithRelations>();
    (reservations as ReservationWithRelations[]).forEach((r) => {
      if (sameMinuteLocal(r.date, selectedDateTimeLocal)) {
        map.set(r.tableId, r);
      }
    });
    return map;
  }, [reservations, selectedDateTimeLocal]);

  // ====== Create reservation handler ======
  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
  
    // Normalize wall-clock local time: "YYYY-MM-DDTHH:MM"
    let resTime = (selectedDateTimeLocal || "").trim();
    if (!resTime) {
      setErr("Please pick a date & time.");
      return;
    }
    // If something upstream added a trailing Z, strip it (we compare/render in wall time)
    if (resTime.endsWith("Z")) resTime = resTime.slice(0, -1);
    // Keep only to the minute (drop seconds if present)
    if (resTime.length >= 16) resTime = resTime.slice(0, 16);
  
    if (!formTableId) {
      setErr("Please select a table.");
      return;
    }
  
    const payload: any = {
      table_id: Number(formTableId),
      reservation_time: resTime, // <-- IMPORTANT: local string, not toISOString()
      status: "CONFIRMED",
    };
  
    if (partySize) {
      const n = Number(partySize);
      if (!Number.isFinite(n) || n <= 0) {
        setErr("Party size must be a positive number.");
        return;
      }
      payload.party_size = n;
    }
    if (notes?.trim()) payload.notes = notes.trim();
  
    try {
      if (mode === "existing") {
        if (!selectedMemberId) {
          setErr("Please select a member from the list.");
          return;
        }
        payload.member_id = selectedMemberId;
      } else {
        const nameOk = newName?.trim();
        const emailOk = newEmail?.trim();
        const phoneOk = newPhone?.trim();
        if (!nameOk || !emailOk || !phoneOk) {
          setErr("Name, email, and phone are required for a new member.");
          return;
        }
        payload.name = nameOk;
        payload.email = emailOk;
        payload.phone = phoneOk;
      }
  
      const created = await createReservation(payload);
      setMsg(`Created reservation #${created.id}`);
  
      // Reset form bits
      setNotes("");
      setPartySize("");
      setFormTableId("");
  
      if (mode === "existing") {
        setMemberQuery("");
        setMemberOptions([]);
        setSelectedMemberId(null);
      } else {
        setNewName("");
        setNewEmail("");
        setNewPhone("");
      }
  
      // Refresh day data and show it on the grid
      await refreshDay();
      setSelectedReservationId(created.id);
      setViewMode("tables");
    } catch (err: any) {
      setErr(err?.message || "Create reservation failed.");
    }
  }

  // ====== Layout dragging ======
  function onMouseDown(e: React.MouseEvent, id: number) {
    if (!layoutMode) return;
    const board = boardRef.current;
    if (!board) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = board.getBoundingClientRect();

    const curr = draftLayout[id] ?? { x: 20, y: 20 };
    const origX = curr.x;
    const origY = curr.y;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const nx = Math.max(0, Math.min(origX + dx, rect.width - 60));
      const ny = Math.max(0, Math.min(origY + dy, rect.height - 60));
      setDraftLayout((d) => ({ ...d, [id]: { x: nx, y: ny } }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  async function saveLayout() {
    const payload = tables.map((t) => {
      const pos = draftLayout[t.id];
      return {
        id: t.id,
        posX: pos?.x ?? t.posX ?? null,
        posY: pos?.y ?? t.posY ?? null,
      };
    });
    try {
      await updateTableLayoutBulk(payload);
      setMsg("Layout saved.");
    } catch (e: any) {
      setErr(e.message || "Failed to save layout.");
    }
  }

  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Left: Create form */}
      <div className="xl:col-span-1 space-y-4">
        <div className="bg-white rounded-xl shadow p-5">
          <h1 className="text-xl font-semibold mb-4">New Reservation</h1>

          <div className="flex gap-2 mb-3">
            <button
              className={`px-3 py-1 rounded ${mode === "existing" ? "bg-black text-white" : "bg-gray-200"}`}
              onClick={() => setMode("existing")}
            >
              Existing Member
            </button>
            <button
              className={`px-3 py-1 rounded ${mode === "new" ? "bg-black text-white" : "bg-gray-200"}`}
              onClick={() => setMode("new")}
            >
              New Member
            </button>
          </div>

          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col">
                <span className="text-sm font-medium">Date & Time</span>
                <input
                  type="datetime-local"
                  value={selectedDateTimeLocal}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDate(v.slice(0, 10));
                    setTime(v.slice(11, 16));
                  }}
                  className="border rounded px-3 py-2"
                  required
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-medium">Table</span>
                <select
                  value={formTableId}
                  onChange={(e) => setFormTableId(e.target.value ? Number(e.target.value) : "")}
                  className="border rounded px-3 py-2"
                  required
                >
                  <option value="">Select a table</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number} {t.capacity ? `(Seats ${t.capacity})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {mode === "existing" ? (
              <div>
                <label className="text-sm font-medium">Find Member (name / email / phone)</label>
                <input
                  value={memberQuery}
                  onChange={(e) => {
                    setMemberQuery(e.target.value);
                    setSelectedMemberId(null);
                  }}
                  placeholder="e.g., Jane, +63"
                  className="border rounded px-3 py-2 w-full"
                />
                {memberOptions.length > 0 && (
                  <div className="border rounded mt-2 bg-white max-h-40 overflow-auto">
                    {memberOptions.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setMemberQuery(`${m.name} — ${m.email}`);
                          setMemberOptions([]);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                          selectedMemberId === m.id ? "bg-gray-100" : ""
                        }`}
                      >
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-gray-600">{m.email} · {m.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <label className="flex flex-col">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="border rounded px-3 py-2"
                    required
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium">Email</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="border rounded px-3 py-2"
                    required
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="border rounded px-3 py-2"
                    required
                  />
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col">
                <span className="text-sm font-medium">Party size</span>
                <input
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value ? Number(e.target.value) : "")}
                  className="border rounded px-3 py-2"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-medium">Notes</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border rounded px-3 py-2"
                  placeholder="Near window, allergy, etc."
                />
              </label>
            </div>

            <button type="submit" className="px-4 py-2 rounded bg-black text-white">
              Create Reservation
            </button>

            {msg && <div className="text-sm text-green-700">{msg}</div>}
            {err && <div className="text-sm text-red-600">{err}</div>}
          </form>
        </div>
      </div>

      {/* Right: Controls + view toggle + grid/list */}
      <div className="xl:col-span-2 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 bg-white p-4 rounded-xl shadow">
          <label className="flex flex-col">
            <span className="text-sm font-medium">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-sm font-medium">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="border rounded px-3 py-2"
              step={60}
            />
          </label>

          <button onClick={refreshDay} className="px-4 py-2 rounded bg-black text-white">
            Refresh
          </button>

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              className={`px-3 py-1 rounded ${viewMode === "tables" ? "bg-white shadow" : ""}`}
              onClick={() => setViewMode("tables")}
            >
              Tables
            </button>
            <button
              className={`px-3 py-1 rounded ${viewMode === "list" ? "bg-white shadow" : ""}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>

          <label className="flex items-center gap-2 ml-2">
            <input
              type="checkbox"
              checked={layoutMode}
              onChange={(e) => setLayoutMode(e.target.checked)}
              disabled={viewMode !== "tables"}
            />
            <span className={`text-sm ${viewMode !== "tables" ? "text-gray-400" : ""}`}>Layout mode</span>
          </label>

          {layoutMode && viewMode === "tables" && (
            <button onClick={saveLayout} className="px-3 py-2 rounded bg-blue-600 text-white">
              Save Layout
            </button>
          )}

          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>

        {/* TABLES VIEW */}
        {viewMode === "tables" && (
          <>
            {layoutMode ? (
              <div ref={boardRef} className="relative w-full h-[480px] bg-gray-50 border rounded-xl">
                {tables.map((t) => {
                  const pos = draftLayout[t.id] ?? { x: t.posX ?? 20, y: t.posY ?? 20 };
                  return (
                    <div
                      key={t.id}
                      onMouseDown={(e) => onMouseDown(e, t.id)}
                      className="absolute select-none cursor-move rounded-lg shadow border bg-white w-[72px] h-[72px] flex items-center justify-center"
                      style={{ left: pos.x, top: pos.y }}
                      title={`Table ${t.number}`}
                    >
                      <div className="text-sm font-semibold">{t.number}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tables.map((t) => {
                  const occ = occupantByTable.get(t.id) as ReservationWithRelations | undefined;
                  const occupied = Boolean(occ);
                  const assignable = !occupied && !!selectedReservationId;
              
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => assignable && handleAssign(t.id)}
                      aria-disabled={!assignable}
                      className={`rounded-xl border p-4 text-left shadow transition
                        ${occupied ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300 hover:shadow-md"}
                        ${assignable ? "ring-2 ring-black/10" : ""}
                        ${assignable ? "cursor-pointer" : "cursor-default"}`}
                      title={
                        occupied
                          ? `Occupied at ${hhmm(occ!.date)}`
                          : assignable
                          ? "Assign selected reservation here"
                          : "Available"
                      }
                    >
                      
                      <div className="text-sm text-gray-500">Table</div>
                      <div className="text-xl font-semibold">{t.number}</div>
                      <div className="text-sm text-gray-600">
                        {t.capacity ? `Seats ${t.capacity}` : "Capacity N/A"}
                      </div>

                      <div
                        className={`mt-2 inline-block px-2 py-0.5 rounded text-xs
                          ${occupied ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                      >
                        {occupied ? "Occupied" : "Available"}
                      </div>

                      {occupied && (
                        <div className="mt-2 text-xs text-gray-700 border-t pt-2">
                          <div className="font-medium">
                            Res #{occ!.id}
                            {occ?.member?.name ? ` • ${occ.member.name}` : ""}
                          </div>
                          <div>{hhmm(occ!.date)} • {occ!.status ?? "CONFIRMED"}</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Reservations on {date}</h2>
            <div className="bg-white rounded-xl shadow divide-y">
              {reservations.length === 0 && (
                <div className="p-4 text-gray-500">No reservations.</div>
              )}
              {reservations.map((r) => {
                const isSelected = selectedReservationId === r.id;
                return (
                  <div key={r.id} className={`p-3 ${isSelected ? "bg-gray-100" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => setSelectedReservationId(r.id)}
                        className="text-left"
                        title="Select to assign"
                      >
                        <div className="font-medium">Reservation #{r.id}</div>
                        <div className="text-sm text-gray-600">
                          {fmtHM(r.date)} · Table {r.tableId} · Status {r.status ?? "CONFIRMED"}
                        </div>
                      </button>

                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={r.status ?? "CONFIRMED"}
                        onChange={async (e) => {
                          try {
                            await updateReservationStatus(r.id, e.target.value);
                            setMsg(`Status updated for #${r.id}`);
                            await refreshDay();
                          } catch (er: any) {
                            setErr(er.message || "Failed to update status.");
                          }
                        }}
                      >
                        {STATUS_OPTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-sm text-gray-600">
              Tip: Select a reservation above, switch to <strong>Tables</strong>, then click a table
              to assign it at the selected time. Toggle <strong>Layout mode</strong> to drag & save
              positions.
            </div>
          </div>
        )}

        {msg && <div className="text-sm text-green-700">{msg}</div>}
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}
