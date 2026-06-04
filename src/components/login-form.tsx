"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Login failed");
      setBusy(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="panel grid w-full max-w-sm gap-4 rounded-lg p-6 shadow-sm">
      <div>
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white">
          <LockKeyhole size={18} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">NameDB Admin</h1>
        <p className="mt-1 text-sm text-zinc-600">Enter the access password to manage username candidates.</p>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Access Password
        <input
          autoComplete="current-password"
          autoFocus
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
        />
      </label>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button className="btn" disabled={busy} type="submit">
        {busy ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
