"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, type PageMeta, type ProjectSummary } from "@/lib/api-client";

interface ProjectPage { data: ProjectSummary[]; meta: PageMeta }
interface PaperPage { data: Array<{ paper: { id: string; paperCode: string; title: string; assignments: Array<{ userId: string; status: string; progressPercent: string | number }> } }>; meta: PageMeta }

export default function ResearchPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [papers, setPapers] = useState<PaperPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { let active = true; apiGet<ProjectPage>("/projects?page=1&limit=100").then((page) => { if (active) { setProjects(page.data); if (!selectedId && page.data[0]) setSelectedId(page.data[0].id); } }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load projects"); }); return () => { active = false; }; }, [selectedId]);

  const loadPapers = useCallback(async () => selectedId ? apiGet<PaperPage>(`/projects/${selectedId}/papers?page=1&limit=100`) : null, [selectedId]);
  useEffect(() => { let active = true; void loadPapers().then((data) => { if (active) { setPapers(data); setError(""); } }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load papers"); }); return () => { active = false; }; }, [loadPapers]);

  return <AppShell title="Literature tracker"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">RESEARCH</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">Literature tracker<span className="text-[#4a9279]">.</span></h1><p className="mt-2 text-sm text-[#7c8782]">Choose a project and continue extracting structured research data.</p></div>{error && <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">{error}</p>}
    <section className="mt-7 rounded-2xl border border-[#e9eeeb] bg-white p-5"><label className="block max-w-lg"><span className="mb-2 block text-xs font-semibold">Research project</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-11 w-full rounded-xl border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"><option value="">Choose a project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} · {project.title}</option>)}</select></label></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white"><div className="border-b border-[#edf0ee] p-5"><h2 className="text-sm font-semibold">Papers to track</h2><p className="mt-1 text-[11px] text-[#89948f]">Open a paper to fill the project’s dynamic question set.</p></div>{!selectedId ? <p className="px-5 py-12 text-center text-xs text-[#89948f]">Create or join a project to get started.</p> : !papers ? <div className="space-y-3 p-5">{[1,2].map((n) => <div key={n} className="h-14 animate-pulse rounded-lg bg-[#f7f9f8]"/>)}</div> : papers.data.length === 0 ? <p className="px-5 py-12 text-center text-xs text-[#89948f]">No papers in this project yet. Add papers from the project’s paper registry.</p> : <div className="divide-y divide-[#edf0ee]">{papers.data.map(({ paper }) => { const assignment = paper.assignments[0]; return <div key={paper.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><p className="text-[10px] font-semibold text-[#89948f]">{paper.paperCode}</p><h3 className="mt-1 text-sm font-semibold">{paper.title}</h3>{assignment && <p className="mt-1 text-[11px] text-[#89948f]">Your assignment · {assignment.status} · {Number(assignment.progressPercent)}% complete</p>}</div><div className="flex items-center gap-3">{assignment && <StatusBadge value={assignment.status}/>}<Link href={`/projects/${selectedId}/papers/${paper.id}/research`} className="rounded-lg border border-[#dce6e0] px-3 py-2 text-[11px] font-semibold text-[#176b55]">Open tracker →</Link></div></div>; })}</div>}</section>
  </AppShell>;
}
