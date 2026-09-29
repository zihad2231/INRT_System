"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { PaperAddForm } from "@/components/paper-add-form";
import { apiGet, apiPost, type ProjectSummary } from "@/lib/api-client";

interface Reader { id: string; memberCode: string; fullName: string; teamMemberships: Array<{ team: { name: string } }> }
interface Assignment { id: string; userId: string; status: string; progressPercent: number | string; startedAt: string | null; user: Reader }
interface Paper { id: string; paperCode: string; title: string; authors: unknown; publicationYear: number | null; doi: string | null; canonicalUrl: string | null; researchArea: { id: string; name: string } | null; assignments: Assignment[] }
interface PaperLink { id: string; addedAt: string; paper: Paper }
interface PaperPage { data: PaperLink[]; meta: { total: number } }

export default function ProjectPapersPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [papers, setPapers] = useState<PaperPage | null>(null);
  const [modal, setModal] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    return Promise.all([
      apiGet<ProjectSummary>(`/projects/${projectId}`),
      apiGet<PaperPage>(`/projects/${projectId}/papers?page=1&limit=100`),
    ]);
  }, [projectId]);
  useEffect(() => { let alive = true; void load().then(([p, list]) => { if (alive) { setProject(p); setPapers(list); } }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Could not load papers"); }); return () => { alive = false; }; }, [load]);


  async function requestExport() {
    setExportBusy(true); setError("");
    try {
      await apiPost("/exports", { jobType: "PROJECT_EXPORT", parameters: { projectId } });
      alert("Export job has been queued. You will receive a notification when your Excel file is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to queue export.");
    } finally {
      setExportBusy(false);
    }
  }

  return <AppShell title="Paper registry">
    <Link href={`/projects/${projectId}`} className="text-xs font-medium text-[#4a9279] hover:text-[#176b55]">← {project?.title ?? "Project"}</Link>
    <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">CENTRAL PAPER REGISTRY</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">Papers<span className="text-[#4a9279]">.</span></h1><p className="mt-2 text-sm text-[#7c8782]">Papers linked to {project?.projectCode ?? "this project"}.</p></div><div className="flex gap-3"><button onClick={requestExport} disabled={exportBusy} className="h-10 self-start rounded-lg border border-[#dce6e0] px-4 text-xs font-semibold text-[#176b55] hover:bg-[#f4f7f5] sm:self-auto">{exportBusy ? "Queueing..." : "↓ Export Excel"}</button><button onClick={() => { setError(""); setModal(true); }} className="h-10 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white hover:bg-[#125a47] sm:self-auto">＋ Add paper</button></div></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">{error}</p>}
    <section className="mt-8 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white"><div className="flex items-center justify-between border-b border-[#edf0ee] p-5"><div><h2 className="text-sm font-semibold">Project papers</h2><p className="mt-1 text-[11px] text-[#89948f]">{papers ? `${papers.meta.total} registry records` : "Loading papers…"}</p></div><span className="grid size-9 place-items-center rounded-xl bg-[#edf2fa] text-[#6481b0]">▤</span></div>{!papers ? <div className="space-y-3 p-5">{[1,2,3].map((x) => <div key={x} className="h-16 animate-pulse rounded-xl bg-[#f7f9f8]"/>)}</div> : papers.data.length === 0 ? <div className="px-5 py-14 text-center"><p className="text-sm font-semibold">No papers linked to this project</p><p className="mt-2 text-xs text-[#89948f]">Add a paper to check the central registry and prevent duplicate assignments.</p></div> : <div className="divide-y divide-[#edf0ee]">{papers.data.map(({ paper }) => { const reader = paper.assignments[0]; return <article key={paper.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold text-[#89948f]">{paper.paperCode}</span>{paper.researchArea && <span className="rounded-full bg-[#f4f7f5] px-2.5 py-1 text-[10px] text-[#718079]">{paper.researchArea.name}</span>}</div><h3 className="mt-1 text-sm font-semibold">{paper.title}</h3><p className="mt-1 text-[11px] text-[#89948f]">{paper.publicationYear ?? "Year unknown"}{paper.doi ? ` · DOI ${paper.doi}` : ""}</p>{reader && <p className="mt-2 text-[11px] text-[#65716c]">Primary reader: <span className="font-semibold">{reader.user.fullName}</span> ({reader.user.memberCode}){reader.user.teamMemberships[0] ? ` · ${reader.user.teamMemberships[0].team.name}` : ""}</p>}</div><div className="flex items-center gap-3">{reader ? <><StatusBadge value={reader.status}/><span className="text-[11px] text-[#718079]">{Number(reader.progressPercent)}%</span></> : <StatusBadge value="TODO"/>}<Link href={`/projects/${projectId}/papers/${paper.id}/research`} className="rounded-lg border border-[#dce6e0] px-3 py-2 text-[11px] font-semibold text-[#176b55]">Open tracker →</Link></div></article>; })}</div>}</section>
    {modal && <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/35 p-4 sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) { setModal(false); } }}>
      <PaperAddForm projectId={projectId} onClose={() => setModal(false)} onSuccess={async () => { setModal(false); const [p, list] = await load(); setProject(p); setPapers(list); }} />
    </div>}
  </AppShell>;
}
