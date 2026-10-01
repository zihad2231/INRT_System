"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiDelete, apiGet, apiPatch, apiPost, authApi, type SessionUser } from "@/lib/api-client";

interface AdminItem {
  id: string;
  memberCode: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  profileImageUrl?: string | null;
  status: string;
  createdAt: string;
  roles: string[];
  teams: Array<{ id: string; name: string; teamCode: string }>;
}

interface MemberOption {
  id: string;
  memberCode: string;
  fullName: string;
  email: string;
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create/Promote Admin Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleCode, setRoleCode] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [searchMember, setSearchMember] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [adminRes, memberRes, currentUser] = await Promise.all([
        apiGet<AdminItem[]>("/users/admins"),
        apiGet<{ data: MemberOption[] }>("/users?limit=100"),
        authApi.me().then((r) => r.user),
      ]);
      setAdmins(adminRes);
      setMembers(memberRes.data ?? []);
      setUser(currentUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin management data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredMembers = members.filter(
    (m) =>
      !admins.some((a) => a.id === m.id) &&
      (m.fullName.toLowerCase().includes(searchMember.toLowerCase()) ||
        m.email.toLowerCase().includes(searchMember.toLowerCase()) ||
        m.memberCode.toLowerCase().includes(searchMember.toLowerCase())),
  );

  async function handlePromoteAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Please select a user to assign admin role.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiPost(`/users/${selectedUserId}/promote-admin`, { roleCode });
      setSuccess("Admin role assigned successfully.");
      setShowModal(false);
      setSelectedUserId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign admin role.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoteAdmin(admin: AdminItem) {
    if (!confirm(`Are you sure you want to revoke admin privileges from ${admin.fullName}?`)) return;
    setError("");
    setSuccess("");
    try {
      await apiPost(`/users/${admin.id}/demote-admin`, {});
      setSuccess(`Revoked admin privileges for ${admin.fullName}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke admin role.");
    }
  }

  async function handleToggleStatus(admin: AdminItem) {
    const nextStatus = admin.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!confirm(`Are you sure you want to change status of ${admin.fullName} to ${nextStatus}?`)) return;
    setError("");
    setSuccess("");
    try {
      await apiPatch(`/users/${admin.id}`, { status: nextStatus });
      setSuccess(`Status updated for ${admin.fullName}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status.");
    }
  }

  if (user && !user.roles.includes("SUPER_ADMIN")) {
    return (
      <AppShell title="Admin Management">
        <div className="rounded-2xl border border-[#f0d6d1] bg-[#fff7f5] p-8 text-center">
          <span className="text-3xl">🛡️</span>
          <h2 className="mt-3 text-lg font-semibold text-[#a3493a]">Access Denied</h2>
          <p className="mt-2 text-xs text-[#7c8782]">Only Super Admins are allowed to access Admin Management.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Management">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#176b55]">
            SUPER ADMIN GOVERNANCE
          </p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em] sm:text-[34px]">
            Admin Management<span className="text-[#176b55]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#7c8782]">
            Govern organization administrators, manage system authority, and monitor privileged accounts.
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowModal(true);
          }}
          className="flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] sm:self-auto"
        >
          <span>🛡️</span> Assign New Admin
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs leading-5 text-[#a3493a]">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="mt-5 rounded-xl border border-[#c6e6d9] bg-[#f0faf5] px-4 py-3 text-xs leading-5 text-[#176b55]">
          {success}
        </div>
      )}

      {/* Admin KPI Summary */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#7c8782]">Total Administrators</p>
            <span className="grid size-9 place-items-center rounded-xl bg-[#eaf4f0] text-[#176b55]">🛡️</span>
          </div>
          <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-[#26332e]">{admins.length}</p>
        </div>
        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#7c8782]">Super Admins</p>
            <span className="grid size-9 place-items-center rounded-xl bg-[#f2effa] text-[#8b77ba]">👑</span>
          </div>
          <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-[#26332e]">
            {admins.filter((a) => a.roles.includes("SUPER_ADMIN")).length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#7c8782]">Operational Admins</p>
            <span className="grid size-9 place-items-center rounded-xl bg-[#edf2fa] text-[#6481b0]">⚙️</span>
          </div>
          <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-[#26332e]">
            {admins.filter((a) => a.roles.includes("ADMIN") && !a.roles.includes("SUPER_ADMIN")).length}
          </p>
        </div>
      </div>

      {/* Admin List Table */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
        <div className="border-b border-[#edf0ee] p-5">
          <h2 className="text-sm font-semibold">Active Administrators</h2>
          <p className="mt-1 text-xs text-[#89948f]">List of users with admin and governance roles in this organization.</p>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 animate-pulse rounded-xl bg-[#f7f9f8]" />
            ))}
          </div>
        ) : admins.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#89948f]">No administrators found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#edf0ee] bg-[#fbfcfb] text-[#7c8782]">
                <tr>
                  <th className="px-5 py-3 font.medium">Member Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Team(s)</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ee]">
                {admins.map((admin) => {
                  const isSelf = admin.id === user?.id;
                  const isSuper = admin.roles.includes("SUPER_ADMIN");
                  return (
                    <tr key={admin.id} className="hover:bg-[#fbfcfb]">
                      <td className="px-5 py-4 font-semibold text-[#17211f]">
                        <div className="flex items-center gap-3">
                          {admin.profileImageUrl ? (
                            <img src={admin.profileImageUrl} alt={admin.fullName} className="size-8 rounded-full object-cover border border-[#cddbd3]" />
                          ) : (
                            <span className="grid size-8 place-items-center rounded-full bg-[#e7ece9] font-bold text-[#176b55]">
                              {admin.fullName.charAt(0)}
                            </span>
                          )}
                          <div>
                            <span className="block font-semibold">{admin.fullName}</span>
                            <span className="text-[10px] text-[#89948f]">{admin.memberCode}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#50615a]">{admin.email}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold ${
                            isSuper ? "bg-[#f2effa] text-[#745fb3]" : "bg-[#eaf4f0] text-[#176b55]"
                          }`}
                        >
                          {isSuper ? "👑 SUPER ADMIN" : "🛡️ ADMIN"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[#7c8782]">
                        {admin.teams.length > 0 ? admin.teams.map((t) => t.name).join(", ") : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={admin.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(admin)}
                            disabled={isSelf}
                            className="rounded-lg border border-[#e2e9e5] px-2.5 py-1 text-[11px] font-medium text-[#50615a] hover:bg-[#f5f8f6] disabled:opacity-40"
                          >
                            {admin.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                          {!isSuper && (
                            <button
                              onClick={() => handleDemoteAdmin(admin)}
                              disabled={isSelf}
                              className="rounded-lg border border-[#f0d6d1] px-2.5 py-1 text-[11px] font-medium text-[#a3493a] hover:bg-[#fff7f5] disabled:opacity-40"
                            >
                              Revoke Admin
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign New Admin Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/35 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#176b55]">
                  SUPER ADMIN GOVERNANCE
                </p>
                <h2 className="mt-1 text-xl font-semibold">Assign Admin Role</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="grid size-8 place-items-center rounded-lg hover:bg-[#f4f7f5]"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePromoteAdmin} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Search & Select Member</span>
                <input
                  type="text"
                  placeholder="Search member by name, email, or code..."
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  className="mb-2 h-9 w-full rounded-lg border border-[#e2e9e5] px-3 text-xs"
                />
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs"
                >
                  <option value="">-- Choose member --</option>
                  {filteredMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.memberCode}) — {m.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Admin Level</span>
                <select
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value as any)}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs"
                >
                  <option value="ADMIN">ADMIN — Operational Management</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN — System & Governance Authority</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting || !selectedUserId}
                  className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Assigning..." : "Assign Role"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}
