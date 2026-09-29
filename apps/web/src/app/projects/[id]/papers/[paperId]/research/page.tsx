"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet } from "@/lib/api-client";

interface PaperDetail {
  id: string;
  paperCode: string;
  title: string;
  authors: string[] | null;
  publicationYear: number | null;
  doi: string | null;
  canonicalUrl: string | null;
  pdfUrl: string | null;
  imageUrl: string | null;
  abstract: string | null;
  journalName: string | null;
  publisher: string | null;
  metadata: Record<string, any> | null;
  researchArea: { name: string } | null;
  assignments: Array<{ status: string; progressPercent: number | string; user: { fullName: string; memberCode: string } }>;
}

interface PaperPage {
  data: Array<{ paper: PaperDetail }>;
}

export default function PaperDetailPage() {
  const params = useParams<{ id: string; paperId: string }>();
  const { id: projectId, paperId } = params;
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<PaperPage>(`/projects/${projectId}/papers?page=1&limit=100`)
      .then((res) => {
        if (!active) return;
        const found = res.data.find((item) => item.paper.id === paperId)?.paper;
        if (found) setPaper(found);
        else setError("Paper not found in this project.");
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load paper"); });
    return () => { active = false; };
  }, [projectId, paperId]);

  const meta = paper?.metadata || {};
  const authors = Array.isArray(paper?.authors) ? paper.authors : [];
  const keywords = Array.isArray(meta.keywords) ? meta.keywords : [];
  const assignment = paper?.assignments?.[0];

  const questions = [
    { key: "q1", label: "Q1. What problem do the authors address and why is it important?" },
    { key: "q2", label: "Q2. What data is used (source, size, timeframe, splits, collection process, ethics or consent)?" },
    { key: "q3", label: "Q3. What features or inputs are used, and how were they selected or engineered?" },
    { key: "q4", label: "Q4. What methods or models are applied, and what is the overall pipeline?" },
    { key: "q5", label: "Q5. What baselines are used for comparison, and why were they chosen?" },
    { key: "q6", label: "Q6. How is performance evaluated (metrics, experimental setup, statistical tests, user studies if applicable)?" },
    { key: "q7", label: "Q7. What are the key results with numbers, and how do they compare to baselines or prior work?" },
    { key: "q8", label: "Q8. What are the limitations and potential biases?" },
    { key: "q9", label: "Q9. Is code, data, or other artifacts available to enable replication?" },
  ];

  const hasAnyQ = questions.some(q => meta[q.key]);

  return <AppShell title="Paper details">
    <Link href={`/projects/${projectId}/papers`} className="text-xs font-medium text-[#4a9279] hover:text-[#176b55]">← Project papers</Link>

    {error && <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">{error}</p>}
    {!paper && !error && <div className="mt-6 h-56 animate-pulse rounded-2xl bg-white" />}

    {paper && <>
      {/* Paper Header */}
      <div className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wide text-[#89948f]">{paper.paperCode}</span>
              {meta.accessibility && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.accessibility === "Free" ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#fff3e0] text-[#e65100]"}`}>{meta.accessibility}</span>}
              {meta.paperType && <span className="rounded-full bg-[#f4f7f5] px-2.5 py-1 text-[10px] text-[#718079]">{meta.paperType}</span>}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{paper.title}</h1>
            {authors.length > 0 && <p className="mt-2 text-sm text-[#65716c]">{authors.join(", ")}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#89948f]">
              {paper.publicationYear && <span>{paper.publicationYear}</span>}
              {paper.journalName && <span>· {paper.journalName}</span>}
              {paper.publisher && <span>· {paper.publisher}</span>}
              {paper.doi && <span>· DOI: {paper.doi}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {assignment && <StatusBadge value={assignment.status} />}
            {meta.priority && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.priority === "Critical" ? "bg-[#fce4ec] text-[#c62828]" : meta.priority === "High" ? "bg-[#fff3e0] text-[#e65100]" : "bg-[#f4f7f5] text-[#718079]"}`}>{meta.priority} Priority</span>}
          </div>
        </div>

        {/* Links */}
        <div className="mt-5 flex flex-wrap gap-3 border-t border-[#edf0ee] pt-4">
          {paper.canonicalUrl && <a href={paper.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce6e0] px-3 py-2 text-[11px] font-semibold text-[#176b55] hover:bg-[#f4f7f5]">🔗 Paper Link</a>}
          {paper.pdfUrl && <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce6e0] px-3 py-2 text-[11px] font-semibold text-[#176b55] hover:bg-[#f4f7f5]">📄 PDF</a>}
          {paper.doi && <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce6e0] px-3 py-2 text-[11px] font-semibold text-[#176b55] hover:bg-[#f4f7f5]">🔍 DOI</a>}
        </div>
      </div>

      {/* Info Grid */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {paper.researchArea?.name && <div className="rounded-2xl border border-[#e9eeeb] bg-white p-4"><p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Research Area</p><p className="mt-1 text-sm font-medium">{paper.researchArea.name || meta.researchArea}</p></div>}
        {meta.methodology && <div className="rounded-2xl border border-[#e9eeeb] bg-white p-4"><p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Methodology</p><p className="mt-1 text-sm font-medium">{meta.methodology}</p></div>}
        {meta.volume && <div className="rounded-2xl border border-[#e9eeeb] bg-white p-4"><p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Volume / Issue / Pages</p><p className="mt-1 text-sm font-medium">{[meta.volume, meta.issue, meta.pages].filter(Boolean).join(" · ")}</p></div>}
        {assignment && <div className="rounded-2xl border border-[#e9eeeb] bg-white p-4"><p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Assigned To</p><p className="mt-1 text-sm font-medium">{assignment.user.fullName} ({assignment.user.memberCode})</p></div>}
      </div>

      {/* Keywords */}
      {keywords.length > 0 && <div className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa39f]">Keywords</p>
        <div className="mt-3 flex flex-wrap gap-2">{keywords.map((kw: string) => <span key={kw} className="rounded-full bg-[#eaf4f0] px-3 py-1.5 text-xs font-medium text-[#27745c]">{kw}</span>)}</div>
      </div>}

      {/* Abstract */}
      {paper.abstract && <div className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-5 sm:p-7">
        <h2 className="text-sm font-semibold">Abstract</h2>
        <p className="mt-3 text-sm leading-7 text-[#4a5651]">{paper.abstract}</p>
      </div>}

      {/* Dataset */}
      {meta.dataset && <div className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-5">
        <h2 className="text-sm font-semibold">Dataset / Sample Information</h2>
        <p className="mt-2 text-sm text-[#4a5651]">{meta.dataset}</p>
      </div>}

      {/* Research Questions */}
      {hasAnyQ && <div className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-5 sm:p-7">
        <h2 className="text-sm font-semibold mb-5">Research Questions & Answers</h2>
        <div className="space-y-5">
          {questions.map((q, i) => {
            const ans = meta[q.key];
            return <div key={q.key} className="border-b border-[#f4f7f5] pb-4 last:border-0">
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#eaf4f0] text-[10px] font-semibold text-[#39886d]">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#17211f]">{q.label}</p>
                  {ans ? <p className="mt-2 text-sm leading-6 text-[#4a5651]">{ans}</p> : <p className="mt-2 text-xs italic text-[#b0b8b3]">Not answered yet</p>}
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* Notes */}
      {meta.notes && <div className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-5">
        <h2 className="text-sm font-semibold">Personal Notes</h2>
        <p className="mt-2 text-sm text-[#4a5651]">{meta.notes}</p>
      </div>}
    </>}
  </AppShell>;
}
