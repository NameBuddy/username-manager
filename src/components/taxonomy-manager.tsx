"use client";

import { Merge, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { TaxonomyItem } from "@/lib/client-types";

type Kind = "categories" | "tags" | "labels";

const empty = { name: "", description: "", color: "#2563eb" };

export function TaxonomyManager({ kind, title }: { kind: Kind; title: string }) {
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [active, setActive] = useState<TaxonomyItem | null>(null);
  const [form, setForm] = useState(empty);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch(`/api/${kind}`);
    setItems(((await response.json()) as { items: TaxonomyItem[] }).items ?? []);
  }

  useEffect(() => {
    void load();
  }, [kind]);

  function select(item: TaxonomyItem) {
    setActive(item);
    setForm({ name: item.name, description: item.description ?? "", color: item.color ?? "#2563eb" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(active ? `/api/${kind}/${active.id}` : `/api/${kind}`, {
      method: active ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(response.ok ? "Saved" : body?.error ?? "Save failed");
    if (response.ok) {
      setActive(null);
      setForm(empty);
      await load();
    }
  }

  async function remove(item: TaxonomyItem) {
    await fetch(`/api/${kind}/${item.id}`, { method: "DELETE" });
    await load();
  }

  async function mergeItems() {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const response = await fetch(`/api/${kind}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, targetId }),
    });
    setMessage(response.ok ? "Merged" : "Merge failed");
    setSourceId("");
    setTargetId("");
    await load();
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-zinc-600">Create, edit, delete, merge, and review candidate counts.</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="panel overflow-hidden rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Color</th>
                <th className="p-3">Candidates</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-zinc-100">
                  <td className="p-3">
                    <button className="font-semibold" type="button" onClick={() => select(item)}>
                      {item.name}
                    </button>
                    {item.description ? <div className="text-xs text-zinc-500">{item.description}</div> : null}
                  </td>
                  <td className="p-3 font-mono text-xs">{item.slug}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border" style={{ background: item.color ?? "#fff" }} />
                      {item.color ?? "-"}
                    </span>
                  </td>
                  <td className="p-3">{item._count?.candidates ?? 0}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button className="btn btn-secondary" type="button" onClick={() => select(item)}>
                        Edit
                      </button>
                      <button className="btn btn-danger" type="button" onClick={() => void remove(item)} title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="grid gap-5">
          <form className="panel grid gap-3 rounded-lg p-4" onSubmit={save}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{active ? "Edit" : "Create"} {title.slice(0, -1)}</h2>
              <button className="btn btn-secondary" type="button" onClick={() => { setActive(null); setForm(empty); }}>
                <Plus size={15} />
                New
              </button>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Name
              <input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Description
              <textarea className="field min-h-24" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Color
              <input className="field h-11" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            </label>
            {message ? <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{message}</p> : null}
            <button className="btn" type="submit">
              <Save size={16} />
              Save
            </button>
          </form>

          <div className="panel grid gap-3 rounded-lg p-4">
            <h2 className="text-lg font-semibold">Merge</h2>
            <label className="grid gap-1 text-sm font-medium">
              Merge from
              <select className="field" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">Select source</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Merge into
              <select className="field" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                <option value="">Select target</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-secondary" type="button" disabled={!sourceId || !targetId || sourceId === targetId} onClick={() => void mergeItems()}>
              <Merge size={16} />
              Merge
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}

