"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, type DashboardData, type NoticeSummary, type PageMeta, type ProjectSummary, type TaskSummary } from "@/lib/api-client";

interface PageData<T> { data: T[]; meta: PageMeta }

export default function Home() {
  const [projects, setProjects] = useState<PageData<ProjectSummary> | null>(null);
  const [tasks, setTasks] = useState<PageData<TaskSummary> | null>(null);
  const [notices, setNotices] = useState<PageData<NoticeSummary> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    apiGet<DashboardData>("/dashboard/member").then((dashboard) => {
      if (!active) return;
      setProjects({ data: dashboard.projects, meta: { page: 1, limit: dashboard.projects.length, total: dashboard.metrics.projects, totalPages: 1 } });
      setTasks({ data: dashboard.tasks, meta: { page: 1, limit: dashboard.tasks.length, total: dashboard.tasks.length, totalPages: 1 } });
      setNotices({ data: dashboard.notices, meta: { page: 1, limit: dashboard.notices.length, total: dashboard.metrics.notices, totalPages: 1 } });
    }).catch((error) => { if (active) setErrors([error instanceof Error ? error.message : "Dashboard load failed"]); });
    return () => { active = false; };
  }, []);

  const openTasks = tasks?.data.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status)).length;
  const metrics = [
    { label: "Projects", value: projects?.meta.total, hint: "Visible to your account", icon: "◫", color: "mint" },
    { label: "Research papers", value: projects?.data.reduce((total, project) => total + project._count.papers, 0), hint: "Across the listed projects", icon: "▤", color: "blue" },
    { label: "Open tasks", value: openTasks, hint: "Your visible work queue", icon: "✓", color: "amber" },
    { label: "Notices", value: notices?.meta.total, hint: "Currently visible to you", icon: "▣", color: "violet" },
  ];

  return <AppShell title="Overview">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">RESEARCH OPERATIONS</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em] sm:text-[34px]">Your workspace<span className="text-[#4a9279]">.</span></h1><p className="mt-2 text-sm text-[#7c8782]">A live view of projects, research, and team activity.</p></div><Link href="/projects" className="flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#125a47] sm:self-auto"><span className="text-base leading-none">+</span> Explore projects</Link></div>

    {errors.length > 0 && <div role="status" className="mt-5 rounded-xl border border-[#f1dfbd] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#8a6731]">Some workspace data is unavailable: {errors.join(" · ")}</div>}

    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className="rounded-2xl border border-[#e9eeeb] bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-[#7c8782]">{metric.label}</p><span className={`grid size-9 place-items-center rounded-xl text-sm ${metric.color === "mint" ? "bg-[#eaf4f0] text-[#39886d]" : metric.color === "blue" ? "bg-[#edf2fa] text-[#6481b0]" : metric.color === "amber" ? "bg-[#fbf3e8] text-[#c28a42]" : "bg-[#f2effa] text-[#8b77ba]"}`}>{metric.icon}</span></div><p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-[#26332e]">{metric.value ?? <span className="inline-block h-7 w-10 animate-pulse rounded-md bg-[#edf1ee]"/>}</p><p className="mt-1 text-[11px] text-[#9aa39f]">{metric.hint}</p></article>)}</div>

    <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <section className="rounded-2xl border border-[#e9eeeb] bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Research portfolio</h2><p className="mt-1 text-xs text-[#89948f]">Projects you can access</p></div><Link href="/projects" className="rounded-lg border border-[#e9eeeb] px-3 py-2 text-[11px] font-medium text-[#65716c] hover:text-[#176b55]">All projects <span className="ml-2">↗</span></Link></div>
        {!projects ? <div className="mt-6 h-[220px] animate-pulse rounded-xl bg-[#f7f9f8]"/> : projects.data.length === 0 ? <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#dfe7e2] bg-[#fbfcfb] px-6 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[#eaf4f0] text-xl text-[#4a9279]">▱</span><h3 className="mt-4 text-sm font-semibold">No projects yet</h3><p className="mt-1 max-w-sm text-xs leading-5 text-[#89948f]">Once an administrator creates a project or adds you to one, it will show here.</p></div> : <div className="mt-5 divide-y divide-[#edf0ee]">{projects.data.slice(0, 5).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex flex-col gap-3 py-4 transition hover:bg-[#fbfcfb] sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold tracking-wide text-[#89948f]">{project.projectCode}</span><StatusBadge value={project.status}/></div><h3 className="mt-1 truncate text-sm font-semibold">{project.title}</h3><p className="mt-1 truncate text-[11px] text-[#89948f]">{project.teams.map(({ team }) => team.name).join(", ") || project.owner?.fullName || "Project team"} · {project._count.papers} papers</p></div><div className="flex items-center gap-3 sm:w-36"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8eeea]"><div className="h-full rounded-full bg-[#55a284]" style={{ width: `${Math.min(Number(project.progressPercent), 100)}%` }}/></div><span className="w-9 text-right text-[10px] font-medium text-[#65716c]">{Number(project.progressPercent)}%</span></div></Link>)}</div>}
      </section>

      <div className="space-y-5">
        <section className="rounded-2xl border border-[#e9eeeb] bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">My tasks</h2><p className="mt-1 text-xs text-[#89948f]">Next items in your queue</p></div><Link href="/tasks" className="text-[11px] font-medium text-[#176b55]">View all →</Link></div>{!tasks ? <div className="mt-5 h-28 animate-pulse rounded-xl bg-[#f7f9f8]"/> : tasks.data.length === 0 ? <p className="mt-5 rounded-xl bg-[#fbfcfb] px-4 py-7 text-center text-xs text-[#89948f]">No visible tasks right now.</p> : <ul className="mt-4 divide-y divide-[#edf0ee]">{tasks.data.slice(0, 4).map((task) => <li key={task.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold">{task.title}</p><p className="mt-1 truncate text-[10px] text-[#89948f]">{task.project?.title ?? task.team?.name ?? task.taskCode}</p></div><StatusBadge value={task.status}/></div></li>)}</ul>}</section>

        <section className="rounded-2xl border border-[#e9eeeb] bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Notice center</h2><p className="mt-1 text-xs text-[#89948f]">Updates for your audience</p></div><Link href="/notices" className="text-[11px] font-medium text-[#176b55]">View all →</Link></div>{!notices ? <div className="mt-5 h-24 animate-pulse rounded-xl bg-[#f7f9f8]"/> : notices.data.length === 0 ? <p className="mt-5 rounded-xl bg-[#fbfcfb] px-4 py-6 text-center text-xs text-[#89948f]">No current notices.</p> : <ul className="mt-4 space-y-2">{notices.data.slice(0, 2).map((notice) => <li key={notice.id} className="rounded-xl bg-[#fbfcfb] p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-semibold">{notice.title}</p><StatusBadge value={notice.priority}/></div><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#7c8782]">{notice.content}</p></li>)}</ul>}</section>
      </div>
    </div>
  </AppShell>;
}
