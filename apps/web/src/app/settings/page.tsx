"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { authApi, apiRequestMultipart, apiPost, apiGet, apiPatch } from "@/lib/api-client";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  dateFormat: string;
}

export default function SettingsPage() {
  const [logo, setLogo] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [canManage, setCanManage] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  useEffect(() => {
    let active = true;

    authApi
      .me()
      .then(({ user }) => {
        if (!active) return;
        setCanManage(user.roles.some((role) => ["SUPER_ADMIN", "ADMIN"].includes(role)));
      })
      .catch(console.error);

    apiGet<OrganizationData>("/organizations/current")
      .then((org) => {
        if (!active) return;
        setOrganizationName(org.name || "");
        setLogo(org.logoUrl || null);
        setDescription(org.description || "");
        setContactEmail(org.email || "");
        setContactPhone(org.phone || "");
      })
      .catch((err) => {
        if (active) {
          // Fallback to authApi
          authApi.me().then(({ user }) => {
            setOrganizationName(user.organization.name || "");
            setLogo(user.organization.logoUrl || null);
          }).catch(console.error);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault();
    if (!organizationName.trim()) {
      setProfileMsg({ type: "error", text: "Organization name cannot be empty." });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await apiPatch<OrganizationData>("/organizations/current", {
        name: organizationName.trim(),
        description: description.trim() || undefined,
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
      });
      setOrganizationName(res.name);
      setProfileMsg({ type: "success", text: "Organization details updated successfully!" });
      // Reload page after brief delay so header/sidebar updates cleanly
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error) {
      setProfileMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update organization details.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    setLogoMsg(null);
    try {
      const result = await apiRequestMultipart<{ organization: { logoUrl: string | null } }>(
        "/media/organization-logo",
        file,
      );
      setLogo(result.organization.logoUrl);
      setLogoMsg({ type: "success", text: "Logo updated successfully!" });
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error) {
      setLogoMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to upload company logo.",
      });
    } finally {
      setLogoBusy(false);
      event.target.value = "";
    }
  }

  async function requestExport() {
    setExportBusy(true);
    setExportStatus("");
    try {
      await apiPost("/exports", { jobType: "FULL_BACKUP", parameters: {} });
      setExportStatus("Export job has been queued in the background. You will receive a notification when it is ready.");
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : "Failed to request export.");
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <AppShell title="Settings">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">ORGANIZATION</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">
          Settings<span className="text-[#4a9279]">.</span>
        </h1>
        <p className="mt-2 text-sm text-[#7c8782]">
          Manage your organization name, branding identity, and workspace configurations.
        </p>
      </div>

      {/* Organization Identity & Profile Card */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Left: Logo Upload Card */}
        <section className="rounded-2xl border border-[#e9eeeb] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Organization Logo</h2>
          <p className="mt-1 text-xs text-[#89948f]">
            This logo appears in your navigation sidebar and report exports.
          </p>

          <div className="mt-6 flex flex-col items-center">
            <div className="grid size-32 place-items-center rounded-2xl border-2 border-dashed border-[#cddbd3] bg-[#f8fbf9] p-2">
              {logo ? (
                <img
                  src={logo}
                  alt={`${organizationName} logo`}
                  className="max-h-full max-w-full rounded-xl object-contain"
                />
              ) : (
                <span className="text-5xl font-bold text-[#4a9279] uppercase">
                  {organizationName.slice(0, 1) || "I"}
                </span>
              )}
            </div>

            <label
              className={`mt-5 inline-flex h-9 cursor-pointer items-center justify-center rounded-lg px-4 text-xs font-semibold shadow-sm transition ${
                canManage && !logoBusy
                  ? "bg-[#176b55] text-white hover:bg-[#125a47]"
                  : "cursor-not-allowed bg-[#eef2ef] text-[#9aa39f]"
              }`}
            >
              <span>{logoBusy ? "Uploading…" : "Change Logo"}</span>
              <input
                disabled={!canManage || logoBusy}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={uploadLogo}
                className="sr-only"
              />
            </label>

            {logoMsg && (
              <p
                role="status"
                className={`mt-3 text-center text-xs ${
                  logoMsg.type === "success" ? "text-[#27745c]" : "text-[#c24b38]"
                }`}
              >
                {logoMsg.text}
              </p>
            )}

            {!canManage && (
              <p className="mt-3 text-center text-[11px] text-[#9aa39f]">
                Only administrators can upload a new logo.
              </p>
            )}
          </div>
        </section>

        {/* Right: Organization Name & Details Form */}
        <section className="rounded-2xl border border-[#e9eeeb] bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">Organization Profile</h2>
          <p className="mt-1 text-xs text-[#89948f]">
            Update your organization name and public contact details.
          </p>

          <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={!canManage || savingProfile}
                placeholder="e.g. INRT or IntelliNova"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#176b55] focus:outline-none focus:ring-1 focus:ring-[#176b55] disabled:bg-gray-50 disabled:text-gray-500"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                This name is displayed in the sidebar, headers, and generated documents.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-700">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={!canManage || savingProfile}
                  placeholder="contact@example.com"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-[#176b55] focus:outline-none focus:ring-1 focus:ring-[#176b55] disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={!canManage || savingProfile}
                  placeholder="+880 1..."
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-[#176b55] focus:outline-none focus:ring-1 focus:ring-[#176b55] disabled:bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">About / Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canManage || savingProfile}
                placeholder="Brief description of the research organization or institute..."
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-[#176b55] focus:outline-none focus:ring-1 focus:ring-[#176b55] disabled:bg-gray-50"
              />
            </div>

            {profileMsg && (
              <div
                role="alert"
                className={`rounded-xl border px-4 py-3 text-xs ${
                  profileMsg.type === "success"
                    ? "border-[#dce6e0] bg-[#f4faf6] text-[#27745c]"
                    : "border-[#f0d6d1] bg-[#fff7f5] text-[#a3493a]"
                }`}
              >
                {profileMsg.text}
              </div>
            )}

            {canManage && (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-lg bg-[#176b55] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#125a47] disabled:opacity-50 transition"
                >
                  {savingProfile ? "Saving Changes…" : "Save Organization Profile"}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>

      {/* Admin Operations Cards */}
      {canManage && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section className="flex flex-col justify-between rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold">Audit Logs</h2>
              <p className="mt-1 text-xs text-[#89948f]">
                View security events, user logins, and organization-wide activity tracking.
              </p>
            </div>
            <div className="mt-4">
              <a
                href="/settings/audit"
                className="inline-block rounded-lg border border-[#dce6e0] px-4 py-2 text-xs font-semibold text-[#176b55] hover:bg-[#f4f7f5]"
              >
                View logs →
              </a>
            </div>
          </section>

          <section className="flex flex-col justify-between rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold">Export Organization Data</h2>
              <p className="mt-1 text-xs text-[#89948f]">
                Generate a full backup of your organization&apos;s data in CSV format.
              </p>
              {exportStatus && <p className="mt-2 text-[11px] font-semibold text-[#27745c]">{exportStatus}</p>}
            </div>
            <div className="mt-4">
              <button
                onClick={requestExport}
                disabled={exportBusy}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  exportBusy ? "bg-[#eef2ef] text-[#9aa39f]" : "bg-[#176b55] text-white hover:bg-[#125a47]"
                }`}
              >
                {exportBusy ? "Queueing..." : "Request Export"}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
