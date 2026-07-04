"use client";

import { Download, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { sortOptions, type TaxonomyItem } from "@/lib/client-types";
import { downloadBlob } from "@/lib/client-utils";

const blankFilters = {
  search: "",
  categoryId: "",
  labelId: "",
  lengthMin: "",
  lengthMax: "",
  createdFrom: "",
  createdTo: "",
  lastCheckedFrom: "",
  lastCheckedTo: "",
  duplicateStatus: "",
  sort: "newest",
};

type Filters = typeof blankFilters;
type Preset = { name: string; filters: Filters; format: "txt" | "csv" | "json" };

const PRESETS_STORAGE_KEY = "namedb-export-presets";

function loadStoredPresets(): Preset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as Preset[]) : [];
  } catch {
    return [];
  }
}

export function ExportManager() {
  const [format, setFormat] = useState<"txt" | "csv" | "json">("txt");
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [labels, setLabels] = useState<TaxonomyItem[]>([]);
  const [count, setCount] = useState(0);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("Custom Export");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/categories"), fetch("/api/labels")]).then(
      async ([categoryResponse, labelResponse]) => {
        setCategories(((await categoryResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
        setLabels(((await labelResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
      },
    );
    setPresets(loadStoredPresets());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set("pageSize", "10");
    fetch(`/api/candidates?${params.toString()}`)
      .then((response) => response.json())
      .then((body: { total: number }) => setCount(body.total ?? 0))
      .catch(() => setCount(0));
  }, [filters]);

  async function exportFile() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, filters }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Export failed");
        return;
      }
      downloadBlob(await response.blob(), `namedb-export.${format}`);
    } catch {
      setError("Export failed");
    } finally {
      setBusy(false);
    }
  }

  function savePreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = [...presets.filter((preset) => preset.name !== presetName), { name: presetName, filters, format }];
    setPresets(next);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
  }

  function applyPreset(preset: Preset) {
    setFormat(preset.format);
    setFilters(preset.filters);
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Export</h1>
        <p className="text-sm text-zinc-600">Export all or filtered candidates as TXT, CSV, or JSON.</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="panel rounded-lg p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {(["txt", "csv", "json"] as const).map((item) => (
              <button className={`btn ${format === item ? "" : "btn-secondary"}`} type="button" key={item} onClick={() => setFormat(item)}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Input label="Search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} />
            <Select label="Category" value={filters.categoryId} items={categories} onChange={(value) => setFilters({ ...filters, categoryId: value })} />
            <Select label="Label" value={filters.labelId} items={labels} onChange={(value) => setFilters({ ...filters, labelId: value })} />
            <Input label="Min length" value={filters.lengthMin} onChange={(value) => setFilters({ ...filters, lengthMin: value })} />
            <Input label="Max length" value={filters.lengthMax} onChange={(value) => setFilters({ ...filters, lengthMax: value })} />
            <Input label="Created from" type="date" value={filters.createdFrom} onChange={(value) => setFilters({ ...filters, createdFrom: value })} />
            <Input label="Created to" type="date" value={filters.createdTo} onChange={(value) => setFilters({ ...filters, createdTo: value })} />
            <Input label="Last checked from" type="date" value={filters.lastCheckedFrom} onChange={(value) => setFilters({ ...filters, lastCheckedFrom: value })} />
            <Input label="Last checked to" type="date" value={filters.lastCheckedTo} onChange={(value) => setFilters({ ...filters, lastCheckedTo: value })} />
            <PlainSelect
              label="Sort"
              value={filters.sort}
              options={sortOptions.map(([value]) => value)}
              labels={Object.fromEntries(sortOptions)}
              onChange={(value) => setFilters({ ...filters, sort: value })}
            />
          </div>
        </div>

        <aside className="panel rounded-lg p-4">
          <h2 className="text-lg font-semibold">Preview Count</h2>
          <div className="mt-3 text-4xl font-semibold">{count.toLocaleString()}</div>
          <p className="mt-1 text-sm text-zinc-600">Candidates match these filters.</p>
          {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button className="btn mt-5 w-full" type="button" disabled={busy} onClick={() => void exportFile()}>
            <Download size={16} />
            Export {format.toUpperCase()}
          </button>

          <form className="mt-5 grid gap-2 border-t border-zinc-200 pt-4" onSubmit={savePreset}>
            <h2 className="text-lg font-semibold">Presets</h2>
            <Input label="Preset name" value={presetName} onChange={setPresetName} />
            <button className="btn btn-secondary" type="submit">
              <Save size={16} />
              Save preset
            </button>
          </form>

          <div className="mt-4 grid gap-2">
            {presets.map((preset) => (
              <button key={preset.name} className="btn btn-secondary justify-between" type="button" onClick={() => applyPreset(preset)}>
                {preset.name}
                <span className="text-xs uppercase">{preset.format}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-zinc-500">
      {label}
      <input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, items, onChange }: { label: string; value: string; items: { id: string; name: string }[]; onChange: (value: string) => void }) {
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

function PlainSelect({ label, value, options, labels, onChange }: { label: string; value: string; options: readonly string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
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
