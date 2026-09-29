"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost, apiDelete, type PageMeta, type ProjectSummary } from "@/lib/api-client";

interface ProjectPage { data: ProjectSummary[]; meta: PageMeta }
interface ProjectForm { projectCode: string; title: string; description: string; startDate: string; targetDate: string }

const emptyForm: ProjectForm = { projectCode: "", title: "", description: "", startDate: "", targetDate: "" };

export default function ProjectsPage() {
  const [page, setPage] = useState<ProjectPage | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [addTeamModal, setAddTeamModal] = useState<string | null>(null);
  const [deleteProjectModal, setDeleteProjectModal] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [teams, setTeams] = useState<{ id: string, name: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [canManage, setCanManage] = useState(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: "1", limit: "100" });
    if (status) query.set("status", status);
    try {
      const result = await apiGet<ProjectPage>(`/projects?${query.toString()}`);
      return { result, message: "" };
    } catch (loadError) {
      return { result: null, message: loadError instanceof Error ? loadError.message : "Projects load failed" };
    }
  }, [status]);

  useEffect(() => {
    let active = true;
    apiGet<{data: any[]}>("/teams?page=1&limit=100").then(res => { if (active) setTeams(res.data) }).catch(console.error);
    apiGet<any>("/auth/me").then(res => { if (active) setCanManage(res.user.roles.some((r: string) => ["SUPER_ADMIN", "ADMIN"].includes(r))) }).catch(console.error);
    void load().then(({ result, message }) => {
      if (!active) return;
      setPage(result);
      setError(message);
    });
    return () => { active = false; };
  }, [load]);

  const visibleProjects = page?.data.filter((project) =>
    `${project.title} ${project.projectCode} ${project.teams.map(({ team }) => team.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiPost<ProjectSummary>("/projects", {
        projectCode: form.projectCode,
        title: form.title,
        ...(form.description ? { description: form.description } : {}),
        ...(form.startDate ? { startDate: form.startDate } : {}),
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
      });
      setForm(emptyForm);
      setModalOpen(false);
      const refreshed = await load();
      if (refreshed.result) setPage(refreshed.result);
      setError(refreshed.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Project create failed");
    } finally { setSaving(false); }
  }

  async function addTeamToProject(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await apiPost(`/projects/${addTeamModal}/teams`, { teamIds: [selectedTeam] });
      setAddTeamModal(null);
      setSelectedTeam("");
      const refreshed = await load();
      if (refreshed.result) setPage(refreshed.result);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add team"); }
    finally { setSaving(false); }
  }

  async function deleteProject(e: FormEvent) {
    e.preventDefault();
    if (confirmText.trim().toLowerCase() !== "confirm") {
      setError("Please type 'confirm' to confirm.");
      return;
    }
    setSaving(true); setError("");
    try {
      await apiPost(`/projects/${deleteProjectModal}/delete`, {});
      setDeleteProjectModal(null);
      setConfirmText("");
      const refreshed = await load();
      if (refreshed.result) setPage(refreshed.result);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete project"); }
    finally { setSaving(false); }
  }

  return <AppShell title="Projects">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">WORKSPACE / RESEARCH</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">Projects<span className="text-[#4a9279]">.</span></h1><p className="mt-2 text-sm text-[#7c8782]">Organize research goals, people, papers, and progress.</p></div>{canManage && <button onClick={() => { setError(""); setModalOpen(true); }} className="flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white transition hover:bg-[#125a47] sm:self-auto"><span className="text-base">+</span> New project</button>}</div>

    {error && <div role="alert" className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]"><span>{error}</span><button onClick={() => void load()} className="font-semibold underline">Retry</button></div>}

    <section className="mt-8 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#edf0ee] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-semibold">Project portfolio</p><p className="mt-1 text-[11px] text-[#89948f]">{page ? `${page.meta.total} projects` : "Loading projects…"}</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" aria-label="Search projects" className="h-9 rounded-lg border border-[#e5eae7] px-3 text-xs outline-none focus:border-[#5b9c83]"/><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status" className="h-9 rounded-lg border border-[#e5eae7] bg-white px-3 text-xs outline-none focus:border-[#5b9c83]"><option value="">All statuses</option><option value="PLANNING">Planning</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="ARCHIVED">Archived</option></select></div></div>
      {!page ? <div className="space-y-3 p-5">{[1, 2, 3].map((key) => <div key={key} className="h-16 animate-pulse rounded-xl bg-[#f7f9f8]"/>)}</div> : visibleProjects.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[#eaf4f0] text-xl text-[#4a9279]">▱</span><h2 className="mt-4 text-sm font-semibold">{search ? "No matching projects" : "No projects yet"}</h2><p className="mt-1 max-w-sm text-xs leading-5 text-[#89948f]">{search ? "Try a different name, code, or team." : "Create the first project to start coordinating your research."}</p></div> : <div className="divide-y divide-[#edf0ee]">{visibleProjects.map((project) => <div key={project.id} className="group grid gap-4 px-5 py-4 transition hover:bg-[#fbfcfb] md:grid-cols-[minmax(0,1.5fr)_minmax(140px,0.7fr)_minmax(140px,0.8fr)_150px] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold tracking-wide text-[#89948f]">{project.projectCode}</span><StatusBadge value={project.status}/></div><Link href={`/projects/${project.id}`} className="mt-1 block truncate text-sm font-semibold hover:underline group-hover:text-[#176b55]">{project.title}</Link>{project.teams.length > 0 ? <div className="mt-2 space-y-1.5">{project.teams.map(({ team }) => { const count = team.members?.length ?? team._count?.members ?? 0; const memberNames = team.members?.map(m => m.user?.fullName).filter(Boolean) ?? []; return <div key={team.id} className="rounded-lg bg-[#f6f9f7] border border-[#e8eeea] px-2.5 py-1.5 text-[11px]"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-800">{team.name} <span className="font-mono text-[10px] text-[#89948f]">({team.teamCode})</span></span><span className="rounded-full bg-[#eaf4f0] px-2 py-0.5 text-[10px] font-semibold text-[#176b55]">{count} {count === 1 ? "member" : "members"}</span></div>{team.teamLeader && <p className="text-[10px] text-[#65716c] mt-0.5">Lead: <strong className="text-slate-700">{team.teamLeader.fullName}</strong></p>}{memberNames.length > 0 && <p className="text-[10px] text-[#89948f] mt-0.5 truncate">Members: {memberNames.slice(0, 3).join(", ")}{memberNames.length > 3 ? ` +${memberNames.length - 3} more` : ""}</p>}</div>; })}</div> : <p className="mt-1 text-[11px] text-[#89948f]">No teams assigned</p>}</div><div><p className="text-[10px] uppercase tracking-wider text-[#a0aaa5]">Target date</p><p className="mt-1 text-xs font-medium text-[#46534d]">{project.targetDate ? new Date(project.targetDate).toLocaleDateString() : "Not set"}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[#a0aaa5]">Research</p><p className="mt-1 text-xs font-medium text-[#46534d]">{project._count.papers} papers <span className="text-[#a0aaa5]">·</span> {project._count.members} people</p></div><div className="flex flex-col gap-2"><div className="flex justify-between text-[10px] text-[#7c8782]"><span>Progress</span><span>{Number(project.progressPercent)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e8eeea]"><div className="h-full rounded-full bg-[#55a284]" style={{ width: `${Math.min(Number(project.progressPercent), 100)}%` }}/></div>{canManage && <div className="flex flex-wrap gap-2"><button onClick={() => setAddTeamModal(project.id)} className="flex-1 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-semibold hover:bg-gray-200">Add Team</button><button onClick={() => { setDeleteProjectModal(project.id); setConfirmText(""); setError(""); }} className="flex-1 rounded-lg bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-200">Delete</button></div>}</div></div>)}</div>}
    </section>

    {modalOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="create-project-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a9279]">PROJECT SETUP</p><h2 id="create-project-title" className="mt-1 text-xl font-semibold tracking-tight">Create a project</h2><p className="mt-1 text-xs text-[#89948f]">Start with a title and unique project code.</p></div><button onClick={() => setModalOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-[#718079] hover:bg-[#f4f7f5]">×</button></div><form onSubmit={createProject} className="mt-6 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-medium">Project code</span><input required maxLength={50} value={form.projectCode} onChange={(event) => setForm({ ...form, projectCode: event.target.value })} placeholder="e.g. PRJ-2026-01" className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"/></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Title</span><input required maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Research project title" className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"/></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Description <span className="font-normal text-[#9aa39f]">(optional)</span></span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What is this project about?" className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm outline-none focus:border-[#5b9c83]"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-medium">Start date</span><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"/></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Target date</span><input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"/></label></div>{error && <p role="alert" className="text-xs text-[#a3493a]">{error}</p>}<div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4"><button type="button" onClick={() => setModalOpen(false)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium">Cancel</button><button disabled={saving} className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white disabled:opacity-60">{saving ? "Creating…" : "Create project"}</button></div></form></section></div>}
    {addTeamModal && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/35 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setAddTeamModal(null); }}><section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-semibold">Assign Team to Project</h2><p className="mt-1 text-xs text-[#89948f]">Select a team to assign to this project.</p><form onSubmit={addTeamToProject} className="mt-5 space-y-4"><label className="block"><select required value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm"><option value="" disabled>Select a team...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setAddTeamModal(null)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs">Cancel</button><button disabled={saving} className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white disabled:opacity-60">Assign Team</button></div></form></section></div>}
    {deleteProjectModal && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/35 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteProjectModal(null); }}><section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-semibold text-[#a3493a]">Delete Project</h2><p className="mt-1 text-xs text-[#89948f]">Confirm deletion by writing <strong className="text-red-600 font-mono">confirm</strong>. This cannot be undone.</p><form onSubmit={deleteProject} className="mt-5 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-medium text-[#28342f]">Write <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">confirm</span> to confirm:</span><input required type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type 'confirm' to confirm" className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"/></label>{error && <p role="alert" className="text-xs text-[#a3493a]">{error}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setDeleteProjectModal(null)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs">Cancel</button><button disabled={saving || confirmText.trim().toLowerCase() !== "confirm"} className="h-9 rounded-lg bg-[#a3493a] px-4 text-xs font-semibold text-white hover:bg-[#8a3e31] disabled:opacity-40 disabled:cursor-not-allowed">Delete Project</button></div></form></section></div>}
  </AppShell>;
}
