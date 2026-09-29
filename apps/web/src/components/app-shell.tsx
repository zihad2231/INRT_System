"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";
import { authApi, type SessionUser } from "@/lib/api-client";
import { NotificationsPopover } from "./notifications-popover";

const navigation = [
  { title: "WORKSPACE", links: [{ label: "Overview", href: "/", icon: "⌂" }, { label: "Members", href: "/members", icon: "♙" }, { label: "Teams", href: "/teams", icon: "◉" }, { label: "Projects", href: "/projects", icon: "▱" }] },
  { title: "RESEARCH", links: [{ label: "Paper registry", href: "/projects", icon: "▤" }, { label: "Literature tracker", href: "/research", icon: "☷" }] },
  { title: "OPERATIONS", links: [{ label: "Tasks & to-dos", href: "/tasks", icon: "✓" }, { label: "Notices", href: "/notices", icon: "▣" }, { label: "Assets", href: "/assets", icon: "▧" }, { label: "Settings", href: "/settings", icon: "⚙", adminOnly: true }] },
];

export function AppShell({ children, title }: PropsWithChildren<{ title: string }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    authApi.me().then(({ user: sessionUser }) => {
      if (active) setUser(sessionUser);
    }).catch(() => {
      if (active) router.replace("/login");
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    try { await authApi.logout(); } finally { router.replace("/login"); router.refresh(); }
  }

  if (checking || !user) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7fa]"><div className="flex items-center gap-3 text-sm text-[#718079]"><span className="size-5 animate-spin rounded-full border-2 border-[#cddbd3] border-t-[#176b55]"/>Checking your secure workspace…</div></main>;
  }

  const initials = user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#17211f]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-[#e9eeeb] bg-white px-4 py-6 lg:flex">
        <Link href="/" className="flex items-center gap-3 px-3">
          {user.organization.logoUrl ? (
            <img
              src={user.organization.logoUrl}
              alt={`${user.organization.name} logo`}
              className="size-10 rounded-[14px] object-contain border border-[#e9eeeb] bg-white p-1"
            />
          ) : (
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#176b55] text-lg font-bold text-white uppercase">
              {user.organization.name ? user.organization.name.charAt(0) : "I"}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold tracking-[-0.03em] max-w-[155px]">
              {user.organization.name || "intellinova"}
            </span>
            <span className="mt-0.5 block text-[10px] tracking-[0.13em] text-[#89948f]">
              RESEARCH OPERATIONS
            </span>
          </span>
        </Link>
        <Link
          href="/settings"
          className="mt-6 flex items-center gap-3 rounded-xl border border-[#e9eeeb] bg-white p-3 transition hover:border-[#176b55] hover:bg-[#f8fbf9]"
          title="Organization Settings & Identity"
        >
          {user.organization.logoUrl ? (
            <img
              src={user.organization.logoUrl}
              alt={`${user.organization.name} logo`}
              className="size-8 rounded-lg object-contain bg-white"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-lg bg-[#eaf4f0] text-sm font-semibold text-[#176b55] uppercase">
              {user.organization.name.slice(0, 1)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{user.organization.name}</span>
            <span className="mt-0.5 block text-[11px] text-[#89948f]">Organization</span>
          </span>
          <span className="text-xs text-[#89948f]">⚙</span>
        </Link>
        <nav className="mt-8 space-y-7">
          {navigation.map((group) => {
            const links = group.links.filter(link => !link.adminOnly || user.roles.some(r => ["SUPER_ADMIN", "ADMIN"].includes(r)));
            if (links.length === 0) return null;
            return <div key={group.title}><p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.13em] text-[#a0aaa5]">{group.title}</p><ul className="space-y-1">{links.map((link) => {
            const selected = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            return <li key={link.href}><Link href={link.href} aria-current={selected ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${selected ? "bg-[#eaf4f0] font-semibold text-[#176b55]" : "text-[#65716c] hover:bg-[#f5f7f6] hover:text-[#17211f]"}`}><span className="w-4 text-center text-sm">{link.icon}</span>{link.label}</Link></li>;
          })}</ul></div>})}
        </nav>
        <div className="mt-auto rounded-2xl bg-[#f5f8f6] p-4"><div className="mb-2 flex items-center gap-2"><span className="size-2 rounded-full bg-[#4ca889]"/><span className="text-xs font-semibold">Research workspace</span></div><p className="text-[11px] leading-5 text-[#75817b]">People, projects and research progress in one place.</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2e9e5]"><div className="h-full w-1/2 rounded-full bg-[#4ca889]"/></div><p className="mt-2 text-[10px] text-[#89948f]">Workspace online</p></div>
        <div className="mt-5 flex items-center gap-3 border-t border-[#edf0ee] px-2 pt-5"><span className="grid size-9 place-items-center rounded-full bg-[#e7ece9] text-xs font-semibold text-[#50615a]">{initials}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{user.fullName}</span><span className="mt-0.5 block text-[11px] text-[#89948f]">{user.memberCode}</span></span><button onClick={signOut} className="ml-auto text-[11px] text-[#718079] hover:text-[#176b55]">Sign out</button></div>
      </aside>
      <section className="lg:pl-[248px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-[#e9eeeb] bg-white/90 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3 text-xs text-[#89948f]"><button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle navigation" aria-expanded={mobileMenuOpen} className="grid size-9 place-items-center rounded-lg border border-[#e9eeeb] text-base text-[#65716c] lg:hidden">☰</button><span className="font-bold text-[#176b55] lg:hidden">intellinova</span><span className="hidden lg:inline">{user.organization.name}</span><span>/</span><span className="font-medium text-[#28342f]">{title}</span></div>
          <div className="flex items-center gap-3"><NotificationsPopover /><Link href="/profile" className="hidden text-xs text-[#65716c] hover:text-[#176b55] sm:inline">{user.fullName}</Link><Link href="/profile" className="grid size-9 place-items-center rounded-full bg-[#e7ece9] text-xs font-semibold text-[#50615a] hover:bg-[#cddbd3]">{initials}</Link></div>
        </header>
        {mobileMenuOpen && <nav className="fixed inset-x-0 top-[72px] z-20 border-b border-[#e9eeeb] bg-white p-4 shadow-lg lg:hidden">{navigation.map((group) => { const links = group.links.filter(link => !link.adminOnly || user.roles.some(r => ["SUPER_ADMIN", "ADMIN"].includes(r))); if (links.length === 0) return null; return <div key={group.title} className="mb-4 last:mb-0"><p className="mb-1 px-3 text-[10px] font-semibold tracking-[0.13em] text-[#a0aaa5]">{group.title}</p>{links.map((link) => { const selected = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`)); return <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] ${selected ? "bg-[#eaf4f0] font-semibold text-[#176b55]" : "text-[#65716c]"}`}><span>{link.icon}</span>{link.label}</Link>; })}</div>})}</nav>}
        <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-10">{children}<footer className="mt-10 flex flex-col gap-1 border-t border-[#e8edeb] py-5 text-[10px] text-[#9aa39f] sm:flex-row sm:items-center sm:justify-between"><span>IntelliNova Research & Organization Management</span><span>{user.organization.name} · {user.memberCode}</span></footer></main>
      </section>
    </div>
  );
}
