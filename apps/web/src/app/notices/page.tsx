"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost, type NoticeSummary, type PageMeta } from "@/lib/api-client";

interface NoticePage { data: NoticeSummary[]; meta: PageMeta }
interface NoticeForm { title: string; content: string; scope: string; priority: string; targetIds: string; requiresAcknowledgement: boolean; expiresAt: string }
const emptyForm: NoticeForm = { title: "", content: "", scope: "CENTRAL", priority: "NORMAL", targetIds: "", requiresAcknowledgement: false, expiresAt: "" };

export default function NoticesPage() {
  const [page, setPage] = useState<NoticePage | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => apiGet<NoticePage>("/notices?page=1&limit=100"), []);
  useEffect(() => { let active = true; void load().then((result) => { if (active) { setPage(result); setError(""); } }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load notices"); }); return () => { active = false; }; }, [load]);

  async function acknowledge(id: string) {
    try { await apiPost(`/notices/${id}/acknowledge`, {}); setPage(await load()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not acknowledge notice"); }
  }
  async function createNotice(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const ids = form.targetIds.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
    try {
      await apiPost("/notices", {
        title: form.title,
        content: form.content,
        scope: form.scope,
        priority: form.priority,
        requiresAcknowledgement: form.requiresAcknowledgement,
        ...(form.expiresAt ? { expiresAt: new Date(`${form.expiresAt}T23:59:59`).toISOString() } : {}),
        ...(form.scope === "TEAM" ? { teamIds: ids } : {}),
        ...(form.scope === "INDIVIDUAL" ? { userIds: ids } : {}),
      });
      setModal(false); setForm(emptyForm); setPage(await load());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create notice"); }
    finally { setSaving(false); }
  }

  return <AppShell title="Notices">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">COMMUNICATION</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">Notice center<span className="text-[#4a9279]">.</span></h1><p className="mt-2 text-sm text-[#7c8782]">Important updates, scoped to the right people.</p></div><button onClick={() => { setError(""); setModal(true); }} className="h-10 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white hover:bg-[#125a47] sm:self-auto">＋ Create notice</button></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">{error}</p>}
    <div className="mt-8 grid gap-4">{!page ? [1,2,3].map((n) => <div key={n} className="h-32 animate-pulse rounded-2xl bg-white"/>) : page.data.length === 0 ? <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfe7e2] bg-white px-6 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[#eaf4f0] text-xl text-[#4a9279]">▣</span><h2 className="mt-4 text-sm font-semibold">No notices for you</h2><p className="mt-1 text-xs text-[#89948f]">Published organization, team, and individual notices will appear here.</p></section> : page.data.map((notice) => <article key={notice.id} className="rounded-2xl border border-[#e9eeeb] bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge value={notice.priority}/><span className="rounded-full bg-[#f4f7f5] px-2.5 py-1 text-[10px] font-medium text-[#718079]">{notice.scope}</span>{notice.requiresAcknowledgement && <span className="text-[10px] text-[#9a6b20]">Acknowledgement required</span>}</div><h2 className="mt-3 text-base font-semibold">{notice.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#65716c]">{notice.content}</p></div><span className="shrink-0 text-[10px] text-[#9aa39f]">{new Date(notice.publishAt).toLocaleDateString()}</span></div><div className="mt-4 flex items-center justify-between border-t border-[#edf0ee] pt-4"><p className="text-[10px] text-[#89948f]">Posted by {notice.author.fullName}</p>{notice.requiresAcknowledgement && <button disabled={Boolean(notice.acknowledgedAt)} onClick={() => void acknowledge(notice.id)} className="h-8 rounded-lg border border-[#dce6e0] px-3 text-[11px] font-semibold text-[#176b55] disabled:bg-[#eaf4f0] disabled:text-[#4a9279]">{notice.acknowledgedAt ? "✓ Acknowledged" : "Acknowledge"}</button>}</div></article>)}</div>
    {modal && <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/35 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}><section role="dialog" aria-modal="true" aria-labelledby="notice-dialog-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a9279]">COMMUNICATION</p><h2 id="notice-dialog-title" className="mt-1 text-xl font-semibold">Create a notice</h2></div><button onClick={() => setModal(false)} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-[#f4f7f5]">×</button></div><form onSubmit={createNotice} className="mt-5 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-medium">Title</span><input required maxLength={255} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"/></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Message</span><textarea required rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm"/></label><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium">Audience</span><select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm"><option value="CENTRAL">Everyone (central)</option><option value="TEAM">Selected teams</option><option value="INDIVIDUAL">Selected people</option></select></label><label><span className="mb-1.5 block text-xs font-medium">Priority</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm"><option value="NORMAL">Normal</option><option value="IMPORTANT">Important</option><option value="URGENT">Urgent</option></select></label></div>{form.scope !== "CENTRAL" && <label className="block"><span className="mb-1.5 block text-xs font-medium">{form.scope === "TEAM" ? "Team UUIDs" : "User UUIDs"}</span><textarea required rows={2} value={form.targetIds} onChange={(e) => setForm({ ...form, targetIds: e.target.value })} placeholder="Paste UUIDs separated by commas" className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-xs"/><span className="mt-1 block text-[10px] text-[#9aa39f]">Target picker can be added after the organization directory screen is ready.</span></label>}<label className="block"><span className="mb-1.5 block text-xs font-medium">Expiry date (optional)</span><input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"/></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.requiresAcknowledgement} onChange={(e) => setForm({ ...form, requiresAcknowledgement: e.target.checked })}/>Require acknowledgement</label>{error && <p role="alert" className="text-xs text-[#a3493a]">{error}</p>}<div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4"><button type="button" onClick={() => setModal(false)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs">Cancel</button><button disabled={saving} className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white disabled:opacity-60">{saving ? "Publishing…" : "Publish notice"}</button></div></form></section></div>}
  </AppShell>;
}
