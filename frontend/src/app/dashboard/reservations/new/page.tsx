"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listTables,
  listMembers,
  createReservation,
  type Member,
  type Table,
} from "@/lib/api";

type Mode = "existing" | "new";

export default function NewReservationPage() {
  const [mode, setMode] = useState<Mode>("existing");

  // Shared fields
  const [dateTimeLocal, setDateTimeLocal] = useState<string>(""); // "YYYY-MM-DDTHH:MM"
  const [tableId, setTableId] = useState<number | "">("");

  // Existing member path
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // New member path
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Data
  const [tables, setTables] = useState<Table[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // load tables once
  useEffect(() => {
    listTables()
      .then(setTables)
      .catch((e) => setError(`Failed to load tables: ${e.message}`));
  }, []);

  // debounced member search
  useEffect(() => {
    if (mode !== "existing") return;
    setSelectedMember(null);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    const t = setTimeout(() => {
      listMembers({ q: query, limit: 10 })
        .then(setSuggestions)
        .catch((e) => setError(`Search failed: ${e.message}`))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, mode]);

  const canSubmit = useMemo(() => {
    if (!dateTimeLocal || !tableId) return false;
    if (mode === "existing") return Boolean(selectedMember?.id);
    return Boolean(name.trim() && email.trim() && phone.trim());
  }, [dateTimeLocal, tableId, mode, selectedMember, name, email, phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const reservation_time = dateTimeLocal;
      if (mode === "existing" && selectedMember) {
        const res = await createReservation({
          table_id: Number(tableId),
          member_id: selectedMember.id,
          reservation_time,
        });
        setMessage(`Reservation #${res.id} created for member ${selectedMember.name}`);
      } else {
        const res = await createReservation({
          table_id: Number(tableId),
          reservation_time,
          name,
          email,
          phone,
        });
        setMessage(`Reservation #${res.id} created for ${name}`);
      }
      // reset minimal
      setSelectedMember(null);
      setQuery("");
    } catch (e: any) {
      setError(e.message || "Failed to create reservation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">New Reservation</h1>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`px-3 py-1 rounded border ${mode === "existing" ? "bg-black text-white" : "bg-white"}`}
        >
          Existing Member
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`px-3 py-1 rounded border ${mode === "new" ? "bg-black text-white" : "bg-white"}`}
        >
          New Member
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow p-4">
        {/* datetime & table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Date & Time</span>
            <input
              type="datetime-local"
              value={dateTimeLocal}
              onChange={(e) => setDateTimeLocal(e.target.value)}
              className="border rounded px-3 py-2"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Table</span>
            <select
              className="border rounded px-3 py-2"
              value={tableId}
              onChange={(e) => setTableId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Select a table</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} {t.capacity ? `(cap ${t.capacity})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Find Member (name/email/phone)</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. jane, +63"
                className="border rounded px-3 py-2"
              />
            </label>

            {isSearching && <div className="text-sm text-gray-500">Searching…</div>}

            {!!suggestions.length && (
              <div className="border rounded">
                {suggestions.map((m) => {
                  const active = selectedMember?.id === m.id;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${active ? "bg-gray-100" : ""}`}
                    >
                      <div className="font-medium">{m.name}</div>
                      <div className="text-sm text-gray-600">
                        {m.email} · {m.phone}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedMember && (
              <div className="text-sm text-green-700">
                Selected: <span className="font-medium">{selectedMember.name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create Reservation"}
          </button>
          {message && <span className="text-green-700">{message}</span>}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
