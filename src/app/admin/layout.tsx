import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";
import { LogoutButton } from "@/components/logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-[#f5f3ee] text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white/90 p-4 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-8 block">
          <div className="text-xl font-bold tracking-tight">NameDB</div>
          <div className="text-xs text-zinc-500">Private admin</div>
        </Link>
        <AdminNav />
        <div className="mt-auto">
          <LogoutButton />
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-[#f5f3ee]/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/admin" className="font-bold">
            NameDB
          </Link>
          <LogoutButton />
        </header>
        <main className="mx-auto w-full max-w-[1680px] px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
