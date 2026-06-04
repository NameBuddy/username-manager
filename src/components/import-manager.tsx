"use client";

import { FileUp, Play, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { type TaxonomyItem } from "@/lib/client-types";
import { getImportPrimaryActionState } from "@/lib/import-ui";

type PreviewRow = {
  rowNumber: number;
  nameOriginal: string;
  nameNormalized: string;
  status: "valid" | "invalid" | "duplicate";
  reason: string | null;
  category: string | null;
  tags: string[];
  labels: string[];
  fuzzyDuplicateNames: string[];
};

type Preview = {
  rows: PreviewRow[];
  newCategories: string[];
  newTags: string[];
  newLabels: string[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    exactDuplicates: number;
    fuzzyDuplicates: number;
  };
};

type ImportResult = {
  summary: {
    importedCount: number;
    skippedDuplicates: number;
    updatedExistingRecords: number;
    invalidRows: number;
    createdCategories: string[];
    createdTags: string[];
    createdLabels: string[];
    importBatchId: string;
  };
};

function split(value: string) {
  return value
    .split(/[,;|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ImportManager() {
  const [type, setType] = useState<"txt" | "csv" | "json">("txt");
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [labels, setLabels] = useState("");
  const [nameColumn, setNameColumn] = useState("name");
  const [categoryColumn, setCategoryColumn] = useState("category");
  const [labelsColumn, setLabelsColumn] = useState("labels");
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [createMissing, setCreateMissing] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [mergeLabels, setMergeLabels] = useState(true);
  const [autoCategorizeMissingCategories, setAutoCategorizeMissingCategories] = useState(true);
  const primaryAction = getImportPrimaryActionState({ busy, content, hasPreview: Boolean(preview) });

  useEffect(() => {
    fetch("/api/categories")
      .then((response) => response.json())
      .then((body: { items: TaxonomyItem[] }) => setCategories(body.items ?? []))
      .catch(() => setCategories([]));
  }, []);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    resetImportState();
    setFilename(file.name);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "csv") setType("csv");
    else if (extension === "json") setType("json");
    else setType("txt");
    setContent(await file.text());
  }

  function resetImportState() {
    setPreview(null);
    setResult(null);
    setError("");
    setStatusMessage("");
  }

  function changeType(nextType: "txt" | "csv" | "json") {
    resetImportState();
    setType(nextType);
  }

  function changeContent(nextContent: string) {
    resetImportState();
    setContent(nextContent);
  }

  function payload() {
    return {
      type,
      content,
      filename: filename || undefined,
      columnMap: {
        name: nameColumn,
        category: categoryColumn,
        labels: labelsColumn,
      },
      defaults: {
        category: category || undefined,
        labels: split(labels),
      },
      options: { autoCategorizeMissingCategories },
    };
  }

  async function runPreview(options?: { promptForConfirmation?: boolean }) {
    setBusy(true);
    setError("");
    setStatusMessage("");
    setResult(null);
    const response = await fetch("/api/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const body = (await response.json().catch(() => null)) as { preview?: Preview; error?: string } | null;
    if (!response.ok || !body?.preview) {
      setError(body?.error ?? "Preview failed");
    } else {
      setPreview(body.preview);
      if (options?.promptForConfirmation) {
        setStatusMessage("Preview generated. Review the rows below, then click Confirm to import.");
      }
    }
    setBusy(false);
  }

  function runPrimaryAction() {
    if (primaryAction.mode === "confirm") {
      void confirmImport();
      return;
    }

    void runPreview({ promptForConfirmation: true });
  }

  async function confirmImport() {
    setBusy(true);
    setError("");
    setStatusMessage("");
    const response = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload(),
        options: { createMissing, updateExisting, mergeTagsLabels: mergeLabels, autoCategorizeMissingCategories },
      }),
    });
    const body = (await response.json().catch(() => null)) as { result?: ImportResult; error?: string } | null;
    if (!response.ok || !body?.result) {
      setError(body?.error ?? "Import failed");
    } else {
      setResult(body.result);
      setPreview(null);
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Import</h1>
        <p className="text-sm text-zinc-600">Paste or upload TXT, CSV, and JSON candidate lists with duplicate preview.</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="panel rounded-lg p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {(["txt", "csv", "json"] as const).map((item) => (
                <button key={item} className={`btn ${type === item ? "" : "btn-secondary"}`} type="button" onClick={() => changeType(item)}>
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            <label className="btn btn-secondary">
              <FileUp size={16} />
              Upload file
              <input className="hidden" type="file" accept=".txt,.csv,.json" onChange={readFile} />
            </label>
          </div>
          <textarea className="field min-h-[420px] font-mono text-sm" value={content} onChange={(event) => changeContent(event.target.value)} />
          {filename ? <p className="mt-2 text-xs text-zinc-500">Loaded file: {filename}</p> : null}
        </div>

        <aside className="panel rounded-lg p-4">
          <h2 className="mb-3 text-lg font-semibold">Default Metadata</h2>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Default category
              <select className="field" value={category} onChange={(event) => { resetImportState(); setCategory(event.target.value); }}>
                <option value="">Select category</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Labels" value={labels} onChange={(value) => { resetImportState(); setLabels(value); }} />
          </div>

          {type !== "txt" ? (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <h2 className="mb-3 text-lg font-semibold">{type.toUpperCase()} Mapping</h2>
              <div className="grid grid-cols-2 gap-2">
                <Input label={`Name ${type === "json" ? "field" : "column"}`} value={nameColumn} onChange={(value) => { resetImportState(); setNameColumn(value); }} />
                <Input label={`Category ${type === "json" ? "field" : "column"}`} value={categoryColumn} onChange={(value) => { resetImportState(); setCategoryColumn(value); }} />
                <Input label={`Labels ${type === "json" ? "field" : "column"}`} value={labelsColumn} onChange={(value) => { resetImportState(); setLabelsColumn(value); }} />
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-2 border-t border-zinc-200 pt-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoCategorizeMissingCategories}
                onChange={(event) => { resetImportState(); setAutoCategorizeMissingCategories(event.target.checked); }}
              />
              DeepSeek category fill
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={createMissing} onChange={(event) => setCreateMissing(event.target.checked)} />
              Create missing categories and labels
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={mergeLabels} onChange={(event) => setMergeLabels(event.target.checked)} />
              Merge labels into duplicates
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={updateExisting} onChange={(event) => setUpdateExisting(event.target.checked)} />
              Update existing metadata
            </label>
          </div>

          {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {statusMessage ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{statusMessage}</p> : null}
          {!error && !statusMessage && primaryAction.hint ? <p className="mt-4 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">{primaryAction.hint}</p> : null}
          <div className="mt-5 flex gap-2">
            <button className="btn btn-secondary flex-1" type="button" disabled={busy || !content.trim()} onClick={() => void runPreview()}>
              <Play size={16} />
              Preview
            </button>
            <button className="btn flex-1" type="button" disabled={primaryAction.disabled} title={primaryAction.title} onClick={runPrimaryAction}>
              <Upload size={16} />
              {primaryAction.label}
            </button>
          </div>
        </aside>
      </section>

      {preview ? (
        <section className="panel rounded-lg p-4">
          <h2 className="mb-3 text-lg font-semibold">Preview</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-5">
            <Stat label="Rows" value={preview.summary.totalRows} />
            <Stat label="Valid" value={preview.summary.validRows} />
            <Stat label="Invalid" value={preview.summary.invalidRows} />
            <Stat label="Exact duplicates" value={preview.summary.exactDuplicates} />
            <Stat label="Fuzzy warnings" value={preview.summary.fuzzyDuplicates} />
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <TaxonomyPreview label="New categories" values={preview.newCategories} />
            <TaxonomyPreview label="New labels" values={preview.newLabels} />
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="p-3">Row</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Normalized</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Fuzzy matches</th>
                  <th className="p-3">Labels</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber} className="border-t border-zinc-100">
                    <td className="p-3">{row.rowNumber}</td>
                    <td className="p-3 font-medium">{row.nameOriginal}</td>
                    <td className="p-3">{row.nameNormalized}</td>
                    <td className="p-3">{row.category ?? "-"}</td>
                    <td className="p-3"><span className="chip">{row.status}</span></td>
                    <td className="p-3">{row.reason ?? "-"}</td>
                    <td className="p-3">{row.fuzzyDuplicateNames.join(", ") || "-"}</td>
                    <td className="p-3">{row.labels.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="panel rounded-lg p-4">
          <h2 className="mb-3 text-lg font-semibold">Import Result</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Imported" value={result.summary.importedCount} />
            <Stat label="Duplicates skipped" value={result.summary.skippedDuplicates} />
            <Stat label="Updated" value={result.summary.updatedExistingRecords} />
            <Stat label="Invalid" value={result.summary.invalidRows} />
          </div>
          <div className="mt-4 text-sm">
            <div>Import batch ID: <span className="font-mono">{result.summary.importBatchId}</span></div>
            <a className="mt-2 inline-flex text-zinc-950 underline" href={`/api/imports/${result.summary.importBatchId}/report`}>
              Download import report
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input className="field" value={value} type={type} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function TaxonomyPreview({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {values.length ? values.map((value) => <span className="chip" key={value}>{value}</span>) : <span className="text-sm text-zinc-500">None</span>}
      </div>
    </div>
  );
}
