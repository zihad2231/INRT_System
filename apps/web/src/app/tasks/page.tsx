"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { authApi, apiGet, apiPatch, apiPost, type PageMeta, type TaskSummary } from "@/lib/api-client";

interface TaskPage { data: TaskSummary[]; meta: PageMeta }
interface TaskForm { taskCode: string; title: string; description: string; priority: string; dueDate: string; projectId: string; teamId: string }
const blank: TaskForm = { taskCode: "", title: "", description: "", priority: "MEDIUM", dueDate: "", projectId: "", teamId: "" };

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskPage | null>(null);
  const [todos, setTodos] = useState<{ data: Array<{ id: string; title: string; status: string; priority: string; dueDate: string | null; user: { fullName: string } | null }>; meta: PageMeta } | null>(null);
  const [user, setUser] = useState<{ permissions: string[] } | null>(null);
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: "1", limit: "100" });
    if (filter) query.set("status", filter);
    return Promise.all([
      apiGet<TaskPage>(`/tasks?${query}`),
      apiGet<typeof todos>("/todos?page=1&limit=100"),
      authApi.me().then(res => res.user)
    ]);
  }, [filter]);

  useEffect(() => {
    let alive = true;
    void load().then(([taskResult, todoResult, userResult]) => { if (alive) { setTasks(taskResult); setTodos(todoResult); setUser(userResult); } }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Could not load tasks"); });
    return () => { alive = false; };
  }, [load]);

  async function createTask(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await apiPost("/tasks", {
        taskCode: form.taskCode,
        title: form.title,
        ...(form.description ? { description: form.description } : {}),
        priority: form.priority,
        ...(form.dueDate ? { dueDate: new Date(`${form.dueDate}T23:59:59`).toISOString() } : {}),
        ...(form.projectId ? { projectId: form.projectId } : {}),
        ...(form.teamId ? { teamId: form.teamId } : {}),
      });
      setForm(blank); setModal(false); const [taskResult, todoResult] = await load(); setTasks(taskResult); setTodos(todoResult);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create task"); }
    finally { setSaving(false); }
  }

  async function changeStatus(task: TaskSummary, status: string) {
    setError("");
    try { await apiPatch(`/tasks/${task.id}/status`, { status }); const [taskResult, todoResult] = await load(); setTasks(taskResult); setTodos(todoResult); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update task"); }
  }

  async function completeTodo(todoId: string) {
    try { await apiPatch(`/todos/${todoId}/status`, { status: "COMPLETED" }); const [taskResult, todoResult] = await load(); setTasks(taskResult); setTodos(todoResult); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update to-do"); }
  }

  return <AppShell title="Tasks & to-dos">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">PRODUCTIVITY</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">Tasks & to-dos<span className="text-[#4a9279]">.</span></h1><p className="mt-2 text-sm text-[#7c8782]">Keep assignments, deadlines, and small actions moving.</p></div>{user?.permissions.includes("TASK_CREATE") && <button onClick={() => { setError(""); setModal(true); }} className="h-10 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white hover:bg-[#125a47] sm:self-auto">＋ New task</button>}</div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">{error}</p>}
    <div className="mt-8 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <section className="overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ee] p-5"><div><h2 className="text-sm font-semibold">Assigned tasks</h2><p className="mt-1 text-[11px] text-[#89948f]">{tasks ? `${tasks.meta.total} visible` : "Loading…"}</p></div><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tasks by status" className="h-9 rounded-lg border border-[#e5eae7] bg-white px-3 text-xs"><option value="">All statuses</option>{["TODO", "IN_PROGRESS", "REVIEW", "REVISION_REQUIRED", "BLOCKED", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></div>
        {!tasks ? <div className="space-y-3 p-5">{[1,2,3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-[#f7f9f8]"/>)}</div> : tasks.data.length === 0 ? <p className="px-6 py-14 text-center text-xs text-[#89948f]">No tasks match this filter.</p> : <div className="divide-y divide-[#edf0ee]">{tasks.data.map((task) => <div key={task.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold text-[#89948f]">{task.taskCode}</span><StatusBadge value={task.priority}/></div><h3 className="mt-1 truncate text-sm font-semibold">{task.title}</h3><p className="mt-1 text-[11px] text-[#89948f]">{task.project?.title ?? task.team?.name ?? "Organization task"}{task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ""}</p></div><div className="flex items-center gap-3"><StatusBadge value={task.status}/>{!["COMPLETED", "CANCELLED"].includes(task.status) && <select value={task.status} onChange={(e) => void changeStatus(task, e.target.value)} aria-label={`Update ${task.title} status`} className="h-8 rounded-lg border border-[#e5eae7] bg-white px-2 text-[10px]"><option value={task.status}>{task.status.replaceAll("_", " ")}</option>{["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "COMPLETED"].filter((s) => s !== task.status).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select>}</div></div>)}</div>}
      </section>
      <section className="rounded-2xl border border-[#e9eeeb] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Personal to-dos</h2><p className="mt-1 text-[11px] text-[#89948f]">Small actions to remember</p></div><span className="grid size-9 place-items-center rounded-xl bg-[#fbf3e8] text-[#c28a42]">✓</span></div>{!todos ? <div className="mt-5 h-24 animate-pulse rounded-xl bg-[#f7f9f8]"/> : todos.data.length === 0 ? <p className="mt-5 rounded-xl bg-[#fbfcfb] px-4 py-8 text-center text-xs text-[#89948f]">No to-dos right now.</p> : <ul className="mt-4 divide-y divide-[#edf0ee]">{todos.data.map((todo) => <li key={todo.id} className="flex items-start gap-3 py-3"><button onClick={() => void completeTodo(todo.id)} disabled={todo.status === "COMPLETED"} aria-label={`Complete ${todo.title}`} className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${todo.status === "COMPLETED" ? "border-[#4a9279] bg-[#4a9279] text-white" : "border-[#cbd6d0] hover:border-[#4a9279]"}`}>{todo.status === "COMPLETED" ? "✓" : ""}</button><div className="min-w-0"><p className={`text-xs font-medium ${todo.status === "COMPLETED" ? "text-[#9aa39f] line-through" : ""}`}>{todo.title}</p><p className="mt-1 text-[10px] text-[#9aa39f]">{todo.user?.fullName ?? "Team to-do"}{todo.dueDate ? ` · ${new Date(todo.dueDate).toLocaleDateString()}` : ""}</p></div></li>)}</ul>}</section>
    </div>
    {modal && <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/35 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}><section role="dialog" aria-modal="true" aria-labelledby="new-task-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a9279]">WORK ITEM</p><h2 id="new-task-title" className="mt-1 text-xl font-semibold">Create a task</h2></div><button onClick={() => setModal(false)} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-[#f4f7f5]">×</button></div><form onSubmit={createTask} className="mt-5 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-medium">Task code</span><input required value={form.taskCode} onChange={(e) => setForm({ ...form, taskCode: e.target.value })} placeholder="TASK-001" className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"/></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Title</span><input required maxLength={255} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"/></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Description</span><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-medium">Priority</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm">{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p}>{p}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Due date</span><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"/></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-medium">Project UUID (optional)</span><input value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="Select project ID" className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-xs"/></label><label className="block"><span className="mb-1.5 block text-xs font-medium">Team UUID (optional)</span><input value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} placeholder="Select team ID" className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-xs"/></label></div>{error && <p role="alert" className="text-xs text-[#a3493a]">{error}</p>}<div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4"><button type="button" onClick={() => setModal(false)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs">Cancel</button><button disabled={saving} className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Create task"}</button></div></form></section></div>}
  </AppShell>;
}
