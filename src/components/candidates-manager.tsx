"use client";

import { Archive, Download, Edit3, Plus, RefreshCw, Save, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  availabilityStatuses,
  candidateStatuses,
  type CandidateItem,
  type SourceItem,
  snipingStatuses,
  sortOptions,
  type TaxonomyItem,
} from "@/lib/client-types";

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
  tagIds: string[];
  labelIds: string[];
  sourceId: string;
  score: string;
  scoreReason: string;
  candidateStatus: string;
  availabilityStatus: string;
  snipingStatus: string;
  notes: string;
};

const emptyForm: CandidateForm = {
  nameOriginal: "",
  categoryId: "",
  tagIds: [],
  labelIds: [],
  sourceId: "",
  score: "",
  scoreReason: "",
  candidateStatus: "active",
  availabilityStatus: "unknown",
  snipingStatus: "none",
  notes: "",
};

const initialFilters = {
  search: "",
  categoryId: "",
  tagId: "",
  labelId: "",
  candidateStatus: "",
  availabilityStatus: "",
  sourceId: "",
  lengthMin: "",
  lengthMax: "",
  scoreMin: "",
  scoreMax: "",
  createdFrom: "",
  createdTo: "",
  lastCheckedFrom: "",
  lastCheckedTo: "",
  duplicateStatus: "",
  sort: "newest",
};

function candidateToForm(candidate: CandidateItem): CandidateForm {
  return {
    nameOriginal: candidate.nameOriginal,
    categoryId: candidate.categoryId ?? "",
    tagIds: candidate.tags.map(({ tag }) => tag.id),
    labelIds: candidate.labels.map(({ label }) => label.id),
    sourceId: candidate.sourceId ?? "",
    score: candidate.score == null ? "" : String(candidate.score),
    scoreReason: candidate.scoreReason ?? "",
    candidateStatus: candidate.candidateStatus,
    availabilityStatus: candidate.availabilityStatus,
    snipingStatus: candidate.snipingStatus,
    notes: candidate.notes ?? "",
  };
}

