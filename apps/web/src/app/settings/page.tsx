"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { authApi, apiRequestMultipart, apiPost, apiGet, apiPatch } from "@/lib/api-client";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  bgImageUrl?: string | null;
  accentColor?: string | null;
  loginBgImageUrl?: string | null;
  loginBgOpacity?: number | null;
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

  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string>("#176b55");
  const [bgBusy, setBgBusy] = useState(false);
  const [bgMsg, setBgMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [loginBgImageUrl, setLoginBgImageUrl] = useState<string | null>(null);
  const [loginBgOpacity, setLoginBgOpacity] = useState<number>(0.8);
  const [loginBgBusy, setLoginBgBusy] = useState(false);
  const [loginBgMsg, setLoginBgMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        setBgImageUrl(org.bgImageUrl || null);
        setAccentColor(org.accentColor || "#176b55");
        setLoginBgImageUrl(org.loginBgImageUrl || null);
        setLoginBgOpacity(org.loginBgOpacity ?? 0.8);
      })
      .catch((err) => {
        if (active) {
          authApi.me().then(({ user }) => {
            setOrganizationName(user.organization.name || "");
            setLogo(user.organization.logoUrl || null);
            setBgImageUrl(user.organization.bgImageUrl || null);
            setAccentColor(user.organization.accentColor || "#176b55");
            setLoginBgImageUrl(user.organization.loginBgImageUrl || null);
            setLoginBgOpacity(user.organization.loginBgOpacity ?? 0.8);
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

  async function uploadBgImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBgBusy(true);
    setBgMsg(null);
    try {
      const result = await apiRequestMultipart<{ url?: string; data?: { url: string } }>(
        "/media/images",
        file,
      );
      const imageUrl = (result as any)?.url ?? (result as any)?.data?.url;
      if (!imageUrl) {
        throw new Error("Could not retrieve image URL from storage provider.");
      }
      setBgImageUrl(imageUrl);
      await apiPatch<OrganizationData>("/organizations/current", {
        bgImageUrl: imageUrl,
        accentColor: accentColor || "#176b55",
      });
      setBgMsg({ type: "success", text: "Background image uploaded and applied successfully!" });
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error) {
      setBgMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to upload background image.",
      });
    } finally {
      setBgBusy(false);
      event.target.value = "";
    }
  }

  async function handleSaveBgAndAccent(customUrl?: string | null) {
    setBgBusy(true);
    setBgMsg(null);
    try {
      const targetUrl = customUrl !== undefined ? customUrl : bgImageUrl;
      await apiPatch<OrganizationData>("/organizations/current", {
        bgImageUrl: targetUrl ? targetUrl.trim() : null,
        accentColor: accentColor || "#176b55",
      });
      setBgImageUrl(targetUrl ? targetUrl.trim() : null);
      setBgMsg({
        type: "success",
        text: targetUrl
          ? "Workspace background & theme updated!"
          : "Background image removed. Reverted to default clean theme!",
      });
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error) {
      setBgMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update theme settings.",
      });
    } finally {
      setBgBusy(false);
    }
  }

  async function uploadLoginBgImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoginBgBusy(true);
    setLoginBgMsg(null);
    try {
      const result = await apiRequestMultipart<{ url?: string; data?: { url: string } }>(
        "/media/images",
        file,
      );
      const imageUrl = (result as any)?.url ?? (result as any)?.data?.url;
      if (!imageUrl) {
        throw new Error("Could not retrieve image URL from storage provider.");
      }
      setLoginBgImageUrl(imageUrl);
      await apiPatch<OrganizationData>("/organizations/current", {
        loginBgImageUrl: imageUrl,
        loginBgOpacity: loginBgOpacity ?? 0.8,
      });
      setLoginBgMsg({ type: "success", text: "Login background image uploaded to ImageBB and applied!" });
    } catch (error) {
      setLoginBgMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to upload login background image.",
      });
    } finally {
      setLoginBgBusy(false);
      event.target.value = "";
    }
  }

  async function handleSaveLoginBg(customUrl?: string | null) {
    setLoginBgBusy(true);
    setLoginBgMsg(null);
    try {
      const targetUrl = customUrl !== undefined ? customUrl : loginBgImageUrl;
      await apiPatch<OrganizationData>("/organizations/current", {
        loginBgImageUrl: targetUrl ? targetUrl.trim() : null,
        loginBgOpacity: Number(loginBgOpacity) || 0.8,
      });
      setLoginBgImageUrl(targetUrl ? targetUrl.trim() : null);
      setLoginBgMsg({
        type: "success",
        text: targetUrl
          ? "Login background & opacity updated successfully!"
          : "Login background removed. Reverted to default login page!",
      });
    } catch (error) {
      setLoginBgMsg({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update login background settings.",
      });
    } finally {
      setLoginBgBusy(false);
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
          Manage your organization name, custom background theme, branding identity, and workspace configurations.
        </p>
      </div>

      {/* Workspace Custom Background & Aesthetics Card (Admin Only) */}
      <section className="mt-8 rounded-2xl border border-[#e9eeeb] bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h2 className="text-base font-semibold text-gray-900">Workspace Background & Aesthetics</h2>
            </div>
            <p className="mt-1 text-xs text-[#89948f]">
              Set a beautiful background image with soft backdrop blur for your team&apos;s workspace. If removed, the system returns to the default clean layout.
            </p>
          </div>
          {bgImageUrl && canManage && (
            <button
              onClick={() => handleSaveBgAndAccent(null)}
              disabled={bgBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0d6d1] bg-[#fff7f5] px-3 py-1.5 text-xs font-semibold text-[#a3493a] transition hover:bg-[#a3493a] hover:text-white"
            >
              🗑️ Remove Background (Default Theme)
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left: Interactive Preview Box */}
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-900 p-4 h-48 flex flex-col justify-between">
            {bgImageUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-500"
                style={{ backgroundImage: `url("${bgImageUrl}")` }}
              >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-[#f5f7fa] flex items-center justify-center text-xs text-gray-400">
                Default Clean Light Theme
              </div>
            )}
            <div className="relative z-10 flex items-center justify-between">
              <span className={`text-xs font-bold ${bgImageUrl ? "text-white" : "text-gray-800"}`}>
                {organizationName || "INRT Workspace"}
              </span>
              <span className="text-[10px] rounded bg-white/20 px-2 py-0.5 text-white backdrop-blur-xs">
                Live Preview
              </span>
            </div>
            <div className="relative z-10 space-y-2">
              <div className="p-2.5 rounded-lg bg-white/80 backdrop-blur-md border border-white/30 text-xs text-gray-900 shadow-sm flex items-center justify-between">
                <span>Frosted Glass Panel</span>
                <span
                  className="px-2 py-1 rounded text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: accentColor || "#176b55" }}
                >
                  Button Accent
                </span>
              </div>
            </div>
          </div>

          {/* Right: Upload and Direct URL controls */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Upload New Background Image</label>
              <div className="mt-1.5 flex items-center gap-3">
                <label
                  className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-lg px-4 text-xs font-semibold shadow-sm transition ${
                    canManage && !bgBusy
                      ? "bg-[#176b55] text-white hover:bg-[#125a47]"
                      : "cursor-not-allowed bg-[#eef2ef] text-[#9aa39f]"
                  }`}
                >
                  <span>{bgBusy ? "Uploading to ImageBB…" : "📸 Upload Photo"}</span>
                  <input
                    disabled={!canManage || bgBusy}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={uploadBgImage}
                    className="sr-only"
                  />
                </label>
                <span className="text-xs text-gray-500">Supports PNG, JPG, WebP up to 10MB</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Or Direct Image URL</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="url"
                  value={bgImageUrl || ""}
                  onChange={(e) => setBgImageUrl(e.target.value)}
                  disabled={!canManage || bgBusy}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs text-gray-900 shadow-sm focus:border-[#176b55] focus:outline-none focus:ring-1 focus:ring-[#176b55] disabled:bg-gray-50"
                />
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleSaveBgAndAccent()}
                    disabled={bgBusy}
                    className="rounded-lg bg-[#176b55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125a47] shrink-0 disabled:opacity-50"
                  >
                    Apply URL
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Button Accent Color</label>
              <div className="mt-2 flex items-center gap-2">
                {["#176b55", "#1e3a8a", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0284c7"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    className={`size-7 rounded-full border-2 transition ${
                      accentColor === color ? "border-gray-900 scale-110 shadow-sm" : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="size-7 rounded-full cursor-pointer border border-gray-300 p-0.5 bg-white"
                  title="Choose custom color"
                />
              </div>
            </div>

            {bgMsg && (
              <p
                role="status"
                className={`text-xs ${bgMsg.type === "success" ? "text-[#27745c]" : "text-[#c24b38]"}`}
              >
                {bgMsg.text}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Login Page Background & Opacity Manager Card (Admin Only) */}
      <section className="mt-8 rounded-2xl border border-[#e9eeeb] bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔐</span>
              <h2 className="text-base font-semibold text-gray-900">Login Page Background & Opacity Control</h2>
            </div>
            <p className="mt-1 text-xs text-[#89948f]">
              Add a custom background photo for your organization&apos;s Login Page. Unlike workspace pages, login background has no blur so it stays sharp. Admin can adjust transparency/opacity.
            </p>
          </div>
          {loginBgImageUrl && canManage && (
            <button
              onClick={() => handleSaveLoginBg(null)}
              disabled={loginBgBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0d6d1] bg-[#fff7f5] px-3 py-1.5 text-xs font-semibold text-[#a3493a] transition hover:bg-[#a3493a] hover:text-white"
            >
              🗑️ Remove Login Background
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left: Interactive Sharp Preview Card with Opacity Control */}
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-900 p-4 h-48 flex flex-col justify-between">
            {loginBgImageUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-300 pointer-events-none"
                style={{
                  backgroundImage: `url("${loginBgImageUrl}")`,
                  opacity: loginBgOpacity,
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-[#f4f7f5] flex items-center justify-center text-xs text-gray-400">
                Default Clean Login Theme
              </div>
            )}
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 bg-white/90 px-2 py-0.5 rounded shadow-xs">
                Login Page
              </span>
              <span className="text-[10px] rounded bg-black/60 px-2 py-0.5 text-white backdrop-blur-xs">
                Opacity: {Math.round((loginBgOpacity ?? 0.8) * 100)}%
              </span>
            </div>
            <div className="relative z-10 p-3 rounded-lg bg-white/95 border border-white/80 shadow-md max-w-[200px] text-[11px] text-gray-900">
              <span className="font-bold block">Sign in to workspace</span>
              <span className="text-[9px] text-gray-500">Unblurred Image + Opacity Control</span>
            </div>
          </div>

          {/* Right: Upload, URL, and Opacity Slider */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Upload Login Background Image</label>
              <div className="mt-1.5 flex items-center gap-3">
                <label
                  className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-lg px-4 text-xs font-semibold shadow-sm transition ${
                    canManage && !loginBgBusy
                      ? "bg-[#176b55] text-white hover:bg-[#125a47]"
                      : "cursor-not-allowed bg-[#eef2ef] text-[#9aa39f]"
                  }`}
                >
                  <span>{loginBgBusy ? "Uploading to ImageBB…" : "📸 Upload Login Photo"}</span>
                  <input
                    disabled={!canManage || loginBgBusy}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={uploadLoginBgImage}
                    className="sr-only"
                  />
                </label>
                <span className="text-xs text-gray-500">Auto converts to ImageBB URL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Or Direct Login Image URL</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="url"
                  value={loginBgImageUrl || ""}
                  onChange={(e) => setLoginBgImageUrl(e.target.value)}
                  disabled={!canManage || loginBgBusy}
                  placeholder="https://i.ibb.co/..."
                  className="block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs text-gray-900 shadow-sm focus:border-[#176b55] focus:outline-none focus:ring-1 focus:ring-[#176b55] disabled:bg-gray-50"
                />
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleSaveLoginBg()}
                    disabled={loginBgBusy}
                    className="rounded-lg bg-[#176b55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#125a47] shrink-0 disabled:opacity-50"
                  >
                    Save Login Theme
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-700">Background Opacity (Transparency)</label>
                <span className="text-xs font-bold text-[#176b55]">
                  {Math.round((loginBgOpacity ?? 0.8) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={loginBgOpacity ?? 0.8}
                onChange={(e) => setLoginBgOpacity(parseFloat(e.target.value))}
                disabled={!canManage || loginBgBusy}
                className="mt-2 w-full cursor-pointer accent-[#176b55]"
              />
            </div>

            {loginBgMsg && (
              <p
                role="status"
                className={`text-xs ${loginBgMsg.type === "success" ? "text-[#27745c]" : "text-[#c24b38]"}`}
              >
                {loginBgMsg.text}
              </p>
            )}
          </div>
        </div>
      </section>

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
