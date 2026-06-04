import Link from "next/link";
import { BarChart3, Download, FolderTree, History, Import, UsersRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

const nav = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/candidates", label: "Candidates", icon: UsersRound },
  { href: "/admin/import", label: "Import", icon: Import },
  { href: "/admin/export", label: "Export", icon: Download },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/imports", label: "Import History", icon: History },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-[#f5f3ee] text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white/90 p-4 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-8 block">
          <div className="text-xl font-bold tracking-tight">NameDB</div>
          <div className="text-xs text-zinc-500">Private admin</div>
        </Link>
        <nav className="grid gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
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
