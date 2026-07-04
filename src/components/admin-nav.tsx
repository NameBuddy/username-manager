"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Download, FolderTree, History, Import, Tags, UsersRound } from "lucide-react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/candidates", label: "Candidates", icon: UsersRound },
  { href: "/admin/import", label: "Import", icon: Import },
  { href: "/admin/export", label: "Export", icon: Download },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/labels", label: "Labels", icon: Tags },
  { href: "/admin/imports", label: "Import History", icon: History },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
              active ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
