"use client";

import { Plus, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { CandidateItem, ImportItem, TaxonomyItem } from "@/lib/client-types";

type DashboardData = {
  stats: {
    totalCandidates: number;
    totalUniqueCandidates: number;
    totalDuplicatesBlocked: number;
    totalCategories: number;
    totalTags: number;
    totalLabels: number;
  };
  recentImports: ImportItem[];
  recentCandidates: CandidateItem[];
  candidatesByCategory: { id: string; name: string; color?: string | null; count: number }[];
  candidatesByStatus: { status: string; count: number }[];
  candidatesByAvailability: { status: string; count: number }[];
};

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [message, setMessage] = useState("");
  const [quickName, setQuickName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [dashboardResponse, categoryResponse] = await Promise.all([fetch("/api/dashboard"), fetch("/api/categories")]);
    setData(await fetchDashboardJson(dashboardResponse));
    setCategories(((await categoryResponse.json()) as { items: TaxonomyItem[] }).items ?? []);
  }

  async function fetchDashboardJson(response: Response) {
    return (await response.json()) as DashboardData;
  }

  useEffect(() => {
    void load();
  }, []);

  async function quickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameOriginal: quickName,
        categoryId: categoryId || null,
        sourceName: "Manual Import",
        labels: ["Manual Pick", "Pending Check"],
        availabilityStatus: "pending_check",
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage(body?.error ?? "Could not add candidate");
    } else {
      setQuickName("");
      setMessage("Candidate added");
      await load();
    }
    setBusy(false);
  }

  const cards = data
    ? [
        ["Total Names", data.stats.totalCandidates],
        ["Unique Names", data.stats.totalUniqueCandidates],
        ["Duplicates Blocked", data.stats.totalDuplicatesBlocked],
        ["Categories", data.stats.totalCategories],
        ["Tags", data.stats.totalTags],
        ["Labels", data.stats.totalLabels],
      ]
    : [];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-600">Import volume, review queues, and quick operations.</p>
        </div>
        <button className="btn btn-secondary" onClick={load} type="button">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="panel rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{Number(value).toLocaleString()}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quick Add</h2>
            <Plus size={18} />
          </div>
          <form onSubmit={quickAdd} className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <input className="field" value={quickName} onChange={(event) => setQuickName(event.target.value)} placeholder="Add name" />
            <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button className="btn" disabled={busy || !quickName.trim()} type="submit">
              Save
            </button>
          </form>
          {message ? <p className="mt-3 text-sm text-zinc-600">{message}</p> : null}
        </div>

        <div className="panel rounded-lg p-4">
          <h2 className="mb-3 text-lg font-semibold">Candidates by Status</h2>
          <div className="grid gap-2">
            {data?.candidatesByStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm">
                <span className="font-medium">{item.status}</span>
                <span>{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="panel rounded-lg p-4 xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Top Categories</h2>
          <div className="grid gap-2">
            {data?.candidatesByCategory.map((category) => (
              <div key={category.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-zinc-100 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: category.color ?? "#71717a" }} />
                  <span className="font-medium">{category.name}</span>
                </div>
                <span>{category.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-lg p-4">
          <h2 className="mb-3 text-lg font-semibold">Availability</h2>
          <div className="grid gap-2">
            {data?.candidatesByAvailability.map((item) => (
              <div key={item.status} className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm">
                <span className="font-medium">{item.status}</span>
                <span>{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel rounded-lg p-4">
          <h2 className="mb-3 text-lg font-semibold">Recently Imported Names</h2>
          <div className="grid gap-2">
            {data?.recentCandidates.map((candidate) => (
              <div key={candidate.id} className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm">
                <div>
                  <div className="font-medium">{candidate.nameOriginal}</div>
                  <div className="text-xs text-zinc-500">{candidate.category?.name ?? "Uncategorized"}</div>
                </div>
                <span className="chip">{candidate.availabilityStatus}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel rounded-lg p-4">
          <h2 className="mb-3 text-lg font-semibold">Recent Imports</h2>
          <div className="grid gap-2">
            {data?.recentImports.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-100 py-2 text-sm">
                <div>
                  <div className="font-medium">{item.filename ?? item.fileType?.toUpperCase() ?? "Import"}</div>
                  <div className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
                <span>{item.importedCount.toLocaleString()} imported</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
