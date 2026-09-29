"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { authApi, apiPatch, apiRequestMultipart, type SessionUser } from "@/lib/api-client";

export default function ProfilePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  
  // Profile form state
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    bio: "",
    profileImageUrl: "",
    skills: "",
    researchAreas: "",
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Password form state
  const [passForm, setPassForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    authApi.me().then(({ user: sessionUser }) => {
      if (active) {
        setUser(sessionUser);
        const nameParts = sessionUser.fullName.split(" ");
        const first = sessionUser.firstName || nameParts[0] || "";
        const last = sessionUser.lastName !== undefined ? (sessionUser.lastName || "") : nameParts.slice(1).join(" ");
        
        setForm({
          firstName: first,
          lastName: last,
          email: sessionUser.email || "",
          phone: sessionUser.phone || "",
          bio: sessionUser.bio || "",
          profileImageUrl: sessionUser.profileImageUrl || "",
          skills: sessionUser.skills?.map(s => s.name).join(", ") || "",
          researchAreas: sessionUser.researchAreas?.map(r => r.name).join(", ") || "",
        });
      }
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setUploadingPhoto(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const res = await apiRequestMultipart<{ url: string }>("/media/images", e.target.files[0]);
      setForm(prev => ({ ...prev, profileImageUrl: res.url }));
      // Automatically save the photo update to profile
      await apiPatch("/users/me/profile", { profileImageUrl: res.url });
      setProfileSuccess("Profile photo updated successfully!");
      if (user) {
        setUser({ ...user, profileImageUrl: res.url });
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePhoto() {
    setProfileError("");
    setProfileSuccess("");
    try {
      await apiPatch("/users/me/profile", { profileImageUrl: null });
      setForm(prev => ({ ...prev, profileImageUrl: "" }));
      if (user) {
        setUser({ ...user, profileImageUrl: null });
      }
      setProfileSuccess("Profile photo removed.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to remove photo");
    }
  }

  async function updateProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      await apiPatch("/users/me/profile", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        bio: form.bio.trim(),
        phone: form.phone.trim(),
        profileImageUrl: form.profileImageUrl || null,
        skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
        researchAreas: form.researchAreas.split(",").map(s => s.trim()).filter(Boolean),
      });

      setProfileSuccess("Profile information updated successfully!");
      
      // Refresh current session user info
      const { user: refreshed } = await authApi.me();
      setUser(refreshed);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassError("New password and confirmation do not match.");
      return;
    }

    if (passForm.newPassword.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }

    setSavingPass(true);
    try {
      await apiPatch("/users/me/change-password", {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      });
      setPassSuccess("Password changed successfully!");
      setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPassError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSavingPass(false);
    }
  }

  if (!user) {
    return (
      <AppShell title="My Profile">
        <div className="animate-pulse space-y-4 max-w-3xl">
          <div className="h-8 w-48 bg-slate-200 rounded"></div>
          <div className="h-64 bg-white rounded-2xl border border-slate-200"></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="My Profile">
      <div className="max-w-3xl space-y-8 pb-12">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">WORKSPACE / USER</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-slate-900">
            My Profile<span className="text-[#4a9279]">.</span>
          </h1>
          <p className="mt-1 text-sm text-[#7c8782]">
            Manage your personal information, profile photo, credentials, and research expertise.
          </p>
        </div>

        {/* Profile Details Form Card */}
        <section className="rounded-2xl border border-[#e9eeeb] bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 border-b border-[#edf0ee] pb-3 mb-6">
            Personal Details & Photo
          </h2>

          <form onSubmit={updateProfile} className="space-y-6">
            {/* Avatar & Photo Upload */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 border-b border-[#edf0ee] pb-6">
              <div className="relative size-20 shrink-0">
                {form.profileImageUrl ? (
                  <img
                    src={form.profileImageUrl}
                    alt={user.fullName}
                    className="size-20 rounded-full object-cover border-2 border-[#176b55]/20 shadow-sm"
                  />
                ) : (
                  <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-[#176b55] to-[#2e8b6e] text-2xl font-bold text-white shadow-sm">
                    {user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs font-semibold text-white">
                    Uploading...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="profile-photo-upload"
                  />
                  <label
                    htmlFor="profile-photo-upload"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#cddbd3] bg-[#f8fbf9] px-3.5 py-1.5 text-xs font-semibold text-[#176b55] transition hover:bg-[#edf5f1]"
                  >
                    <span>Change Photo</span>
                  </label>
                  {form.profileImageUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#89948f]">
                  Member ID: <span className="font-semibold text-slate-700">{user.memberCode}</span> · Role:{" "}
                  <span className="font-semibold text-slate-700">{user.roles.join(", ")}</span>
                </p>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">
                  First Name <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="e.g. John"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Last Name</span>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="e.g. Doe"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
              </label>
            </div>

            {/* Email & Phone */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">
                  Email Address <span className="text-red-500">*</span>
                </span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@organization.com"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Phone Number</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+880 1700 000000"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
              </label>
            </div>

            {/* Bio */}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Bio</span>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Write a brief professional summary about your role, background, or research..."
                className="w-full rounded-lg border border-[#e2e9e5] px-3 py-2 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
              />
            </label>

            {/* Skills & Research Areas */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#edf0ee]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Skills (Comma separated)</span>
                <input
                  type="text"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="e.g. Python, Deep Learning, Statistics"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Research Areas (Comma separated)</span>
                <input
                  type="text"
                  value={form.researchAreas}
                  onChange={(e) => setForm({ ...form, researchAreas: e.target.value })}
                  placeholder="e.g. Artificial Intelligence, Healthcare NLP"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
              </label>
            </div>

            {profileError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-[#176b55]">
                {profileSuccess}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="h-10 rounded-lg bg-[#176b55] px-6 text-xs font-semibold text-white transition hover:bg-[#125a47] disabled:opacity-60 shadow-sm"
              >
                {savingProfile ? "Saving Changes…" : "Save Profile Details"}
              </button>
            </div>
          </form>
        </section>

        {/* Change Password Card */}
        <section className="rounded-2xl border border-[#e9eeeb] bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 border-b border-[#edf0ee] pb-3 mb-2">
            Change Password
          </h2>
          <p className="text-xs text-[#7c8782] mb-6">
            Ensure your account uses a secure password of at least 6 characters.
          </p>

          <form onSubmit={changePassword} className="max-w-md space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Current Password</span>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  required
                  value={passForm.currentPassword}
                  onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 pr-12 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-700"
                >
                  {showCurrent ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#28342f]">New Password</span>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  required
                  minLength={6}
                  value={passForm.newPassword}
                  onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                  placeholder="Min 6 characters"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 pr-12 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-700"
                >
                  {showNew ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#28342f]">Confirm New Password</span>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={6}
                  value={passForm.confirmPassword}
                  onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                  className="h-10 w-full rounded-lg border border-[#e2e9e5] px-3 pr-12 text-sm outline-none transition focus:border-[#5b9c83] focus:ring-1 focus:ring-[#5b9c83]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-700"
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {passError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {passError}
              </div>
            )}
            {passSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-[#176b55]">
                {passSuccess}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPass}
                className="h-10 rounded-lg bg-slate-800 px-6 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 shadow-sm"
              >
                {savingPass ? "Updating Password…" : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
