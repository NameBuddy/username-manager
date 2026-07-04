"use client";

import { Download, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ImportItem } from "@/lib/client-types";

export function ImportsManager() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [active, setActive] = useState<ImportItem | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/imports");
    setItems(((await response.json()) as { items: ImportItem[] }).items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function openImport(id: string) {
    const response = await fetch(`/api/imports/${id}`);
    setActive(((await response.json()) as { item: ImportItem }).item);
  }

  async function rollback(id: string) {
    if (!window.confirm("Roll back this import? Candidates created by this batch will be deleted.")) return;
    const response = await fetch(`/api/imports/${id}/rollback`, { method: "POST" });
    const body = (await response.json().catch(() => null)) as { deletedCandidates?: number; error?: string } | null;
    setMessage(response.ok ? `Rolled back ${body?.deletedCandidates ?? 0} candidates` : body?.error ?? "Rollback failed");
    await load();
    await openImport(id);
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Import History</h1>
        <p className="text-sm text-zinc-600">Review import batches, invalid rows, duplicates, reports, and rollback actions.</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="panel overflow-hidden rounded-lg">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3">Import</th>
                <th className="p-3">Rows</th>
                <th className="p-3">Imported</th>
                <th className="p-3">Duplicates</th>
                <th className="p-3">Invalid</th>
                <th className="p-3">Updated</th>
                <th className="p-3">Created</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-zinc-100">
                  <td className="p-3">
                    <button className="font-semibold" type="button" onClick={() => void openImport(item.id)}>
                      {item.filename ?? item.fileType?.toUpperCase() ?? "Import"}
                    </button>
                    <div className="font-mono text-xs text-zinc-500">{item.id}</div>
                  </td>
                  <td className="p-3">{item.totalRows}</td>
                  <td className="p-3">{item.importedCount}</td>
                  <td className="p-3">{item.duplicateCount}</td>
                  <td className="p-3">{item.invalidCount}</td>
                  <td className="p-3">{item.updatedCount}</td>
                  <td className="p-3">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <a className="btn btn-secondary" href={`/api/imports/${item.id}/report`} title="Download report">
                        <Download size={15} />
                      </a>
                      <button className="btn btn-danger" type="button" onClick={() => void rollback(item.id)} title="Rollback import">
                        <RotateCcw size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="panel rounded-lg p-4">
          <h2 className="text-lg font-semibold">Import Details</h2>
          {message ? <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm">{message}</p> : null}
          {active ? (
            <div className="mt-4 grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Batch ID" value={active.id} mono />
                <Detail label="File type" value={active.fileType ?? "-"} />
                <Detail label="Rows" value={String(active.totalRows)} />
                <Detail label="Imported" value={String(active.importedCount)} />
                <Detail label="Duplicates" value={String(active.duplicateCount)} />
                <Detail label="Invalid" value={String(active.invalidCount)} />
              </div>
              <div className="max-h-[620px] overflow-auto rounded-md border border-zinc-200">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="table-head">
                    <tr>
                      <th className="p-2">Raw</th>
                      <th className="p-2">Normalized</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Reason</th>
                      <th className="p-2">Candidate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.rows?.map((row) => (
                      <tr key={row.id} className="border-t border-zinc-100">
                        <td className="p-2">{row.rawValue}</td>
                        <td className="p-2">{row.normalizedValue}</td>
                        <td className="p-2">{row.status}</td>
                        <td className="p-2">{row.reason ?? "-"}</td>
                        <td className="p-2">{row.candidate?.nameOriginal ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">Select an import to inspect row-level results.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
      <div className={`mt-1 break-words ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
