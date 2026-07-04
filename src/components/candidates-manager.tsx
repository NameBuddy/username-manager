"use client";

import { Archive, Download, Edit3, Plus, RefreshCw, Save, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { sortOptions, type CandidateItem, type TaxonomyItem } from "@/lib/client-types";
import { downloadBlob, splitList } from "@/lib/client-utils";

type CandidateListResponse = {
  items: CandidateItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CandidateForm = {
  nameOriginal: string;
  categoryId: string;
  labels: string;
  autoCategorize: boolean;
};

const emptyForm: CandidateForm = {
  nameOriginal: "",
  categoryId: "",
  labels: "",
  autoCategorize: true,
};

const initialFilters = {
  search: "",
  categoryId: "",
  labelId: "",
  sort: "newest",
};

function labelsToText(candidate: CandidateItem) {
  return candidate.labels.map(({ label }) => label.name).join(", ");
}

function candidateToForm(candidate: CandidateItem): CandidateForm {
  return {
    nameOriginal: candidate.nameOriginal,
    categoryId: candidate.categoryId ?? "",
    labels: labelsToText(candidate),
    autoCategorize: true,
  };
}

const FILTER_DEBOUNCE_MS = 300;

export function CandidatesManager() {
  const [filters, setFilters] = useState(initialFilters);
  const [list, setList] = useState<CandidateListResponse>({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [labels, setLabels] = useState<TaxonomyItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<CandidateItem | null>(null);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [tableMessage, setTableMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedIds = useMemo(() => [...selected], [selected]);
  const loadRequestRef = useRef(0);

  async function loadTaxonomy() {
    const [categoryResponse, labelResponse] = await Promise.all([fetch("/api/categories"), fetch("/api/labels")]);
    setCategories(((await categoryResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
    setLabels(((await labelResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
  }

  async function loadCandidates(page = list.page) {
    const requestId = ++loadRequestRef.current;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(page));
    params.set("pageSize", String(list.pageSize));

    try {
      const response = await fetch(`/api/candidates?${params.toString()}`);
      if (!response.ok) throw new Error("Request failed");
      const body = (await response.json()) as CandidateListResponse;
      if (requestId !== loadRequestRef.current) return;
      if (body.total > 0 && body.items.length === 0 && body.page > body.totalPages) {
        await loadCandidates(body.totalPages);
        return;
      }
      setList(body);
      setTableMessage("");
    } catch {
      if (requestId === loadRequestRef.current) {
        setTableMessage("Could not load candidates. Try refreshing.");
      }
    }
  }

  useEffect(() => {
    void loadTaxonomy();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void loadCandidates(1), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [filters]);

  async function selectCandidate(candidate: CandidateItem) {
    const response = await fetch(`/api/candidates/${candidate.id}`);
    const body = (await response.json()) as { item: CandidateItem };
    setActive(body.item);
    setForm(candidateToForm(body.item));
    setMessage("");
  }

  function resetForm() {
    setActive(null);
    setForm(emptyForm);
    setMessage("");
  }

  function toggle(id: string) {
    setSelected((current) => {
      const copy = new Set(current);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const payload = {
      nameOriginal: form.nameOriginal,
      categoryId: form.categoryId || null,
      labels: splitList(form.labels),
      autoCategorize: form.autoCategorize,
    };
    const response = await fetch(active ? `/api/candidates/${active.id}` : "/api/candidates", {
      method: active ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as { item?: CandidateItem; error?: string } | null;
    if (!response.ok) {
      setMessage(body?.error ?? "Save failed");
    } else {
      setMessage(active ? "Candidate updated" : "Candidate added");
      setActive(body?.item ?? null);
      if (!active) setForm(emptyForm);
      await Promise.all([loadCandidates(), loadTaxonomy()]);
    }
    setBusy(false);
  }

  async function archiveActive() {
    if (!active) return;
    if (!window.confirm(`Archive "${active.nameOriginal}"?`)) return;
    const response = await fetch(`/api/candidates/${active.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Archive failed");
      return;
    }
    resetForm();
    await loadCandidates();
  }

  async function bulkArchive() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Archive ${selectedIds.length} selected candidate${selectedIds.length === 1 ? "" : "s"}?`)) return;
    const response = await fetch("/api/candidates/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    if (!response.ok) {
      setTableMessage("Bulk archive failed");
      return;
    }
    setSelected(new Set());
    await loadCandidates();
  }

  async function exportSelected(format: "txt" | "csv" | "json") {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, ids: selectedIds }),
    });
    if (!response.ok) {
      setTableMessage("Export failed");
      return;
    }
    downloadBlob(await response.blob(), `selected-candidates.${format}`);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-zinc-600">{list.total.toLocaleString()} candidates match the current filters.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => void loadCandidates()}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <section className="panel rounded-lg p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_220px_220px_auto]">
          <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 text-zinc-400" size={16} />
              <input
                className="field pl-8"
                placeholder="Search names or notes"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              />
            </div>
          </label>
          <FilterSelect label="Category" value={filters.categoryId} items={categories} onChange={(value) => setFilters({ ...filters, categoryId: value })} />
          <FilterSelect label="Label" value={filters.labelId} items={labels} onChange={(value) => setFilters({ ...filters, labelId: value })} />
          <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
            Sort
            <select className="field" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
              {sortOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary self-end" type="button" onClick={() => setFilters(initialFilters)}>
            Clear
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel overflow-hidden rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-3">
            <div className="text-sm font-medium">{selectedIds.length} selected</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary" type="button" disabled={!selectedIds.length} onClick={() => void exportSelected("txt")}>
                <Download size={15} />
                TXT
              </button>
              <button className="btn btn-secondary" type="button" disabled={!selectedIds.length} onClick={() => void exportSelected("csv")}>
                CSV
              </button>
              <button className="btn btn-secondary" type="button" disabled={!selectedIds.length} onClick={() => void exportSelected("json")}>
                JSON
              </button>
              <button className="btn btn-danger" type="button" disabled={!selectedIds.length} onClick={() => void bulkArchive()}>
                <Archive size={15} />
                Archive
              </button>
            </div>
          </div>
          {tableMessage ? (
            <p className="border-b border-zinc-200 bg-red-50 px-3 py-2 text-sm text-red-700">{tableMessage}</p>
          ) : null}
          <div className="scrollbar-thin overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      checked={list.items.length > 0 && list.items.every((candidate) => selected.has(candidate.id))}
                      onChange={(event) => setSelected(event.target.checked ? new Set(list.items.map((candidate) => candidate.id)) : new Set())}
                    />
                  </th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Labels</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!list.items.length ? (
                  <tr className="border-t border-zinc-100">
                    <td className="p-6 text-center text-sm text-zinc-500" colSpan={6}>
                      No candidates match the current filters.
                    </td>
                  </tr>
                ) : null}
                {list.items.map((candidate) => (
                  <tr key={candidate.id} className="border-t border-zinc-100 hover:bg-white">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(candidate.id)} onChange={() => toggle(candidate.id)} />
                    </td>
                    <td className="p-3">
                      <button className="font-semibold text-zinc-950" type="button" onClick={() => void selectCandidate(candidate)}>
                        {candidate.nameOriginal}
                      </button>
                      <div className="text-xs text-zinc-500">{candidate.nameNormalized}</div>
                    </td>
                    <td className="p-3">{candidate.category?.name ?? "-"}</td>
                    <td className="p-3">
                      <ChipList values={candidate.labels.map(({ label }) => label.name)} />
                    </td>
                    <td className="p-3">{new Date(candidate.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <button className="btn btn-secondary" type="button" onClick={() => void selectCandidate(candidate)} title="Edit candidate">
                        <Edit3 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 p-3 text-sm">
            <button className="btn btn-secondary" disabled={list.page <= 1} onClick={() => void loadCandidates(list.page - 1)} type="button">
              Previous
            </button>
            <span>
              Page {list.page} of {Math.max(1, list.totalPages)}
            </span>
            <button className="btn btn-secondary" disabled={list.page >= list.totalPages} onClick={() => void loadCandidates(list.page + 1)} type="button">
              Next
            </button>
          </div>
        </div>

        <aside className="panel rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{active ? "Edit Candidate" : "Add Candidate"}</h2>
            <button className="btn btn-secondary" type="button" onClick={resetForm}>
              <Plus size={15} />
              New
            </button>
          </div>
          <form className="grid gap-3" onSubmit={submitCandidate}>
            <label className="grid gap-1 text-sm font-medium">
              Name
              <input className="field" value={form.nameOriginal} onChange={(event) => setForm({ ...form, nameOriginal: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Category
              <select className="field" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                <option value="">Auto category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Labels
              <input className="field" value={form.labels} onChange={(event) => setForm({ ...form, labels: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.autoCategorize}
                onChange={(event) => setForm({ ...form, autoCategorize: event.target.checked })}
              />
              DeepSeek category fill
            </label>
            {message ? <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{message}</p> : null}
            <div className="flex gap-2">
              <button className="btn flex-1" disabled={busy || !form.nameOriginal.trim() || (!form.categoryId && !form.autoCategorize)} type="submit">
                <Save size={16} />
                Save
              </button>
              {active ? (
                <button className="btn btn-danger" type="button" onClick={() => void archiveActive()}>
                  <Archive size={16} />
                </button>
              ) : null}
            </div>
          </form>

          {active ? (
            <div className="mt-5 grid gap-4 border-t border-zinc-200 pt-4 text-sm">
              <ReadOnly label="Normalized" value={active.nameNormalized} />
              <ReadOnly label="Created" value={new Date(active.createdAt).toLocaleString()} />
              <ReadOnly label="Updated" value={new Date(active.updatedAt).toLocaleString()} />
              {active.events?.length ? (
                <div>
                  <h3 className="mb-2 font-semibold">Recent History</h3>
                  <div className="grid max-h-36 gap-2 overflow-auto text-xs text-zinc-600">
                    {active.events.slice(0, 5).map((event) => (
                      <div key={event.id} className="border-b border-zinc-100 pb-2">
                        <div className="font-medium text-zinc-800">{event.eventType}</div>
                        <div>{new Date(event.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function FilterSelect({ label, value, items, onChange }: { label: string; value: string; items: { id: string; name: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
      {label}
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipList({ values }: { values: string[] }) {
  if (!values.length) return <span className="text-zinc-400">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.slice(0, 4).map((value) => (
        <span key={value} className="chip">
          {value}
        </span>
      ))}
      {values.length > 4 ? <span className="chip">+{values.length - 4}</span> : null}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-zinc-800">{value}</div>
    </div>
  );
}
