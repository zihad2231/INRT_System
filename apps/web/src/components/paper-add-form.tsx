"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";

interface TeamOption { id: string; teamCode: string; name: string }
interface ProjectOption { id: string; projectCode: string; title: string; teams: Array<{ team: { id: string } }> }
interface TeamPage { data: Array<{ id: string; teamCode: string; name: string }>; meta: { total: number } }
interface ProjectPage { data: ProjectOption[]; meta: { total: number } }

interface PaperAddFormProps {
  projectId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaperAddForm({ projectId: initialProjectId, onClose, onSuccess }: PaperAddFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<any>(null);

  // Team & Project selection
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? "");

  // Load user's teams and projects on mount
  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<TeamPage>("/teams?page=1&limit=100"),
      apiGet<ProjectPage>("/projects?page=1&limit=100"),
    ]).then(([teamRes, projRes]) => {
      if (!active) return;
      setTeams(teamRes.data);
      setAllProjects(projRes.data);
      // If we have an initial projectId, auto-select its team
      if (initialProjectId) {
        const proj = projRes.data.find(p => p.id === initialProjectId);
        if (proj?.teams[0]) setSelectedTeamId(proj.teams[0].team.id);
      } else if (teamRes.data[0]) {
        setSelectedTeamId(teamRes.data[0].id);
      }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load teams/projects"); });
    return () => { active = false; };
  }, [initialProjectId]);

  // Filter projects by selected team
  const filteredProjects = selectedTeamId
    ? allProjects.filter(p => p.teams.some(t => t.team.id === selectedTeamId))
    : allProjects;

  // Auto-select first project when team changes (unless we have an initialProjectId)
  useEffect(() => {
    if (initialProjectId) return;
    if (filteredProjects.length > 0 && !filteredProjects.find(p => p.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0].id);
    } else if (filteredProjects.length === 0) {
      setSelectedProjectId("");
    }
  }, [selectedTeamId, filteredProjects, selectedProjectId, initialProjectId]);

  // Form State
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [paperType, setPaperType] = useState("Journal Article");
  const [journalName, setJournalName] = useState("");
  const [publisher, setPublisher] = useState("");
  
  const [doi, setDoi] = useState("");
  const [url, setUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  
  const [researchArea, setResearchArea] = useState("Artificial Intelligence");
  const [keywords, setKeywords] = useState("");
  const [methodology, setMethodology] = useState("");
  const [dataset, setDataset] = useState("");
  const [abstract, setAbstract] = useState("");
  
  const [publicationDate, setPublicationDate] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [pages, setPages] = useState("");
  
  const [priority, setPriority] = useState("Normal");
  const [expectedDate, setExpectedDate] = useState("");
  
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [accessibility, setAccessibility] = useState("Free");

  // Research Questions (Q1–Q9)
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");
  const [q5, setQ5] = useState("");
  const [q6, setQ6] = useState("");
  const [q7, setQ7] = useState("");
  const [q8, setQ8] = useState("");
  const [q9, setQ9] = useState("");

  const paperTypes = ["Journal Article", "Conference Paper", "Review Paper", "Systematic Review", "Survey Paper", "Book Chapter", "Thesis", "Preprint", "Other"];
  const researchAreas = ["Artificial Intelligence", "Machine Learning", "Education Technology", "NLP", "Computer Vision", "Other"];
  const priorities = ["Low", "Normal", "High", "Critical"];
  const methodologies = ["Qualitative", "Quantitative", "Mixed Method", "Experimental", "Survey", "Case Study", "Systematic Review", "Other"];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); 
    setSaving(true); 
    setError(""); 
    setConflict(null);

    if (!selectedProjectId) {
      setError("Please select a team and project first.");
      setSaving(false);
      return;
    }
    
    try {
      await apiPost(`/projects/${selectedProjectId}/papers`, {
        title,
        authors: authors.split(",").map(a => a.trim()).filter(Boolean),
        publicationYear: publicationYear ? parseInt(publicationYear, 10) : undefined,
        journalName: journalName || undefined,
        publisher: publisher || undefined,
        pdfUrl: pdfUrl || undefined,
        imageUrl: imageUrl || undefined,
        abstract: abstract || undefined,
        ...(doi.trim() ? { identifiers: [{ type: "DOI", value: doi.trim() }] } : {}),
        ...(url.trim() ? { canonicalUrl: url.trim() } : {}),
        metadata: {
          paperType,
          researchArea,
          keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
          methodology,
          dataset,
          publicationDate,
          volume,
          issue,
          pages,
          priority,
          expectedCompletionDate: expectedDate,
          notes,
          accessibility,
          q1, q2, q3, q4, q5, q6, q7, q8, q9,
        }
      });
      onSuccess();
    } catch (e) {
      if (e instanceof ApiError && e.code === "PAPER_ALREADY_ASSIGNED" && e.details) {
        setConflict(e.details);
      } else {
        setError(e instanceof Error ? e.message : "Could not add paper");
      }
    } finally {
      setSaving(false);
    }
  }

  if (conflict) {
    return (
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a9279]">CENTRAL REGISTRY CHECK</p>
            <h2 className="mt-1 text-xl font-semibold">Duplicate Paper Detected</h2>
            <p className="mt-1 text-xs text-[#89948f]">This paper is already assigned to a member.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-[#f4f7f5]">×</button>
        </div>
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-[#e2e9e5] bg-[#f4f7f5] p-4">
            <p className="text-xs font-semibold text-[#a3493a]">Warning: Paper Already Assigned</p>
            <div className="mt-3 text-sm">
              <p><span className="text-[#89948f]">Reader:</span> <span className="font-semibold">{conflict.name}</span> ({conflict.memberId})</p>
              {conflict.team && <p><span className="text-[#89948f]">Team:</span> {conflict.team.name}</p>}
              <p className="mt-2">
                <span className="text-[#89948f]">Status:</span> {conflict.status} 
                <span className="ml-2 text-xs font-medium text-[#176b55]">{conflict.progress}% Progress</span>
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs">Close</button>
            <button type="button" onClick={() => alert("Collaboration request feature coming soon.")} className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white">Request Collaboration</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section role="dialog" aria-modal="true" aria-labelledby="add-paper-heading" className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col h-[90vh]">
      <div className="flex items-start justify-between border-b border-[#edf0ee] p-6 shrink-0">
        <div>
          <h2 id="add-paper-heading" className="text-xl font-semibold">Add a Paper</h2>
          <p className="mt-1 text-xs text-[#89948f]">Complete the form below to add a new research paper to the registry.</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-[#f4f7f5]">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <form id="add-paper-form" onSubmit={handleSubmit} className="space-y-8">
          
          {/* Team & Project Selection */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Select Team & Project</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Your Team *</span>
                <select required value={selectedTeamId} onChange={e => { setSelectedTeamId(e.target.value); }} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm bg-white focus:border-[#5b9c83] outline-none">
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.teamCode})</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Project *</span>
                <select required value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm bg-white focus:border-[#5b9c83] outline-none">
                  <option value="">Select project...</option>
                  {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.title} ({p.projectCode})</option>)}
                </select>
                {selectedTeamId && filteredProjects.length === 0 && <p className="mt-1.5 text-[11px] text-[#a3493a]">This team has no projects yet.</p>}
              </label>
            </div>
          </fieldset>

          {/* Basic Information */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Basic Information</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Paper Title *</span>
                <input required value={title} onChange={e => setTitle(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="Enter official paper title" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Authors</span>
                <input value={authors} onChange={e => setAuthors(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="Author 1, Author 2, Author 3" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Publication Year</span>
                <input type="number" min="1900" max="2100" value={publicationYear} onChange={e => setPublicationYear(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="e.g. 2024" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Paper Type</span>
                <select value={paperType} onChange={e => setPaperType(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm bg-white focus:border-[#5b9c83] outline-none">
                  {paperTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Journal / Conference Name</span>
                <input value={journalName} onChange={e => setJournalName(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Publisher</span>
                <input value={publisher} onChange={e => setPublisher(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" />
              </label>
            </div>
          </fieldset>

          {/* Identification */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Identification</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">DOI</span>
                <input value={doi} onChange={e => setDoi(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="10.1234/example" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Paper URL / Source Link *</span>
                <input required type="url" value={url} onChange={e => setUrl(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="https://..." />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">PDF Link (URL)</span>
                <input type="url" value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="https://..." />
              </label>
            </div>
          </fieldset>

          {/* Research Information */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Research Information</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Research Area</span>
                <select value={researchArea} onChange={e => setResearchArea(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm bg-white focus:border-[#5b9c83] outline-none">
                  {researchAreas.map(ra => <option key={ra} value={ra}>{ra}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Methodology</span>
                <select value={methodology} onChange={e => setMethodology(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm bg-white focus:border-[#5b9c83] outline-none">
                  <option value="">Select methodology...</option>
                  {methodologies.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Keywords</span>
                <input value={keywords} onChange={e => setKeywords(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="AI, NLP, Machine Learning" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Dataset / Sample Information</span>
                <input value={dataset} onChange={e => setDataset(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="Brief description of data source" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Abstract</span>
                <textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={4} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" placeholder="Paste the abstract here..." />
              </label>
            </div>
          </fieldset>

          {/* Publication Details */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Publication Details</legend>
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Exact Publication Date</span>
                <input type="date" value={publicationDate} onChange={e => setPublicationDate(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Volume</span>
                <input value={volume} onChange={e => setVolume(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Issue</span>
                <input value={issue} onChange={e => setIssue(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Pages</span>
                <input value={pages} onChange={e => setPages(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="e.g. 110-125" />
              </label>
            </div>
          </fieldset>

          {/* Project Information */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Project Information</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Reading Priority</span>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm bg-white focus:border-[#5b9c83] outline-none">
                  {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Expected Completion Date</span>
                <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" />
              </label>
            </div>
          </fieldset>

          {/* Additional Information */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Additional Information</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Accessibility</span>
                <select value={accessibility} onChange={e => setAccessibility(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm bg-white focus:border-[#5b9c83] outline-none">
                  <option value="Free">Free</option>
                  <option value="Subscribe">Subscribe</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Paper Image URL</span>
                <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm focus:border-[#5b9c83] outline-none" placeholder="https://..." />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium">Notes</span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" placeholder="Why is this paper important? Personal notes..." />
              </label>
            </div>
          </fieldset>

          {/* Research Questions */}
          <fieldset>
            <legend className="text-sm font-semibold mb-4 text-[#17211f] border-b border-[#edf0ee] w-full pb-2">Research Questions</legend>
            <p className="mb-4 text-xs text-[#89948f]">Answer the following questions based on your reading of the paper. These are optional at the time of adding but recommended to fill in.</p>
            <div className="grid gap-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q1. What problem do the authors address and why is it important?</span>
                <textarea value={q1} onChange={e => setQ1(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q2. What data is used (source, size, timeframe, splits, collection process, ethics or consent)?</span>
                <textarea value={q2} onChange={e => setQ2(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q3. What features or inputs are used, and how were they selected or engineered?</span>
                <textarea value={q3} onChange={e => setQ3(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q4. What methods or models are applied, and what is the overall pipeline?</span>
                <textarea value={q4} onChange={e => setQ4(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q5. What baselines are used for comparison, and why were they chosen?</span>
                <textarea value={q5} onChange={e => setQ5(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q6. How is performance evaluated (metrics, experimental setup, statistical tests, user studies if applicable)?</span>
                <textarea value={q6} onChange={e => setQ6(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q7. What are the key results with numbers, and how do they compare to baselines or prior work?</span>
                <textarea value={q7} onChange={e => setQ7(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q8. What are the limitations and potential biases?</span>
                <textarea value={q8} onChange={e => setQ8(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Q9. Is code, data, or other artifacts available to enable replication?</span>
                <textarea value={q9} onChange={e => setQ9(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm focus:border-[#5b9c83] outline-none resize-none" />
              </label>
            </div>
          </fieldset>

        </form>
      </div>

      <div className="flex justify-between items-center border-t border-[#edf0ee] p-6 shrink-0 bg-[#fbfdfc] rounded-b-2xl">
        <p className="text-xs text-[#89948f]">
          System will automatically check for duplicates upon submission.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium hover:bg-[#f4f7f5]">Cancel</button>
          <button type="submit" form="add-paper-form" disabled={saving} className="h-10 rounded-lg bg-[#176b55] px-6 text-xs font-semibold text-white disabled:opacity-60 hover:bg-[#125a47]">
            {saving ? "Checking duplicates & Adding..." : "Check Duplicate & Add Paper"}
          </button>
        </div>
      </div>
      {error && (
        <div className="px-6 pb-6 pt-0">
          <p role="alert" className="rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">{error}</p>
        </div>
      )}
    </section>
  );
}
