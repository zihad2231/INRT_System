"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  authApi,
  type PageMeta,
  type TaskSummary,
} from "@/lib/api-client";

interface TaskItem extends Omit<TaskSummary, "project" | "team"> {
  description?: string | null;
  assignees?: Array<{ user: { id: string; memberCode: string; fullName: string } }>;
  team?: { id: string; teamCode: string; name: string } | null;
  project?: { id: string; projectCode: string; title: string } | null;
}

interface ProjectOption {
  id: string;
  projectCode: string;
  title: string;
}

interface TeamOption {
  id: string;
  teamCode: string;
  name: string;
}

interface UserOption {
  id: string;
  memberCode: string;
  fullName: string;
  email: string;
}

interface TaskForm {
  id?: string;
  taskCode: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  projectId: string;
  teamId: string;
  assigneeIds: string[];
}

const blankForm: TaskForm = {
  taskCode: "",
  title: "",
  description: "",
  priority: "MEDIUM",
  status: "TODO",
  dueDate: "",
  projectId: "",
  teamId: "",
  assigneeIds: [],
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<{ data: TaskItem[]; meta: PageMeta } | null>(null);
  const [todos, setTodos] = useState<{
    data: Array<{ id: string; title: string; status: string; priority: string; dueDate: string | null; user: { fullName: string } | null }>;
    meta: PageMeta;
  } | null>(null);
  const [user, setUser] = useState<{ roles: string[]; permissions: string[] } | null>(null);

  // Dropdown reference options
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [members, setMembers] = useState<UserOption[]>([]);

  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<TaskForm>(blankForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const query = new URLSearchParams({ page: "1", limit: "100" });
    if (filter) query.set("status", filter);

    return Promise.all([
      apiGet<{ data: TaskItem[]; meta: PageMeta }>(`/tasks?${query}`),
      apiGet<typeof todos>("/todos?page=1&limit=100"),
      authApi.me().then((res) => res.user),
      apiGet<{ data: ProjectOption[] }>("/projects?limit=100").catch(() => ({ data: [] })),
      apiGet<{ data: TeamOption[] }>("/teams?limit=100").catch(() => ({ data: [] })),
      apiGet<{ data: UserOption[] }>("/users?limit=100").catch(() => ({ data: [] })),
    ]);
  }, [filter]);

  useEffect(() => {
    let alive = true;
    void loadData()
      .then(([taskRes, todoRes, userRes, projRes, teamRes, userListRes]) => {
        if (alive) {
          setTasks(taskRes);
          setTodos(todoRes);
          setUser(userRes);
          setProjects(projRes.data ?? []);
          setTeams(teamRes.data ?? []);
          setMembers(userListRes.data ?? []);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "Could not load tasks");
      });
    return () => {
      alive = false;
    };
  }, [loadData]);

  const isAdmin = user?.roles?.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r)) || user?.permissions?.includes("TASK_MANAGE");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      taskCode: form.taskCode,
      title: form.title,
      description: form.description ? form.description : undefined,
      priority: form.priority,
      status: form.status,
      dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:59`).toISOString() : undefined,
      projectId: form.projectId || undefined,
      teamId: form.teamId || undefined,
      assigneeIds: form.assigneeIds.length > 0 ? form.assigneeIds : undefined,
    };

    try {
      if (isEditing && form.id) {
        await apiPatch(`/tasks/${form.id}`, payload);
      } else {
        await apiPost("/tasks", payload);
      }
      setForm(blankForm);
      setModal(false);
      setIsEditing(false);
      const [taskRes, todoRes] = await loadData();
      setTasks(taskRes);
      setTodos(todoRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenEdit(task: TaskItem) {
    setError("");
    setIsEditing(true);
    setForm({
      id: task.id,
      taskCode: task.taskCode,
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      projectId: task.project?.id || "",
      teamId: task.team?.id || "",
      assigneeIds: task.assignees ? task.assignees.map((a) => a.user.id) : [],
    });
    setModal(true);
  }

  async function handleDeleteTask(taskId: string, title: string) {
    if (!confirm(`Are you sure you want to delete task '${title}'?`)) return;
    setError("");
    try {
      await apiDelete(`/tasks/${taskId}`);
      const [taskRes, todoRes] = await loadData();
      setTasks(taskRes);
      setTodos(todoRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete task");
    }
  }

  async function changeStatus(task: TaskItem, status: string) {
    setError("");
    try {
      await apiPatch(`/tasks/${task.id}/status`, { status });
      const [taskRes, todoRes] = await loadData();
      setTasks(taskRes);
      setTodos(todoRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update task status");
    }
  }

  async function completeTodo(todoId: string) {
    try {
      await apiPatch(`/todos/${todoId}/status`, { status: "COMPLETED" });
      const [taskRes, todoRes] = await loadData();
      setTasks(taskRes);
      setTodos(todoRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update to-do");
    }
  }

  return (
    <AppShell title="Tasks & to-dos">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#176b55]">
            PRODUCTIVITY & GOVERNANCE
          </p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">
            Tasks & to-dos<span className="text-[#176b55]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#7c8782]">
            Keep assignments, deadlines, team responsibilities, and actions aligned.
          </p>
        </div>
        {(user?.permissions.includes("TASK_CREATE") || isAdmin) && (
          <button
            onClick={() => {
              setError("");
              setIsEditing(false);
              setForm(blankForm);
              setModal(true);
            }}
            className="h-10 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white hover:bg-[#125a47] sm:self-auto"
          >
            ＋ New task
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ee] p-5">
            <div>
              <h2 className="text-sm font-semibold">Assigned tasks</h2>
              <p className="mt-1 text-[11px] text-[#89948f]">{tasks ? `${tasks.meta.total} visible` : "Loading…"}</p>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter tasks by status"
              className="h-9 rounded-lg border border-[#e5eae7] bg-white px-3 text-xs"
            >
              <option value="">All statuses</option>
              {["TODO", "IN_PROGRESS", "REVIEW", "REVISION_REQUIRED", "BLOCKED", "COMPLETED", "CANCELLED"].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {!tasks ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 animate-pulse rounded-xl bg-[#f7f9f8]" />
              ))}
            </div>
          ) : tasks.data.length === 0 ? (
            <p className="px-6 py-14 text-center text-xs text-[#89948f]">No tasks match this filter.</p>
          ) : (
            <div className="divide-y divide-[#edf0ee]">
              {tasks.data.map((task) => {
                const assigneeNames =
                  task.assignees && task.assignees.length > 0
                    ? task.assignees.map((a) => a.user.fullName).join(", ")
                    : "Unassigned";

                return (
                  <div key={task.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-[#89948f]">{task.taskCode}</span>
                        <StatusBadge value={task.priority} />
                      </div>
                      <h3 className="mt-1 truncate text-sm font-semibold">{task.title}</h3>
                      {task.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-[#65716c]">{task.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#89948f]">
                        <span>👤 {assigneeNames}</span>
                        {task.team && <span>👥 {task.team.name}</span>}
                        {task.project && <span>◫ {task.project.title}</span>}
                        {task.dueDate && <span>📅 Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <StatusBadge value={task.status} />
                      {!["COMPLETED", "CANCELLED"].includes(task.status) && (
                        <select
                          value={task.status}
                          onChange={(e) => void changeStatus(task, e.target.value)}
                          aria-label={`Update ${task.title} status`}
                          className="h-8 rounded-lg border border-[#e5eae7] bg-white px-2 text-[10px]"
                        >
                          <option value={task.status}>{task.status.replaceAll("_", " ")}</option>
                          {["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "COMPLETED"]
                            .filter((s) => s !== task.status)
                            .map((s) => (
                              <option key={s} value={s}>
                                {s.replaceAll("_", " ")}
                              </option>
                            ))}
                        </select>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(task)}
                            className="rounded-lg border border-[#e2e9e5] p-1.5 text-xs text-[#50615a] hover:bg-[#f5f8f6]"
                            title="Edit Task"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id, task.title)}
                            className="rounded-lg border border-[#f0d6d1] p-1.5 text-xs text-[#a3493a] hover:bg-[#fff7f5]"
                            title="Delete Task"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* To-dos */}
        <section className="rounded-2xl border border-[#e9eeeb] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Personal to-dos</h2>
              <p className="mt-1 text-[11px] text-[#89948f]">Small actions to remember</p>
            </div>
            <span className="grid size-9 place-items-center rounded-xl bg-[#fbf3e8] text-[#c28a42]">✓</span>
          </div>
          {!todos ? (
            <div className="mt-5 h-24 animate-pulse rounded-xl bg-[#f7f9f8]" />
          ) : todos.data.length === 0 ? (
            <p className="mt-5 rounded-xl bg-[#fbfcfb] px-4 py-8 text-center text-xs text-[#89948f]">
              No to-dos right now.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#edf0ee]">
              {todos.data.map((todo) => (
                <li key={todo.id} className="flex items-start gap-3 py-3">
                  <button
                    onClick={() => void completeTodo(todo.id)}
                    disabled={todo.status === "COMPLETED"}
                    aria-label={`Complete ${todo.title}`}
                    className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${
                      todo.status === "COMPLETED"
                        ? "border-[#176b55] bg-[#176b55] text-white"
                        : "border-[#cbd6d0] hover:border-[#176b55]"
                    }`}
                  >
                    {todo.status === "COMPLETED" ? "✓" : ""}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${todo.status === "COMPLETED" ? "text-[#9aa39f] line-through" : ""}`}>
                      {todo.title}
                    </p>
                    <p className="mt-1 text-[10px] text-[#9aa39f]">
                      {todo.user?.fullName ?? "Team to-do"}
                      {todo.dueDate ? ` · ${new Date(todo.dueDate).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Task Creation & Editing Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/35 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#176b55]">
                  WORK ITEM GOVERNANCE
                </p>
                <h2 className="mt-1 text-xl font-semibold">{isEditing ? "Edit Task" : "Create a Task"}</h2>
              </div>
              <button onClick={() => setModal(false)} className="grid size-8 place-items-center rounded-lg hover:bg-[#f4f7f5]">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Task code</span>
                <input
                  required
                  value={form.taskCode}
                  onChange={(e) => setForm({ ...form, taskCode: e.target.value })}
                  placeholder="TSK-001"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Title</span>
                <input
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Dataset cleaning / Feature extraction"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Description</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm"
                  >
                    {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">Due date</span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm"
                  />
                </label>
              </div>

              {/* Section 13, 14: Select Project, Team, and Assignees cleanly (No raw UUIDs!) */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">Select Project (Optional)</span>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs"
                  >
                    <option value="">-- No project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">Select Team (Optional)</span>
                  <select
                    value={form.teamId}
                    onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs"
                  >
                    <option value="">-- No team --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.teamCode})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Assign Member</span>
                <select
                  value={form.assigneeIds[0] || ""}
                  onChange={(e) => setForm({ ...form, assigneeIds: e.target.value ? [e.target.value] : [] })}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs"
                >
                  <option value="">-- Select member assignee --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.memberCode}) — {m.email}
                    </option>
                  ))}
                </select>
              </label>

              {error && <p role="alert" className="text-xs text-[#a3493a]">{error}</p>}

              <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : isEditing ? "Update task" : "Create task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}
