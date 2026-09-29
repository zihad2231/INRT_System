"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost, type ProjectSummary } from "@/lib/api-client";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const [canManage, setCanManage] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<Array<{ id: string; name: string; teamCode?: string }>>([]);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamActionLoading, setTeamActionLoading] = useState(false);
  const [teamActionMsg, setTeamActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const data = await apiGet<ProjectSummary>(`/projects/${params.id}`);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project load failed");
    }
  }, [params.id]);

  useEffect(() => {
    let active = true;
    void loadProject();

    apiGet<{ data: any[] }>("/teams?page=1&limit=100")
      .then((res) => {
        if (active && res.data) setAvailableTeams(res.data);
      })
      .catch(console.error);

    apiGet<any>("/auth/me")
      .then((res) => {
        if (active && res.user?.roles) {
          setCanManage(res.user.roles.some((r: string) => ["SUPER_ADMIN", "ADMIN"].includes(r)));
        }
      })
      .catch(console.error);

    return () => {
      active = false;
    };
  }, [loadProject]);

  async function handleExport() {
    if (!project) return;
    setExporting(true);
    setExportMsg("");
    try {
      const res = await apiPost<any>("/exports", {
        jobType: "PROJECT_EXPORT",
        parameters: { projectId: project.id },
      });
      if (res.fileUrl) {
        const link = document.createElement("a");
        link.href = res.fileUrl;
        link.download = `${project.projectCode}-Tracker.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setExportMsg("Export downloaded successfully.");
      } else {
        setExportMsg("Export finished, but no file was returned.");
      }
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "Failed to generate export");
    } finally {
      setExporting(false);
    }
  }

  async function handleAddTeam() {
    if (!project || !selectedTeamId) return;
    setTeamActionLoading(true);
    setTeamActionMsg(null);
    try {
      await apiPost(`/projects/${project.id}/teams`, { teamIds: [selectedTeamId] });
      setTeamActionMsg({ type: "success", text: "Team assigned successfully." });
      setShowAddTeamModal(false);
      setSelectedTeamId("");
      await loadProject();
    } catch (err) {
      setTeamActionMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to assign team" });
    } finally {
      setTeamActionLoading(false);
    }
  }

  async function handleRemoveTeam(teamId: string, teamName: string) {
    if (!project) return;
    if (!confirm(`Are you sure you want to remove team "${teamName}" from this project?`)) return;
    setTeamActionLoading(true);
    setTeamActionMsg(null);
    try {
      await apiPost(`/projects/${project.id}/teams/remove`, { teamIds: [teamId] });
      setTeamActionMsg({ type: "success", text: `Team "${teamName}" removed from project.` });
      await loadProject();
    } catch (err) {
      setTeamActionMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to remove team" });
    } finally {
      setTeamActionLoading(false);
    }
  }

  return (
    <AppShell title="Project details">
      <Link href="/projects" className="text-xs font-medium text-[#4a9279] hover:text-[#176b55]">
        ← Back to projects
      </Link>
      {!project && !error && <div className="mt-6 h-56 animate-pulse rounded-2xl bg-white" />}
      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">
          {error}
        </div>
      )}
      {exportMsg && (
        <div role="alert" className="mt-5 rounded-xl border border-[#d6f0e2] bg-[#f5fff9] px-4 py-3 text-xs text-[#2c7a52]">
          {exportMsg}
        </div>
      )}
      {teamActionMsg && (
        <div
          role="alert"
          className={`mt-4 rounded-xl border px-4 py-3 text-xs ${
            teamActionMsg.type === "success"
              ? "border-[#d6f0e2] bg-[#f5fff9] text-[#2c7a52]"
              : "border-[#f0d6d1] bg-[#fff7f5] text-[#a3493a]"
          }`}
        >
          {teamActionMsg.text}
        </div>
      )}

      {project && (
        <>
          {/* Main Info Card */}
          <div className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-wide text-[#89948f]">{project.projectCode}</span>
                  <StatusBadge value={project.status} />
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{project.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#718079]">
                  {project.description || "No project description has been added."}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex h-9 items-center rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white hover:bg-[#125a47] disabled:opacity-50"
                >
                  {exporting ? "Generating Excel…" : "↓ Export Tracker (Excel)"}
                </button>
                <div className="rounded-xl bg-[#f5f8f6] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#89948f]">Project owner</p>
                  <p className="mt-1 text-xs font-semibold">{project.owner?.fullName ?? "Not assigned"}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 border-t border-[#edf0ee] pt-6 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Start date</p>
                <p className="mt-1 text-sm font-medium">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Target date</p>
                <p className="mt-1 text-sm font-medium">
                  {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Progress</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8eeea]">
                    <div
                      className="h-full rounded-full bg-[#55a284]"
                      style={{ width: `${Math.min(Number(project.progressPercent), 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold">{Number(project.progressPercent)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { title: "Research papers", count: project._count.papers, href: `/projects/${project.id}/papers`, icon: "▤" },
              { title: "Project members", count: project._count.members, href: "#members", icon: "♙" },
              { title: "Tasks & assignments", count: project._count.assignments, href: "/tasks", icon: "✓" },
            ].map((item) => (
              <Link
                href={item.href}
                key={item.title}
                className="rounded-2xl border border-[#e9eeeb] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#718079]">{item.title}</span>
                  <span className="grid size-9 place-items-center rounded-xl bg-[#eaf4f0] text-sm text-[#39886d]">
                    {item.icon}
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight">{item.count}</p>
                <p className="mt-1 text-[10px] text-[#9aa39f]">View project data →</p>
              </Link>
            ))}
          </div>

          {/* Teams on this project Section */}
          <section className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ee] pb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Teams Assigned to Project</h2>
                <p className="mt-0.5 text-xs text-[#89948f]">
                  Teams working on this project with their leader and member details
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(true)}
                  className="rounded-lg bg-[#176b55] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#125a47] transition"
                >
                  + Assign Team
                </button>
              )}
            </div>

            {project.teams && project.teams.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {project.teams.map(({ team }) => {
                  const memberCount = team.members?.length ?? team._count?.members ?? 0;
                  return (
                    <div
                      key={team.id}
                      className="flex flex-col justify-between rounded-xl border border-[#e5eae7] bg-[#fbfdfc] p-4 transition hover:border-[#b4d4c8]"
                    >
                      <div>
                        {/* Team header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/teams/${team.id}`}
                              className="font-semibold text-sm text-[#1b4332] hover:underline"
                            >
                              {team.name}
                            </Link>
                            <span className="ml-2 inline-block rounded bg-[#e8eeea] px-1.5 py-0.5 text-[10px] font-medium text-[#50635b]">
                              {team.teamCode}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#e8f5ed] px-2.5 py-0.5 text-[11px] font-semibold text-[#1b7a54]">
                              {memberCount} {memberCount === 1 ? "member" : "members"}
                            </span>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTeam(team.id, team.name)}
                                disabled={teamActionLoading}
                                title="Remove team from this project"
                                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Team Leader */}
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white p-2.5 border border-[#eef2f0]">
                          <div className="grid size-7 place-items-center rounded-full bg-[#1b4332] text-xs font-bold text-white uppercase">
                            {team.teamLeader?.fullName ? team.teamLeader.fullName.charAt(0) : "★"}
                          </div>
                          <div className="text-xs leading-snug min-w-0">
                            <p className="font-semibold text-gray-800 truncate">
                              {team.teamLeader?.fullName || "No Team Leader Assigned"}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {team.teamLeader?.email ? `Leader • ${team.teamLeader.email}` : "Leader not set"}
                            </p>
                          </div>
                        </div>

                        {/* Members List */}
                        <div className="mt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#798881]">
                            Team Members ({memberCount})
                          </p>
                          {team.members && team.members.length > 0 ? (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {team.members.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 border border-[#edf0ee]"
                                >
                                  <div className="grid size-6 shrink-0 place-items-center rounded-full bg-[#e2ede8] text-[10px] font-semibold text-[#255e4b] uppercase">
                                    {m.user?.fullName ? m.user.fullName.charAt(0) : "U"}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-gray-800">
                                      {m.user?.fullName ?? "Unknown Member"}
                                    </p>
                                    <p className="truncate text-[10px] text-gray-500">
                                      {m.user?.email}
                                    </p>
                                  </div>
                                  {m.membershipRole === "LEADER" && (
                                    <span className="shrink-0 rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[9px] font-semibold text-amber-700">
                                      Leader
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-[#9aa39f] italic">No active members in this team.</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-[#edf0ee] text-right">
                        <Link
                          href={`/teams/${team.id}`}
                          className="text-[11px] font-medium text-[#2d7d62] hover:text-[#176b55] hover:underline"
                        >
                          View full team profile →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#d8e0dc] p-6 text-center">
                <p className="text-xs text-[#89948f]">No teams have been assigned to this project yet.</p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAddTeamModal(true)}
                    className="mt-3 inline-flex items-center rounded-lg bg-[#eaf4f0] px-3.5 py-1.5 text-xs font-semibold text-[#27745c] hover:bg-[#d6ebe3]"
                  >
                    + Assign Team Now
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Project Direct Members Section */}
          <section id="members" className="mt-5 rounded-2xl border border-[#e9eeeb] bg-white p-6">
            <div className="border-b border-[#edf0ee] pb-4">
              <h2 className="text-base font-semibold text-gray-900">
                All Project Members ({project.members?.length ?? project._count.members})
              </h2>
              <p className="mt-0.5 text-xs text-[#89948f]">
                All researchers and staff contributing to this project
              </p>
            </div>

            {project.members && project.members.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {project.members.map((pm: any) => (
                  <div
                    key={pm.id}
                    className="flex items-center gap-3 rounded-xl border border-[#edf0ee] bg-[#fafcfb] p-3 transition hover:border-[#b4d4c8]"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1b4332] text-xs font-bold text-white uppercase">
                      {pm.user?.fullName ? pm.user.fullName.charAt(0) : "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-gray-900">{pm.user?.fullName}</p>
                      <p className="truncate text-[11px] text-gray-500">{pm.user?.email}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-[#718079] font-mono">{pm.user?.memberCode}</span>
                        {pm.membershipRole && (
                          <span className="rounded bg-[#e8eeea] px-1.5 py-0.2 text-[9px] font-medium text-[#50635b]">
                            {pm.membershipRole}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#89948f]">
                No members found directly on this project. Assign a team above to populate members.
              </p>
            )}
          </section>
        </>
      )}

      {/* Modal: Assign Team */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Assign Team to Project</h3>
            <p className="mt-1 text-xs text-gray-500">
              Select a team to assign. All active members of the team will be added to this project.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700">Choose Team</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#176b55] focus:outline-none"
              >
                <option value="">-- Select a Team --</option>
                {availableTeams
                  .filter((t) => !project?.teams.some((pt) => pt.team.id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.teamCode ? `(${t.teamCode})` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddTeamModal(false);
                  setSelectedTeamId("");
                }}
                className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTeam}
                disabled={!selectedTeamId || teamActionLoading}
                className="rounded-lg bg-[#176b55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125a47] disabled:opacity-50"
              >
                {teamActionLoading ? "Assigning…" : "Assign Team"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
