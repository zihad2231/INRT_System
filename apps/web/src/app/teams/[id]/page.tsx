"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost, authApi } from "@/lib/api-client";

interface TeamMemberRecord {
  id: string;
  userId: string;
  membershipRole: string | null;
  isActive: boolean;
  joinedAt: string | null;
  user: {
    id: string;
    memberCode: string;
    fullName: string;
    email: string;
    phone: string | null;
    profileImageUrl: string | null;
  };
}

interface TeamProjectRecord {
  project: {
    id: string;
    projectCode: string;
    title: string;
    status: string;
  };
}

interface TeamDetails {
  id: string;
  teamCode: string;
  name: string;
  description: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: string;
  teamLeader: { id: string; memberCode: string; fullName: string; email: string } | null;
  _count: { members: number; projects: number };
  members: TeamMemberRecord[];
  projects?: TeamProjectRecord[];
}

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [searchMember, setSearchMember] = useState("");

  // Add Member Modal State
  const [addModal, setAddModal] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; fullName: string; email: string }>>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState("");

  // Remove Member Modal State
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [savingRemove, setSavingRemove] = useState(false);
  const [removeError, setRemoveError] = useState("");

  // Delete Team Modal State
  const [deleteModal, setDeleteModal] = useState(false);
  const [savingDelete, setSavingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Confirmation Text for Delete/Remove
  const [confirmText, setConfirmText] = useState("");

  // Assign Leader Modal State
  const [leaderModal, setLeaderModal] = useState(false);
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [savingLeader, setSavingLeader] = useState(false);
  const [leaderError, setLeaderError] = useState("");

  const loadTeam = useCallback(async () => {
    if (!params.id) return;
    try {
      const data = await apiGet<any>(`/teams/${params.id}`);
      const payload = data?.data ?? data;
      setTeam(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team details");
    }
  }, [params.id]);

  useEffect(() => {
    let active = true;
    void loadTeam();

    authApi
      .me()
      .then(({ user }) => {
        if (active) {
          setCanManage(user.roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r)));
        }
      })
      .catch(console.error);

    apiGet<{ data: Array<{ id: string; fullName: string; email: string }> }>("/users?page=1&limit=100")
      .then((res) => {
        if (active) setUsers(res?.data || []);
      })
      .catch(console.error);

    return () => {
      active = false;
    };
  }, [loadTeam]);

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser || !team) return;
    setSavingAdd(true);
    setAddError("");
    try {
      await apiPost(`/teams/${team.id}/members`, { memberIds: [selectedUser] });
      setAddModal(false);
      setSelectedUser("");
      await loadTeam();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSavingAdd(false);
    }
  }

  async function handleRemoveMember(e: FormEvent) {
    e.preventDefault();
    if (!removeUserId || !team) return;
    if (confirmText.trim().toLowerCase() !== "confirm") {
      setRemoveError("Please type 'confirm' to confirm.");
      return;
    }
    setSavingRemove(true);
    setRemoveError("");
    try {
      await apiPost(`/teams/${team.id}/members/remove`, {
        memberIds: [removeUserId],
      });
      setRemoveUserId(null);
      setConfirmText("");
      await loadTeam();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setSavingRemove(false);
    }
  }

  async function handleDeleteTeam(e: FormEvent) {
    e.preventDefault();
    if (!team) return;
    if (confirmText.trim().toLowerCase() !== "confirm") {
      setDeleteError("Please type 'confirm' to confirm.");
      return;
    }
    setSavingDelete(true);
    setDeleteError("");
    try {
      await apiPost(`/teams/${team.id}/delete`, {});
      router.push("/teams");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setSavingDelete(false);
    }
  }

  async function handleAssignLeader(leaderId: string | null) {
    if (!team) return;
    setSavingLeader(true);
    setLeaderError("");
    try {
      await apiPost(`/teams/${team.id}/leader`, { leaderId });
      setLeaderModal(false);
      setSelectedLeaderId("");
      await loadTeam();
    } catch (err) {
      setLeaderError(err instanceof Error ? err.message : "Failed to update team leader");
    } finally {
      setSavingLeader(false);
    }
  }

  const membersList = (team?.members || (team as any)?.data?.members || []) as TeamMemberRecord[];
  const existingMemberIds = new Set(membersList.map((m) => m.userId || m.user?.id));
  const availableUsersToAdd = users.filter((u) => !existingMemberIds.has(u.id));

  const filteredMembers =
    membersList.filter((m) => {
      const q = searchMember.toLowerCase();
      const name = m.user?.fullName?.toLowerCase() || "";
      const email = m.user?.email?.toLowerCase() || "";
      const code = m.user?.memberCode?.toLowerCase() || "";
      return name.includes(q) || email.includes(q) || code.includes(q);
    });

  return (
    <AppShell title="Team details">
      <div className="space-y-6 max-w-5xl pb-12">
        <Link href="/teams" className="inline-flex items-center text-xs font-medium text-[#4a9279] hover:text-[#176b55]">
          ← Back to teams
        </Link>

        {error && (
          <div role="alert" className="rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">
            {error}
          </div>
        )}

        {!team && !error && (
          <div className="space-y-4 animate-pulse">
            <div className="h-44 rounded-2xl bg-white border border-[#e9eeeb]" />
            <div className="h-64 rounded-2xl bg-white border border-[#e9eeeb]" />
          </div>
        )}

        {team && (
          <>
            {/* Team Overview Card */}
            <div className="rounded-2xl border border-[#e9eeeb] bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-wide text-[#89948f] font-mono">{team.teamCode}</span>
                    <StatusBadge value={team.status} />
                  </div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{team.name}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718079]">
                    {team.description || "No description provided for this team."}
                  </p>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
                  <div className="rounded-xl bg-[#f5f8f6] px-4 py-3 border border-[#edf3ef] min-w-[200px]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase font-semibold tracking-wider text-[#89948f]">Team Leader</p>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeaderId(team.teamLeader?.id || "");
                            setLeaderError("");
                            setLeaderModal(true);
                          }}
                          className="text-[11px] font-semibold text-[#176b55] hover:underline"
                        >
                          {team.teamLeader ? "Change" : "Assign"}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{team.teamLeader?.fullName ?? "Not assigned"}</p>
                    {team.teamLeader?.email && <p className="text-[10px] text-[#89948f]">{team.teamLeader.email}</p>}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => {
                        setConfirmText("");
                        setDeleteError("");
                        setDeleteModal(true);
                      }}
                      className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                    >
                      Delete Team
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-8 grid gap-4 border-t border-[#edf0ee] pt-6 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Start Date</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {team.startDate ? new Date(team.startDate).toLocaleDateString() : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Target Date</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {team.targetDate ? new Date(team.targetDate).toLocaleDateString() : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#9aa39f]">Total Members</p>
                  <p className="mt-1 text-sm font-semibold text-[#176b55]">{membersList.length} members</p>
                </div>
              </div>
            </div>

            {/* Team Members Section */}
            <section className="rounded-2xl border border-[#e9eeeb] bg-white shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#edf0ee] p-5 sm:p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Team Members</h2>
                    <span className="rounded-full bg-[#eef7f3] px-2.5 py-0.5 text-xs font-semibold text-[#176b55]">
                      {membersList.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#89948f]">Active researchers and contributors assigned to this team.</p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Search members..."
                    className="h-9 w-44 sm:w-56 rounded-lg border border-[#e5eae7] px-3 text-xs outline-none focus:border-[#5b9c83]"
                  />
                  {canManage && (
                    <button
                      onClick={() => {
                        setAddError("");
                        setSelectedUser("");
                        setAddModal(true);
                      }}
                      className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] shrink-0"
                    >
                      ＋ Add Member
                    </button>
                  )}
                </div>
              </div>

              {membersList.length === 0 ? (
                <div className="p-12 text-center">
                  <span className="grid size-12 place-items-center mx-auto rounded-full bg-[#f4f7f5] text-lg text-[#89948f]">
                    👥
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-slate-800">No members assigned yet</h3>
                  <p className="mt-1 text-xs text-[#89948f]">
                    Add members from your organization to collaborate on this team.
                  </p>
                  {canManage && (
                    <button
                      onClick={() => setAddModal(true)}
                      className="mt-4 rounded-lg bg-[#176b55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125a47]"
                    >
                      Add First Member
                    </button>
                  )}
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#89948f]">
                  No members matched your search "{searchMember}".
                </div>
              ) : (
                <div className="divide-y divide-[#edf0ee]">
                  {filteredMembers.map((record) => {
                    const u = record.user;
                    const isLeader = team.teamLeader?.id === u?.id;
                    const uid = record.userId || u?.id;
                    return (
                      <article key={record.id || uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {u?.profileImageUrl ? (
                            <img src={u.profileImageUrl} alt="" className="size-11 shrink-0 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eaf4f0] text-xs font-bold text-[#176b55]">
                              {u?.fullName
                                ? u.fullName
                                    .split(/\s+/)
                                    .slice(0, 2)
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                : "U"}
                            </span>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-800 truncate">{u?.fullName || "Member"}</h3>
                              {isLeader && (
                                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  Lead
                                </span>
                              )}
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                                {u?.memberCode}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-[#89948f] truncate">
                              {u?.email} {u?.phone ? `· ${u.phone}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {record.joinedAt && (
                            <span className="text-[11px] text-[#89948f] mr-1 hidden sm:inline">
                              Joined {new Date(record.joinedAt).toLocaleDateString()}
                            </span>
                          )}
                          {canManage && (
                            <>
                              {!isLeader && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignLeader(uid)}
                                  disabled={savingLeader}
                                  title="Make this member the Team Leader"
                                  className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                                >
                                  ★ Make Leader
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setRemoveUserId(uid);
                                  setConfirmText("");
                                  setRemoveError("");
                                }}
                                className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Connected Projects */}
            <section className="rounded-2xl border border-[#e9eeeb] bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Projects with this Team</h2>
              {team.projects && team.projects.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {team.projects.map(({ project }) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between rounded-xl border border-[#e5eae7] p-4 transition hover:border-[#5b9c83] hover:shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold text-[#89948f]">{project.projectCode}</span>
                          <StatusBadge value={project.status} />
                        </div>
                        <h4 className="mt-1 text-sm font-semibold text-slate-800">{project.title}</h4>
                      </div>
                      <span className="text-xs text-[#176b55] font-semibold">View →</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#89948f]">No projects connected to this team yet.</p>
              )}
            </section>
          </>
        )}

        {/* Add Member Modal */}
        {addModal && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAddModal(false);
            }}
          >
            <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-slate-900">Add Team Member</h2>
              <p className="mt-1 text-xs text-[#89948f]">Select a user from your organization to add to {team?.name}.</p>
              <form onSubmit={handleAddMember} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Select User</span>
                  {availableUsersToAdd.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      All organization members are already in this team.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"
                    >
                      <option value="" disabled>
                        Choose a member...
                      </option>
                      {availableUsersToAdd.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                {addError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">{addError}</div>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddModal(false)}
                    className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdd || availableUsersToAdd.length === 0}
                    className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-60"
                  >
                    {savingAdd ? "Adding…" : "Add to Team"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* Remove Member Modal */}
        {removeUserId && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRemoveUserId(null);
            }}
          >
            <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-[#a3493a]">Remove Team Member</h2>
              <p className="mt-1 text-xs text-[#89948f]">
                Confirm removing this member from {team?.name}.
              </p>
              <form onSubmit={handleRemoveMember} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">
                    Write <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">confirm</span> to confirm:
                  </span>
                  <input
                    required
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type 'confirm' to confirm"
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>

                {removeError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    {removeError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRemoveUserId(null)}
                    className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRemove || confirmText.trim().toLowerCase() !== "confirm"}
                    className="h-9 rounded-lg bg-[#a3493a] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#8a3e31] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingRemove ? "Removing…" : "Remove Member"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        {/* Delete Team Modal */}
        {deleteModal && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDeleteModal(false);
            }}
          >
            <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-[#a3493a]">Delete Team</h2>
              <p className="mt-1 text-xs text-[#89948f]">
                Are you sure you want to delete {team?.name}? This action cannot be undone.
              </p>
              <form onSubmit={handleDeleteTeam} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">
                    Write <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">confirm</span> to confirm:
                  </span>
                  <input
                    required
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type 'confirm' to confirm"
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>

                {deleteError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModal(false)}
                    className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingDelete || confirmText.trim().toLowerCase() !== "confirm"}
                    className="h-9 rounded-lg bg-[#a3493a] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#8a3e31] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingDelete ? "Deleting…" : "Delete Team"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* Assign Team Leader Modal */}
        {leaderModal && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setLeaderModal(false);
            }}
          >
            <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-slate-900">Assign Team Leader</h2>
              <p className="mt-1 text-xs text-[#89948f]">
                Select a user to lead <span className="font-semibold text-slate-800">{team?.name}</span>.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAssignLeader(selectedLeaderId || null);
                }}
                className="mt-5 space-y-4"
              >
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Select Leader</span>
                  <select
                    value={selectedLeaderId}
                    onChange={(e) => setSelectedLeaderId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"
                  >
                    <option value="">-- No Leader (Remove current leader) --</option>
                    {membersList.length > 0 && (
                      <optgroup label="Team Members">
                        {membersList.map((m) => {
                          const u = m.user;
                          const uid = m.userId || u?.id;
                          return (
                            <option key={uid} value={uid}>
                              {u?.fullName} ({u?.email})
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Other Organization Users">
                      {users
                        .filter((u) => !existingMemberIds.has(u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.email})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>

                {leaderError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    {leaderError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setLeaderModal(false)}
                    className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingLeader}
                    className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-60"
                  >
                    {savingLeader ? "Saving…" : "Save Leader"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
