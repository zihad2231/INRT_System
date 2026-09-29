"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

interface TeamMemberItem {
  id: string;
  userId: string;
  membershipRole: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    memberCode: string;
    profileImageUrl: string | null;
  };
}

interface Team {
  id: string;
  teamCode: string;
  name: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  teamLeader: { fullName: string; memberCode: string } | null;
  members?: TeamMemberItem[];
  _count: { members: number; projects: number };
}
interface TeamPage { data: Team[]; meta: { total: number } }

export default function TeamsPage() {
  const [page, setPage] = useState<TeamPage | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addMembersModal, setAddMembersModal] = useState<string | null>(null);
  const [removeMembersModal, setRemoveMembersModal] = useState<string | null>(null);
  const [deleteTeamModal, setDeleteTeamModal] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [users, setUsers] = useState<{ id: string, fullName: string, email: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [modalError, setModalError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [form, setForm] = useState({ teamCode: "", name: "", description: "", targetDate: "", teamLeaderId: "" });
  const [canManage, setCanManage] = useState(false);

  // Leader modal state
  const [leaderModalTeamId, setLeaderModalTeamId] = useState<string | null>(null);
  const [leaderModalTeamName, setLeaderModalTeamName] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [leaderSaving, setLeaderSaving] = useState(false);
  const [leaderError, setLeaderError] = useState("");
  const [currentTeamMembers, setCurrentTeamMembers] = useState<any[]>([]);
  
  const load = useCallback(async () => apiGet<TeamPage>("/teams?page=1&limit=100"), []);
  useEffect(() => { 
    let alive = true; 
    void load().then((data) => { if (alive) setPage(data); }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Could not load teams"); }); 
    apiGet<{data: any[]}>("/users?page=1&limit=100").then(res => { if (alive) setUsers(res.data) }).catch(console.error);
    apiGet<any>("/auth/me").then(res => { if (alive) setCanManage(res.user.roles.some((r: string) => ["SUPER_ADMIN", "ADMIN"].includes(r))) }).catch(console.error);
    return () => { alive = false; }; 
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await apiPost("/teams", {
        teamCode: form.teamCode,
        name: form.name,
        ...(form.description ? { description: form.description } : {}),
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
        ...(form.teamLeaderId ? { teamLeaderId: form.teamLeaderId } : {}),
      });
      setForm({ teamCode: "", name: "", description: "", targetDate: "", teamLeaderId: "" });
      setModal(false);
      setPage(await load());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create team"); }
    finally { setSaving(false); }
  }

  async function openLeaderModal(teamId: string, teamName: string) {
    setLeaderModalTeamId(teamId);
    setLeaderModalTeamName(teamName);
    setLeaderError("");
    setSelectedLeaderId("");
    try {
      const res = await apiGet<any>(`/teams/${teamId}`);
      const t = res?.data || res;
      setSelectedLeaderId(t?.teamLeader?.id || "");
      setCurrentTeamMembers(t?.members || []);
    } catch (e) {
      console.error(e);
      setCurrentTeamMembers([]);
    }
  }

  async function assignLeaderFromModal(e: FormEvent) {
    e.preventDefault();
    if (!leaderModalTeamId) return;
    setLeaderSaving(true);
    setLeaderError("");
    try {
      await apiPost(`/teams/${leaderModalTeamId}/leader`, {
        leaderId: selectedLeaderId || null,
      });
      setLeaderModalTeamId(null);
      setSelectedLeaderId("");
      setPage(await load());
    } catch (e) {
      setLeaderError(e instanceof Error ? e.message : "Could not assign team leader");
    } finally {
      setLeaderSaving(false);
    }
  }

  async function addMemberToTeam(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await apiPost(`/teams/${addMembersModal}/members`, { memberIds: [selectedUser] });
      setAddMembersModal(null);
      setSelectedUser("");
      setPage(await load());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add member"); }
    finally { setSaving(false); }
  }

  async function openRemoveMemberModal(teamId: string) {
    setRemoveMembersModal(teamId);
    setSelectedUser("");
    setConfirmText("");
    setModalError("");
    try {
      const res = await apiGet<any>(`/teams/${teamId}`);
      const members = res?.members || res?.data?.members || [];
      setTeamMembers(members);
    } catch (e) {
      console.error(e);
      setTeamMembers([]);
    }
  }

  async function removeMemberFromTeam(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      setModalError("Please select a member to remove.");
      return;
    }
    if (confirmText.trim().toLowerCase() !== "confirm") {
      setModalError("Please type 'confirm' to confirm.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      await apiPost(`/teams/${removeMembersModal}/members/remove`, {
        memberIds: [selectedUser],
      });
      setRemoveMembersModal(null);
      setSelectedUser("");
      setConfirmText("");
      setPage(await load());
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Could not remove member");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam(e: FormEvent) {
    e.preventDefault();
    if (confirmText.trim().toLowerCase() !== "confirm") {
      setDeleteError("Please type 'confirm' to confirm.");
      return;
    }
    setSaving(true);
    setDeleteError("");
    try {
      await apiPost(`/teams/${deleteTeamModal}/delete`, {});
      setDeleteTeamModal(null);
      setConfirmText("");
      setPage(await load());
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Teams">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">PEOPLE / ORGANIZATION</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">
            Teams<span className="text-[#4a9279]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#7c8782]">Bring members together around shared research goals.</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setError("");
              setModal(true);
            }}
            className="h-10 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] sm:self-auto"
          >
            ＋ Create team
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">
          {error}
        </p>
      )}

      <section className="mt-8 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
        <div className="border-b border-[#edf0ee] p-5">
          <h2 className="text-sm font-semibold">Organization teams</h2>
          <p className="mt-1 text-[11px] text-[#89948f]">{page ? `${page.meta.total} visible teams` : "Loading teams…"}</p>
        </div>
        {!page ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 animate-pulse rounded-xl bg-[#f7f9f8]" />
            ))}
          </div>
        ) : page.data.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h3 className="text-sm font-semibold">No visible teams</h3>
            <p className="mt-2 text-xs text-[#89948f]">Create a team or ask an administrator to add you to one.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#edf0ee]">
            {page.data.map((team) => (
              <article key={team.id} className="flex flex-col gap-4 p-5 hover:bg-[#fcfdfc] transition">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[#89948f] font-mono">{team.teamCode}</span>
                      <StatusBadge value={team.status} />
                    </div>
                    <Link href={`/teams/${team.id}`} className="group inline-flex items-center gap-1.5 mt-1">
                      <h3 className="text-sm font-semibold text-slate-800 group-hover:text-[#176b55] transition">
                        {team.name}
                      </h3>
                      <span className="text-xs text-[#89948f] group-hover:text-[#176b55] transition">↗</span>
                    </Link>
                    <p className="mt-1 text-[11px] text-[#89948f]">{team.description || "Research team"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] text-[#65716c]">
                    <span className="font-medium text-slate-700">{team._count.members} members</span>
                    <span>{team._count.projects} projects</span>
                    <span>Lead: <strong className="text-slate-700">{team.teamLeader?.fullName ?? "Not assigned"}</strong></span>

                    <Link
                      href={`/teams/${team.id}`}
                      className="rounded-lg border border-[#d2ded8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#176b55] hover:bg-[#f0f7f4] transition shadow-2xs"
                    >
                      View Team →
                    </Link>

                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openLeaderModal(team.id, team.name)}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 transition"
                        >
                          ★ Leader
                        </button>
                        <button
                          onClick={() => setAddMembersModal(team.id)}
                          className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[10px] font-semibold hover:bg-gray-200 transition"
                        >
                          ＋ Add
                        </button>
                        <button
                          onClick={() => openRemoveMemberModal(team.id)}
                          className="rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1.5 text-[10px] font-semibold text-orange-700 hover:bg-orange-100 transition"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTeamModal(team.id);
                            setConfirmText("");
                            setDeleteError("");
                          }}
                          className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-100 transition"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Members List Preview */}
                {team.members && team.members.length > 0 && (
                  <div className="rounded-xl bg-[#f8faf9] border border-[#edf2ef] px-3.5 py-2.5 flex flex-wrap items-center gap-2.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#89948f]">
                      Members ({team.members.length}):
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {team.members.map((m) => {
                        const u = m.user;
                        return (
                          <div
                            key={m.id || m.userId}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-[#e1eae5] shadow-2xs"
                          >
                            {u?.profileImageUrl ? (
                              <img src={u.profileImageUrl} alt="" className="size-4 rounded-full object-cover" />
                            ) : (
                              <span className="grid size-4 place-items-center rounded-full bg-[#eef7f3] text-[9px] font-bold text-[#176b55]">
                                {u?.fullName?.[0] || "M"}
                              </span>
                            )}
                            <span>{u?.fullName || "Member"}</span>
                            {m.membershipRole === "TEAM_LEADER" && (
                              <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-800">
                                Lead
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Create Team Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="team-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a9279]">ORGANIZATION</p>
                <h2 id="team-dialog-title" className="mt-1 text-xl font-semibold">
                  Create team
                </h2>
              </div>
              <button onClick={() => setModal(false)} aria-label="Close" className="size-8 rounded-lg hover:bg-[#f4f7f5] text-slate-500">
                ×
              </button>
            </div>
            <form onSubmit={create} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Team code</span>
                <input
                  required
                  value={form.teamCode}
                  onChange={(e) => setForm({ ...form, teamCode: e.target.value })}
                  placeholder="AI-RESEARCH"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Team name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Description</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm outline-none focus:border-[#5b9c83]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Team Leader (Optional)</span>
                <select
                  value={form.teamLeaderId}
                  onChange={(e) => setForm({ ...form, teamLeaderId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"
                >
                  <option value="">No leader assigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Target date</span>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4">
                <button type="button" onClick={() => setModal(false)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium">
                  Cancel
                </button>
                <button
                  disabled={saving}
                  className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-60"
                >
                  {saving ? "Creating…" : "Create team"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Add Team Member Modal */}
      {addMembersModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddMembersModal(null);
          }}
        >
          <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Add Team Member</h2>
            <p className="mt-1 text-xs text-[#89948f]">Select a user to add to this team.</p>
            <form onSubmit={addMemberToTeam} className="mt-5 space-y-4">
              <label className="block">
                <select
                  required
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"
                >
                  <option value="" disabled>Select a user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddMembersModal(null)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium">
                  Cancel
                </button>
                <button disabled={saving} className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white disabled:opacity-60 shadow-sm">
                  {saving ? "Adding…" : "Add Member"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Remove Team Member Modal */}
      {removeMembersModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRemoveMembersModal(null);
          }}
        >
          <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[#a3493a]">Remove Team Member</h2>
            <p className="mt-1 text-xs text-[#89948f]">Select a member to remove and confirm with admin password (admin.inrt).</p>
            <form onSubmit={removeMemberFromTeam} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Team Member</span>
                {teamMembers.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    This team currently has no members to remove.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"
                  >
                    <option value="" disabled>Select a member...</option>
                    {teamMembers.map((m) => {
                      const uid = m.userId || m.user?.id || m.id;
                      const name = m.user?.fullName || m.fullName || "Member";
                      const email = m.user?.email || m.email || m.user?.memberCode || "";
                      return (
                        <option key={uid} value={uid}>
                          {name} {email ? `(${email})` : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
              </label>

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

              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRemoveMembersModal(null)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  disabled={saving || teamMembers.length === 0 || confirmText.trim().toLowerCase() !== "confirm"}
                  className="h-9 rounded-lg bg-[#a3493a] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#8a3e31] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Removing…" : "Remove Member"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Delete Team Modal */}
      {deleteTeamModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteTeamModal(null);
          }}
        >
          <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[#a3493a]">Delete Team</h2>
            <p className="mt-1 text-xs text-[#89948f]">
              This action cannot be undone. Type <strong className="text-red-600 font-mono">confirm</strong> below to proceed with deleting this team.
            </p>
            <form onSubmit={deleteTeam} className="mt-5 space-y-4">
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
                  onClick={() => setDeleteTeamModal(null)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  disabled={saving || confirmText.trim().toLowerCase() !== "confirm"}
                  className="h-9 rounded-lg bg-[#a3493a] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#8a3e31] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Deleting…" : "Delete Team"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Assign Team Leader Modal */}
      {leaderModalTeamId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLeaderModalTeamId(null);
          }}
        >
          <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900">Assign Team Leader</h2>
            <p className="mt-1 text-xs text-[#89948f]">
              Choose a leader for <strong className="text-slate-800">{leaderModalTeamName}</strong>.
            </p>
            <form onSubmit={assignLeaderFromModal} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Select Leader</span>
                <select
                  value={selectedLeaderId}
                  onChange={(e) => setSelectedLeaderId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"
                >
                  <option value="">-- No Leader (Remove leader) --</option>
                  {currentTeamMembers.length > 0 && (
                    <optgroup label="Current Team Members">
                      {currentTeamMembers.map((m: any) => {
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
                  <optgroup label="All Organization Users">
                    {users.map((u) => (
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
                  onClick={() => setLeaderModalTeamId(null)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaderSaving}
                  className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-60"
                >
                  {leaderSaving ? "Saving…" : "Save Leader"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}