function multiValues(select: HTMLSelectElement) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CandidatesManager() {
  const [filters, setFilters] = useState(initialFilters);
  const [list, setList] = useState<CandidateListResponse>({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [tags, setTags] = useState<TaxonomyItem[]>([]);
  const [labels, setLabels] = useState<TaxonomyItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<CandidateItem | null>(null);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedIds = useMemo(() => [...selected], [selected]);

  async function loadTaxonomy() {
    const [categoryResponse, tagResponse, labelResponse, sourceResponse] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/tags"),
      fetch("/api/labels"),
      fetch("/api/sources"),
    ]);
    setCategories(((await categoryResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
    setTags(((await tagResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
    setLabels(((await labelResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
    setSources(((await sourceResponse.json()) as { items: SourceItem[] }).items ?? []);
  }

  async function loadCandidates(page = list.page) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(page));
    params.set("pageSize", String(list.pageSize));
    const response = await fetch(`/api/candidates?${params.toString()}`);
    setList((await response.json()) as CandidateListResponse);
  }

  useEffect(() => {
    void loadTaxonomy();
  }, []);

  useEffect(() => {
    void loadCandidates(1);
  }, [filters]);

  async function selectCandidate(candidate: CandidateItem) {
    const response = await fetch(`/api/candidates/${candidate.id}`);
    const body = (await response.json()) as { item: CandidateItem };
    setActive(body.item);
    setForm(candidateToForm(body.item));
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
      tagIds: form.tagIds,
      labelIds: form.labelIds,
      sourceId: form.sourceId || null,
      score: form.score === "" ? null : Number(form.score),
      scoreReason: form.scoreReason || null,
      candidateStatus: form.candidateStatus,
      availabilityStatus: form.availabilityStatus,
      snipingStatus: form.snipingStatus,
      notes: form.notes || null,
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
      await loadCandidates();
    }
    setBusy(false);
  }

  async function archiveActive() {
    if (!active) return;
    await fetch(`/api/candidates/${active.id}`, { method: "DELETE" });
    setActive(null);
    setForm(emptyForm);
    await loadCandidates();
  }

  async function bulkUpdate(payload: Record<string, unknown>) {
    if (!selectedIds.length) return;
    await fetch("/api/candidates/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, ...payload }),
    });
    await loadCandidates();
    setMessage(`Updated ${selectedIds.length} selected candidates`);
  }

  async function bulkArchive() {
    if (!selectedIds.length) return;
    await fetch("/api/candidates/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    setSelected(new Set());
    await loadCandidates();
  }

  async function exportSelected(format: "txt" | "csv" | "json") {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, ids: selectedIds }),
    });
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
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500 md:col-span-2">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 text-zinc-400" size={16} />
              <input className="field pl-8" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            </div>
          </label>
          <FilterSelect label="Category" value={filters.categoryId} items={categories} onChange={(value) => setFilters({ ...filters, categoryId: value })} />
          <FilterSelect label="Tag" value={filters.tagId} items={tags} onChange={(value) => setFilters({ ...filters, tagId: value })} />
          <FilterSelect label="Label" value={filters.labelId} items={labels} onChange={(value) => setFilters({ ...filters, labelId: value })} />
          <FilterSelect label="Source" value={filters.sourceId} items={sources} onChange={(value) => setFilters({ ...filters, sourceId: value })} />
          <PlainSelect label="Candidate status" value={filters.candidateStatus} options={candidateStatuses} onChange={(value) => setFilters({ ...filters, candidateStatus: value })} />
          <PlainSelect label="Availability" value={filters.availabilityStatus} options={availabilityStatuses} onChange={(value) => setFilters({ ...filters, availabilityStatus: value })} />
          <PlainSelect label="Sort" value={filters.sort} options={sortOptions.map(([value]) => value)} labels={Object.fromEntries(sortOptions)} onChange={(value) => setFilters({ ...filters, sort: value })} />
          <RangeFields label="Length" min={filters.lengthMin} max={filters.lengthMax} onMin={(value) => setFilters({ ...filters, lengthMin: value })} onMax={(value) => setFilters({ ...filters, lengthMax: value })} />
          <RangeFields label="Score" min={filters.scoreMin} max={filters.scoreMax} onMin={(value) => setFilters({ ...filters, scoreMin: value })} onMax={(value) => setFilters({ ...filters, scoreMax: value })} />
          <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
            Created from
            <input className="field" type="date" value={filters.createdFrom} onChange={(event) => setFilters({ ...filters, createdFrom: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
            Created to
            <input className="field" type="date" value={filters.createdTo} onChange={(event) => setFilters({ ...filters, createdTo: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
            Duplicate status
            <select className="field" value={filters.duplicateStatus} onChange={(event) => setFilters({ ...filters, duplicateStatus: event.target.value })}>
              <option value="">Any</option>
              <option value="warning">Duplicate warning label</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="panel overflow-hidden rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-3">
            <div className="text-sm font-medium">{selectedIds.length} selected</div>
            <div className="flex flex-wrap gap-2">
              <BulkControls categories={categories} tags={tags} labels={labels} onUpdate={bulkUpdate} />
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
          <div className="scrollbar-thin overflow-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      checked={list.items.length > 0 && list.items.every((candidate) => selected.has(candidate.id))}
                      onChange={(event) =>
                        setSelected(event.target.checked ? new Set(list.items.map((candidate) => candidate.id)) : new Set())
                      }
                    />
                  </th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Tags</th>
                  <th className="p-3">Labels</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Last Checked</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
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
                      <ChipList values={candidate.tags.map(({ tag }) => tag.name)} />
                    </td>
                    <td className="p-3">
                      <ChipList values={candidate.labels.map(({ label }) => label.name)} />
                    </td>
                    <td className="p-3">{candidate.score ?? "-"}</td>
                    <td className="p-3">
                      <div className="grid gap-1">
                        <span className="chip">{candidate.candidateStatus}</span>
                        <span className="text-xs text-zinc-500">{candidate.availabilityStatus}</span>
                      </div>
                    </td>
                    <td className="p-3">{candidate.source?.name ?? "-"}</td>
                    <td className="p-3">{candidate.lastCheckedAt ? new Date(candidate.lastCheckedAt).toLocaleDateString() : "-"}</td>
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
            <button className="btn btn-secondary" type="button" onClick={() => { setActive(null); setForm(emptyForm); }}>
              <Plus size={15} />
              New
            </button>
          </div>
          <form className="grid gap-3" onSubmit={submitCandidate}>
            <label className="grid gap-1 text-sm font-medium">
              Original name
              <input className="field" value={form.nameOriginal} onChange={(event) => setForm({ ...form, nameOriginal: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Category
              <select className="field" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <MultiSelect label="Tags" values={form.tagIds} items={tags} onChange={(tagIds) => setForm({ ...form, tagIds })} />
            <MultiSelect label="Labels" values={form.labelIds} items={labels} onChange={(labelIds) => setForm({ ...form, labelIds })} />
            <label className="grid gap-1 text-sm font-medium">
              Source
              <select className="field" value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })}>
                <option value="">No source</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Score
                <input className="field" type="number" min="0" max="100" value={form.score} onChange={(event) => setForm({ ...form, score: event.target.value })} />
              </label>
              <PlainSelect label="Status" value={form.candidateStatus} options={candidateStatuses} onChange={(value) => setForm({ ...form, candidateStatus: value })} />
            </div>
            <PlainSelect label="Availability" value={form.availabilityStatus} options={availabilityStatuses} onChange={(value) => setForm({ ...form, availabilityStatus: value })} />
            <PlainSelect label="Sniping" value={form.snipingStatus} options={snipingStatuses} onChange={(value) => setForm({ ...form, snipingStatus: value })} />
            <label className="grid gap-1 text-sm font-medium">
              Reason for score
              <textarea className="field min-h-20" value={form.scoreReason} onChange={(event) => setForm({ ...form, scoreReason: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Notes
              <textarea className="field min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            {message ? <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{message}</p> : null}
            <div className="flex gap-2">
              <button className="btn flex-1" disabled={busy} type="submit">
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
              <ReadOnly label="Last checked" value={active.lastCheckedAt ? new Date(active.lastCheckedAt).toLocaleString() : "-"} />
              <div>
                <h3 className="mb-2 font-semibold">Import batch</h3>
                <div className="grid gap-1 text-xs text-zinc-600">
                  {active.importRows?.length ? active.importRows.map((row) => <span key={row.id}>{row.importId} - {row.status}</span>) : <span>No import rows</span>}
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">History</h3>
                <div className="grid max-h-44 gap-2 overflow-auto text-xs text-zinc-600">
                  {active.events?.length ? active.events.map((event) => (
                    <div key={event.id} className="border-b border-zinc-100 pb-2">
                      <div className="font-medium text-zinc-800">{event.eventType}</div>
                      <div>{new Date(event.createdAt).toLocaleString()}</div>
                    </div>
                  )) : <span>No events</span>}
                </div>
              </div>
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

function PlainSelect({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
      {label}
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeFields({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (value: string) => void; onMax: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
      {label}
      <div className="grid grid-cols-2 gap-2">
        <input className="field" placeholder="Min" value={min} onChange={(event) => onMin(event.target.value)} />
        <input className="field" placeholder="Max" value={max} onChange={(event) => onMax(event.target.value)} />
      </div>
    </label>
  );
}

function MultiSelect({ label, values, items, onChange }: { label: string; values: string[]; items: TaxonomyItem[]; onChange: (values: string[]) => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select className="field min-h-28" multiple value={values} onChange={(event) => onChange(multiValues(event.currentTarget))}>
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
      {values.slice(0, 3).map((value) => (
        <span key={value} className="chip">
          {value}
        </span>
      ))}
      {values.length > 3 ? <span className="chip">+{values.length - 3}</span> : null}
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

function BulkControls({
  categories,
  tags,
  labels,
  onUpdate,
}: {
  categories: TaxonomyItem[];
  tags: TaxonomyItem[];
  labels: TaxonomyItem[];
  onUpdate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [labelId, setLabelId] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState("");

  return (
    <div className="flex flex-wrap gap-2">
      <select className="field w-40" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        <option value="">Category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <button className="btn btn-secondary" type="button" disabled={!categoryId} onClick={() => onUpdate({ categoryId })}>
        Assign
      </button>
      <select className="field w-36" value={tagId} onChange={(event) => setTagId(event.target.value)}>
        <option value="">Tag</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
      <button className="btn btn-secondary" type="button" disabled={!tagId} onClick={() => onUpdate({ addTagIds: [tagId] })}>
        Add tag
      </button>
      <button className="btn btn-secondary" type="button" disabled={!tagId} onClick={() => onUpdate({ removeTagIds: [tagId] })}>
        Remove
      </button>
      <select className="field w-36" value={labelId} onChange={(event) => setLabelId(event.target.value)}>
        <option value="">Label</option>
        {labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
      </select>
      <button className="btn btn-secondary" type="button" disabled={!labelId} onClick={() => onUpdate({ addLabelIds: [labelId] })}>
        Add label
      </button>
      <button className="btn btn-secondary" type="button" disabled={!labelId} onClick={() => onUpdate({ removeLabelIds: [labelId] })}>
        Remove
      </button>
      <select className="field w-36" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">Status</option>
        {candidateStatuses.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button className="btn btn-secondary" type="button" disabled={!status} onClick={() => onUpdate({ candidateStatus: status })}>
        Change
      </button>
      <select className="field w-40" value={availability} onChange={(event) => setAvailability(event.target.value)}>
        <option value="">Availability</option>
        {availabilityStatuses.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button className="btn btn-secondary" type="button" disabled={!availability} onClick={() => onUpdate({ availabilityStatus: availability })}>
        Change
      </button>
    </div>
  );
}

