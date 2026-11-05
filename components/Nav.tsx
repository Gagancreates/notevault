"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "./ui";

type Me = { id: string; name: string; role: "admin" | "user" } | null;

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, [path]);

  if (path === "/login" || path === "/signup" || path === "/") return null;

  const links = [
    { href: "/dashboard", label: "Notes" },
    { href: "/upload", label: "Upload" },
    { href: "/search", label: "Search" },
    ...(me?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-xs font-bold text-white">NV</span>
          NoteVault
        </Link>
        <nav className="flex gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm ${
                path.startsWith(l.href) ? "bg-slate-100 font-medium text-ink" : "text-slate-600 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {me && (
            <>
              <span className="hidden text-slate-600 sm:inline">{me.name}</span>
              <Badge tone={me.role}>{me.role}</Badge>
            </>
          )}
          <button onClick={logout} className="text-slate-500 hover:text-ink">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
