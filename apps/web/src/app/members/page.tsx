"use client";

import { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost, apiPatch, apiRequestMultipart, authApi, type PageMeta } from "@/lib/api-client";

interface Member {
  id: string;
  memberCode: string;
  email: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  profileImageUrl: string | null;
  phone?: string | null;
  bio?: string | null;
  status: string;
  joiningDate: string | null;
}

interface MemberPage {
  data: Member[];
  meta: PageMeta;
}

export default function MembersPage() {
  const [page, setPage] = useState<MemberPage | null>(null);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Create member state
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    profileImageUrl: "",
  });

  // Edit member state
  const [editModal, setEditModal] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    bio: "",
    profileImageUrl: "",
    status: "ACTIVE",
    password: "",
  });
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Reset password state
  const [resetModal, setResetModal] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Remove member state
  const [removeModal, setRemoveModal] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [removeError, setRemoveError] = useState("");

  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => apiGet<MemberPage>("/users?page=1&limit=100"), []);

  useEffect(() => {
    let alive = true;
    authApi
      .me()
      .then(({ user }) => {
        if (alive) setCanManage(user.roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r)));
      })
      .catch(console.error);

    void load()
      .then((data) => {
        if (alive) setPage(data);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Could not load members");
      });

    return () => {
      alive = false;
    };
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiPost("/users", { ...form, ...(form.lastName ? {} : { lastName: undefined }) });
      setForm({ email: "", firstName: "", lastName: "", password: "", profileImageUrl: "" });
      setModal(false);
      setPage(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create member");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    try {
      const res = await apiRequestMultipart<{ url: string }>("/media/images", e.target.files[0]);
      setForm((prev) => ({ ...prev, profileImageUrl: res.url }));
    } catch {
      setError("Failed to upload image.");
    }
  }

  function startEdit(member: Member) {
    setEditModal(member);
    setEditForm({
      firstName: member.firstName || member.fullName.split(" ")[0] || "",
      lastName: member.lastName || member.fullName.split(" ").slice(1).join(" ") || "",
      email: member.email || "",
      phone: member.phone || "",
      bio: member.bio || "",
      profileImageUrl: member.profileImageUrl || "",
      status: member.status || "ACTIVE",
      password: "",
    });
    setEditError("");
    setEditSuccess("");
    setShowEditPassword(false);
  }

  async function uploadEditImage(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setUploadingEditPhoto(true);
    setEditError("");
    try {
      const res = await apiRequestMultipart<{ url: string }>("/media/images", e.target.files[0]);
      setEditForm((prev) => ({ ...prev, profileImageUrl: res.url }));
    } catch (err) {
      setEditError("Failed to upload image.");
    } finally {
      setUploadingEditPhoto(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  }

  async function saveEditMember(e: FormEvent) {
    e.preventDefault();
    if (!editModal) return;
    setSaving(true);
    setEditError("");
    setEditSuccess("");
    try {
      await apiPatch(`/users/${editModal.id}`, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        bio: editForm.bio.trim(),
        profileImageUrl: editForm.profileImageUrl || null,
        status: editForm.status,
        ...(editForm.password.trim() ? { password: editForm.password.trim() } : {}),
      });

      setEditSuccess("Member details updated successfully!");
      setPage(await load());
      setTimeout(() => {
        setEditModal(null);
        setEditSuccess("");
      }, 1000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResetStatus("");
    try {
      await apiPatch(`/users/${resetModal}/reset-password`, { password: resetPass });
      setResetStatus("Password updated successfully.");
      setTimeout(() => {
        setResetModal(null);
        setResetStatus("");
        setResetPass("");
      }, 1500);
    } catch (err) {
      setResetStatus(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(e: FormEvent) {
    e.preventDefault();
    if (confirmText.trim().toLowerCase() !== "confirm") {
      setRemoveError("Please type 'confirm' to confirm.");
      return;
    }
    setSaving(true);
    setRemoveError("");
    try {
      await apiPatch(`/users/${removeModal}/remove`, {});
      setRemoveModal(null);
      setConfirmText("");
      setPage(await load());
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setSaving(false);
    }
  }

  const shown =
    page?.data.filter((member) =>
      `${member.fullName} ${member.memberCode} ${member.email}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  return (
    <AppShell title="Members">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">PEOPLE / ORGANIZATION</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">
            Members<span className="text-[#4a9279]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#7c8782]">People contributing to the organization’s research.</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setError("");
              setModal(true);
            }}
            className="h-10 self-start rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] sm:self-auto"
          >
            ＋ Add member
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">
          {error}
        </p>
      )}

      <section className="mt-8 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-[#edf0ee] p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">Organization directory</h2>
            <p className="mt-1 text-[11px] text-[#89948f]">{page ? `${page.meta.total} members` : "Loading members…"}</p>
          </div>
          <input
            aria-label="Search members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, email"
            className="h-9 rounded-lg border border-[#e5eae7] px-3 text-xs outline-none focus:border-[#5b9c83]"
          />
        </div>

        {!page ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 animate-pulse rounded-xl bg-[#f7f9f8]" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="px-5 py-14 text-center text-xs text-[#89948f]">No members match your search.</p>
        ) : (
          <div className="divide-y divide-[#edf0ee]">
            {shown.map((member) => (
              <article key={member.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                {member.profileImageUrl ? (
                  <img src={member.profileImageUrl} alt="" className="size-11 shrink-0 rounded-full object-cover border border-slate-200" />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eaf4f0] text-xs font-semibold text-[#39886d]">
                    {member.fullName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{member.fullName}</h3>
                    <StatusBadge value={member.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#89948f]">{member.email}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(member)}
                      className="rounded-lg bg-[#eef7f3] px-3 py-1.5 text-[11px] font-semibold text-[#176b55] transition hover:bg-[#d8efe5]"
                    >
                      Edit Details
                    </button>
                    <button
                      onClick={() => {
                        setResetModal(member.id);
                        setResetStatus("");
                        setResetPass("");
                      }}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-gray-200"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => {
                        setRemoveModal(member.id);
                        setConfirmText("");
                        setRemoveError("");
                      }}
                      className="rounded-lg bg-[#fff7f5] px-3 py-1.5 text-[11px] font-semibold text-[#a3493a] transition hover:bg-[#f0d6d1]"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <span className="ml-2 text-[11px] font-mono font-medium text-[#65716c]">{member.memberCode}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Add Member Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a9279]">PEOPLE</p>
                <h2 id="member-dialog-title" className="mt-1 text-xl font-semibold">
                  Add member
                </h2>
                <p className="mt-1 text-xs text-[#89948f]">
                  New accounts are immediately active and users can log in using their email or auto-generated username.
                </p>
              </div>
              <button onClick={() => setModal(false)} aria-label="Close" className="size-8 rounded-lg hover:bg-[#f4f7f5] text-slate-500">
                ×
              </button>
            </div>
            <form onSubmit={create} className="mt-5 space-y-4" autoComplete="off">
              <div>
                <span className="mb-2 block text-xs font-medium">Profile Image</span>
                <div className="flex items-center gap-4">
                  <div className="grid size-14 shrink-0 place-items-center rounded-full border border-dashed border-[#cddbd3] bg-[#f8fbf9] overflow-hidden">
                    {form.profileImageUrl ? (
                      <img src={form.profileImageUrl} alt="preview" className="size-full rounded-full object-cover" />
                    ) : (
                      <span className="text-xs text-[#89948f]">Photo</span>
                    )}
                  </div>
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs font-semibold text-[#17211f] hover:bg-[#f4f7f5]">
                    <span>Choose Image</span>
                    <input ref={createFileInputRef} type="file" accept="image/*" onChange={uploadImage} className="sr-only" />
                  </label>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-medium">First name *</span>
                  <input
                    required
                    autoComplete="off"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-medium">Last name</span>
                  <input
                    autoComplete="off"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Email *</span>
                <input
                  required
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                />
              </label>
              <label className="block relative">
                <span className="mb-1.5 block text-xs font-medium">Temporary password *</span>
                <div className="relative">
                  <input
                    required
                    minLength={6}
                    maxLength={72}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 pr-12 text-sm outline-none focus:border-[#5b9c83]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#89948f] hover:text-[#176b55]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4">
                <button type="button" onClick={() => setModal(false)} className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium">
                  Cancel
                </button>
                <button
                  disabled={saving}
                  className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-60"
                >
                  {saving ? "Creating…" : "Create member"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Edit Member Modal */}
      {editModal && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditModal(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a9279]">ADMIN / MEMBER EDIT</p>
                <h2 id="edit-dialog-title" className="mt-1 text-xl font-semibold text-slate-900">
                  Edit Member Details
                </h2>
                <p className="mt-1 text-xs text-[#89948f]">
                  Update member profile, photo, status, or set a new password directly.
                </p>
              </div>
              <button onClick={() => setEditModal(null)} aria-label="Close" className="size-8 rounded-lg hover:bg-[#f4f7f5] text-slate-500">
                ×
              </button>
            </div>

            <form onSubmit={saveEditMember} className="mt-5 space-y-4">
              {/* Profile Photo */}
              <div>
                <span className="mb-2 block text-xs font-medium text-[#28342f]">Profile Photo</span>
                <div className="flex items-center gap-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-[#f8fbf9]">
                    {editForm.profileImageUrl ? (
                      <img src={editForm.profileImageUrl} alt="preview" className="size-full rounded-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center bg-[#176b55]/10 text-sm font-bold text-[#176b55]">
                        {editForm.firstName ? editForm.firstName[0]?.toUpperCase() : "U"}
                      </div>
                    )}
                    {uploadingEditPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white">
                        ...
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-[#e2e9e5] bg-white px-3 text-xs font-semibold text-[#17211f] hover:bg-[#f4f7f5]">
                      <span>{editForm.profileImageUrl ? "Change Photo" : "Upload Photo"}</span>
                      <input ref={editFileInputRef} type="file" accept="image/*" onChange={uploadEditImage} className="sr-only" />
                    </label>
                    {editForm.profileImageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, profileImageUrl: "" }))}
                        className="rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs text-red-600 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Names */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">First name *</span>
                  <input
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Last name</span>
                  <input
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>
              </div>

              {/* Email & Phone */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Email *</span>
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Phone</span>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+880 1700 000000"
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none focus:border-[#5b9c83]"
                  />
                </label>
              </div>

              {/* Status & Optional Password */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Account Status</span>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] bg-white px-3 text-sm outline-none focus:border-[#5b9c83]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INVITED">INVITED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[#28342f]">
                    New Password <span className="text-[10px] text-slate-400 font-normal">(optional)</span>
                  </span>
                  <div className="relative">
                    <input
                      minLength={6}
                      type={showEditPassword ? "text" : "password"}
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Leave blank to keep current"
                      className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 pr-12 text-sm outline-none focus:border-[#5b9c83]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#89948f] hover:text-[#176b55]"
                    >
                      {showEditPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </div>

              {/* Bio */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Bio</span>
                <textarea
                  rows={2}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Professional background or summary..."
                  className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm outline-none focus:border-[#5b9c83]"
                />
              </label>

              {editError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">{editError}</div>}
              {editSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-[#176b55]">
                  {editSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-4">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg bg-[#176b55] px-5 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setResetModal(null);
          }}
        >
          <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900">Reset Password</h2>
            <p className="mt-1 text-xs text-[#89948f]">Enter a new password for the user. (Min 6 chars)</p>
            <form onSubmit={resetPassword} className="mt-5 space-y-4">
              <label className="block relative">
                <div className="relative">
                  <input
                    required
                    minLength={6}
                    type={showResetPassword ? "text" : "password"}
                    value={resetPass}
                    onChange={(e) => setResetPass(e.target.value)}
                    placeholder="Type new password"
                    className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 pr-12 text-sm outline-none focus:border-[#5b9c83]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#89948f] hover:text-[#176b55]"
                  >
                    {showResetPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              {resetStatus && <p className="text-xs font-semibold text-[#176b55]">{resetStatus}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  className="h-9 rounded-lg bg-[#176b55] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Remove Member Modal */}
      {removeModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#14251f]/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRemoveModal(null);
          }}
        >
          <section role="dialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[#a3493a]">Remove Member</h2>
            <p className="mt-1 text-xs text-[#89948f]">
              This action cannot be undone. Type <strong className="text-red-600 font-mono">confirm</strong> below to confirm removal.
            </p>
            <form onSubmit={removeMember} className="mt-5 space-y-4">
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
                  onClick={() => setRemoveModal(null)}
                  className="h-9 rounded-lg border border-[#e2e9e5] px-4 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  disabled={saving || confirmText.trim().toLowerCase() !== "confirm"}
                  className="h-9 rounded-lg bg-[#a3493a] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#8a3e31] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Removing…" : "Remove Member"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}
