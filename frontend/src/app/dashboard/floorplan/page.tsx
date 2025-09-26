"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listTables,
  listReservationsByDate,
  updateReservation,
  updateReservationStatus,
  updateTableLayoutBulk,
  type Table,
  type Reservation,
} from "@/lib/api";

function toISO(localDateTime: string) {
  try {
    return new Date(localDateTime).toISOString();
  } catch {
    return localDateTime;
  }
}

const STATUS_OPTS = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default function FloorplanPage() {
  // Date/time controls
  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);
  const defaultTime = "19:00";

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);

  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Layout mode
  const [layoutMode, setLayoutMode] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [draftLayout, setDraftLayout] = useState<Record<number, { x: number; y: number }>>({});

  const selectedDateTimeLocal = `${date}T${time}`;
  const selectedDateTimeISO = toISO(selectedDateTimeLocal);

  // initial data
  useEffect(() => {
    listTables()
      .then((t) => {
        setTables(t);
        // seed draft positions from DB if present
        const seed: Record<number, { x: number; y: number }> = {};
        t.forEach((tb) => {
          if (tb.posX != null && tb.posY != null) seed[tb.id] = { x: tb.posX, y: tb.posY };
        });
        setDraftLayout(seed);
      })
      .catch((e) => setErr(`Failed to load tables: ${e.message}`));
  }, []);

  async function refresh() {
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
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // occupancy at selected time
  const occupiedAtTime = useMemo(() => {
    const set = new Set<number>();
    const target = new Date(selectedDateTimeISO).getTime();
    reservations.forEach((r) => {
      const t = new Date(r.date).getTime();
      if (t === target) set.add(r.tableId);
    });
    return set;
  }, [reservations, selectedDateTimeISO]);

  async function handleAssign(tableId: number) {
    if (!selectedReservationId) {
      setErr("Select a reservation from the list first.");
      return;
    }
    setErr(null);
    setMsg(null);
    try {
      await updateReservation(selectedReservationId, {
        table_id: tableId,
        reservation_time: selectedDateTimeLocal,
      });
      setMsg(`Reservation #${selectedReservationId} → Table ${tableId} @ ${selectedDateTimeLocal}`);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "Failed to assign reservation.");
    }
  }

  // ---- Layout dragging ----
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
      // constrain inside board
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
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
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

          <button onClick={refresh} className="px-4 py-2 rounded bg-black text-white">
            Refresh
          </button>

          <label className="flex items-center gap-2 ml-2">
            <input
              type="checkbox"
              checked={layoutMode}
              onChange={(e) => setLayoutMode(e.target.checked)}
            />
            <span className="text-sm">Layout mode</span>
          </label>

          {layoutMode && (
            <button onClick={saveLayout} className="px-3 py-2 rounded bg-blue-600 text-white">
              Save Layout
            </button>
          )}

          {loading && <span className="text-sm text-gray-500">Loading…</span>}
          {msg && <span className="text-sm text-green-700">{msg}</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>

        {/* Board or Grid */}
        {layoutMode ? (
          <div
            ref={boardRef}
            className="relative w-full h-[520px] bg-gray-50 border rounded-xl"
          >
            {tables.map((t) => {
              const pos = draftLayout[t.id] ?? { x: t.posX ?? 20, y: t.posY ?? 20 };
              return (
                <div
                  key={t.id}
                  onMouseDown={(e) => onMouseDown(e, t.id)}
                  className="absolute select-none cursor-move rounded-lg shadow border bg-white w-[60px] h-[60px] flex items-center justify-center"
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
              const occupied = occupiedAtTime.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => handleAssign(t.id)}
                  className={`rounded-xl border p-4 text-left shadow hover:shadow-md transition
                    ${occupied ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300"}`}
                  title={occupied ? "Occupied at selected time" : "Available"}
                >
                  <div className="text-sm text-gray-500">Table</div>
                  <div className="text-xl font-semibold">{t.number}</div>
                  <div className="text-sm text-gray-600">
                    {t.capacity ? `Seats ${t.capacity}` : "Capacity N/A"}
                  </div>
                  <div className={`mt-2 inline-block px-2 py-0.5 rounded text-xs
                    ${occupied ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {occupied ? "Occupied" : "Available"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Reservations list with status control */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Reservations on {date}</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          {reservations.length === 0 && (
            <div className="p-4 text-gray-500">No reservations today.</div>
          )}
          {reservations.map((r) => {
            const isSelected = selectedReservationId === r.id;
            const at = new Date(r.date);
            const hh = String(at.getHours()).padStart(2, "0");
            const mm = String(at.getMinutes()).padStart(2, "0");
            return (
              <div
                key={r.id}
                className={`p-3 ${isSelected ? "bg-gray-100" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedReservationId(r.id)}
                    className="text-left"
                    title="Select to assign"
                  >
                    <div className="font-medium">Reservation #{r.id}</div>
                    <div className="text-sm text-gray-600">
                      {hh}:{mm} · Table {r.tableId} · Status {r.status ?? "CONFIRMED"}
                    </div>
                  </button>

                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={r.status ?? "CONFIRMED"}
                    onChange={async (e) => {
                      try {
                        await updateReservationStatus(r.id, e.target.value);
                        setMsg(`Status updated for #${r.id}`);
                        await refresh();
                      } catch (er: any) {
                        setErr(er.message || "Failed to update status.");
                      }
                    }}
                  >
                    {STATUS_OPTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-sm text-gray-600">
          Tip: Select a reservation, then click a table to assign it at the selected time.
          Toggle <strong>Layout mode</strong> to drag/save table positions.
        </div>
      </div>
    </div>
  );
}
