"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiRequestMultipart,
  authApi,
  ComponentAllocationItem,
  ComponentItem,
  ComponentRequestItem,
  ProjectSummary,
  SessionUser,
} from "@/lib/api-client";

export default function ComponentsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "requests" | "allocations">("catalog");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [requests, setRequests] = useState<ComponentRequestItem[]>([]);
  const [allocations, setAllocations] = useState<ComponentAllocationItem[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Image Uploading States
  const [uploadingImage, setUploadingImage] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<ComponentItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<ComponentItem | null>(null);
  const [showRequestModal, setShowRequestModal] = useState<ComponentItem | null>(null);
  const [reviewModal, setReviewModal] = useState<{ request: ComponentRequestItem; action: "approve" | "reject" } | null>(null);
  const [returnModal, setReturnModal] = useState<ComponentAllocationItem | null>(null);

  // Form states
  const [addComponentForm, setAddComponentForm] = useState({
    componentCode: "",
    name: "",
    category: "ELECTRONICS",
    description: "",
    imageUrl: "",
    totalQuantity: 1,
    brand: "",
    model: "",
    unitPrice: "",
    purchaseDate: "",
    location: "",
    condition: "NEW",
    notes: "",
  });

  const [editComponentForm, setEditComponentForm] = useState({
    name: "",
    category: "",
    description: "",
    imageUrl: "",
    totalQuantity: 0,
    brand: "",
    model: "",
    unitPrice: "",
    purchaseDate: "",
    location: "",
    condition: "",
    notes: "",
  });

  const [requestForm, setRequestForm] = useState({
    requestedQuantity: 1,
    purpose: "",
    projectId: "",
    expectedStartDate: "",
    expectedEndDate: "",
    additionalNote: "",
  });

  const [reviewComment, setReviewComment] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r)) || user?.permissions.includes("COMPONENT_MANAGE");

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then(({ user: sessionUser }) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [compRes, reqRes, allocRes, projRes] = await Promise.all([
        apiGet<{ data: ComponentItem[] }>("/components"),
        apiGet<{ data: ComponentRequestItem[] }>("/components/requests"),
        apiGet<{ data: ComponentAllocationItem[] }>("/components/allocations"),
        apiGet<{ data: ProjectSummary[] }>("/projects").catch(() => ({ data: [] })),
      ]);
      setComponents(compRes.data || []);
      setRequests(reqRes.data || []);
      setAllocations(allocRes.data || []);
      setProjects(projRes.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load components data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ImageBB Image Upload Handler
  const handleImageFileUpload = async (file: File, onSuccess: (url: string) => void) => {
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const res = await apiRequestMultipart<{ url?: string; displayUrl?: string }>("/media/images", file);
      const imageUrl = res.displayUrl || res.url || "";
      if (imageUrl) {
        onSuccess(imageUrl);
        showFeedback("Image uploaded & converted to ImageBB link!");
      } else {
        throw new Error("Failed to parse ImageBB URL.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload image to ImageBB.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Categories list derived from inventory
  const categories = Array.from(new Set(components.map((c) => c.category))).filter(Boolean);

  // Filtered components
  const filteredComponents = components.filter((comp) => {
    const matchesSearch =
      !searchQuery ||
      comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.componentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comp.brand && comp.brand.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === "ALL" || comp.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || comp.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Derived stats
  const totalComponents = components.length;
  const totalAvailableUnits = components.reduce((sum, c) => sum + c.availableQuantity, 0);
  const totalAllocatedUnits = components.reduce((sum, c) => sum + c.allocatedQuantity, 0);
  const pendingRequestsCount = requests.filter((r) => r.status === "PENDING").length;

  // Auto-generate unique component code
  const handleAutoGenerateCode = async (name: string, category: string) => {
    try {
      const res = await apiGet<{ code: string }>(
        `/components/generate-code?name=${encodeURIComponent(name || "")}&category=${encodeURIComponent(category || "")}`
      );
      if (res.code) {
        setAddComponentForm((prev) => ({ ...prev, componentCode: res.code }));
      }
    } catch {
      const source = (name || category || "CMP").replace(/[^a-zA-Z0-9]/g, "").trim();
      let prefix = source.slice(0, 3).toUpperCase();
      if (prefix.length < 3) prefix = (prefix + "CMP").slice(0, 3).toUpperCase();
      setAddComponentForm((prev) => ({ ...prev, componentCode: `${prefix}001` }));
    }
  };

  // Form submission handlers
  const handleCreateComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/components", {
        componentCode: addComponentForm.componentCode.trim() || undefined,
        name: addComponentForm.name.trim(),
        category: addComponentForm.category.trim(),
        description: addComponentForm.description.trim() || undefined,
        imageUrl: addComponentForm.imageUrl.trim() || undefined,
        totalQuantity: Number(addComponentForm.totalQuantity),
        brand: addComponentForm.brand.trim() || undefined,
        model: addComponentForm.model.trim() || undefined,
        unitPrice: addComponentForm.unitPrice ? Number(addComponentForm.unitPrice) : undefined,
        purchaseDate: addComponentForm.purchaseDate ? new Date(addComponentForm.purchaseDate).toISOString() : undefined,
        location: addComponentForm.location.trim() || undefined,
        condition: addComponentForm.condition.trim() || undefined,
        notes: addComponentForm.notes.trim() || undefined,
      });
      setShowAddModal(false);
      setAddComponentForm({
        componentCode: "",
        name: "",
        category: "ELECTRONICS",
        description: "",
        imageUrl: "",
        totalQuantity: 1,
        brand: "",
        model: "",
        unitPrice: "",
        purchaseDate: "",
        location: "",
        condition: "NEW",
        notes: "",
      });
      showFeedback("Component added successfully!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to create component");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPatch(`/components/${showEditModal.id}`, {
        name: editComponentForm.name.trim(),
        category: editComponentForm.category.trim(),
        description: editComponentForm.description.trim() || undefined,
        imageUrl: editComponentForm.imageUrl.trim() || undefined,
        totalQuantity: Number(editComponentForm.totalQuantity),
        brand: editComponentForm.brand.trim() || undefined,
        model: editComponentForm.model.trim() || undefined,
        unitPrice: editComponentForm.unitPrice ? Number(editComponentForm.unitPrice) : undefined,
        purchaseDate: editComponentForm.purchaseDate ? new Date(editComponentForm.purchaseDate).toISOString() : undefined,
        location: editComponentForm.location.trim() || undefined,
        condition: editComponentForm.condition.trim() || undefined,
        notes: editComponentForm.notes.trim() || undefined,
      });
      setShowEditModal(null);
      showFeedback("Component updated successfully!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to update component");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComponent = async (comp: ComponentItem) => {
    if (!confirm(`Are you sure you want to archive component '${comp.name}'?`)) return;
    setError(null);
    try {
      await apiDelete(`/components/${comp.id}`);
      showFeedback("Component archived successfully!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to archive component");
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRequestModal) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/components/requests", {
        componentId: showRequestModal.id,
        requestedQuantity: Number(requestForm.requestedQuantity),
        purpose: requestForm.purpose,
        projectId: requestForm.projectId || undefined,
        expectedStartDate: requestForm.expectedStartDate || undefined,
        expectedEndDate: requestForm.expectedEndDate || undefined,
        additionalNote: requestForm.additionalNote || undefined,
      });
      setShowRequestModal(null);
      setRequestForm({
        requestedQuantity: 1,
        purpose: "",
        projectId: "",
        expectedStartDate: "",
        expectedEndDate: "",
        additionalNote: "",
      });
      showFeedback("Component request submitted successfully!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModal) return;
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = `/components/requests/${reviewModal.request.id}/${reviewModal.action}`;
      await apiPatch(endpoint, { comment: reviewComment });
      setReviewModal(null);
      setReviewComment("");
      showFeedback(`Request ${reviewModal.action === "approve" ? "approved" : "rejected"} successfully!`);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to process request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    setError(null);
    try {
      await apiPatch(`/components/requests/${reqId}/cancel`, {});
      showFeedback("Request cancelled.");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to cancel request");
    }
  };

  const handleReturnAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModal) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPatch(`/components/allocations/${returnModal.id}/return`, { notes: returnNotes });
      setReturnModal(null);
      setReturnNotes("");
      showFeedback("Allocation marked as returned and inventory updated!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to return allocation");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (comp: ComponentItem) => {
    setShowEditModal(comp);
    setEditComponentForm({
      name: comp.name,
      category: comp.category,
      description: comp.description || "",
      imageUrl: comp.imageUrl || "",
      totalQuantity: comp.totalQuantity,
      brand: comp.brand || "",
      model: comp.model || "",
      unitPrice: comp.unitPrice ? String(comp.unitPrice) : "",
      purchaseDate: comp.purchaseDate ? comp.purchaseDate.split("T")[0] : "",
      location: comp.location || "",
      condition: comp.condition || "GOOD",
      notes: comp.notes || "",
    });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#137333]"><span className="size-1.5 rounded-full bg-[#137333]" /> Available</span>;
      case "PARTIALLY_AVAILABLE":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef7e0] px-2.5 py-1 text-xs font-semibold text-[#b06000]"><span className="size-1.5 rounded-full bg-[#b06000]" /> Partially Available</span>;
      case "IN_USE":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f0fe] px-2.5 py-1 text-xs font-semibold text-[#1a73e8]"><span className="size-1.5 rounded-full bg-[#1a73e8]" /> In Use</span>;
      case "UNAVAILABLE":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fce8e6] px-2.5 py-1 text-xs font-semibold text-[#c5221f]"><span className="size-1.5 rounded-full bg-[#c5221f]" /> Unavailable</span>;
      case "PENDING":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef7e0] px-2.5 py-1 text-xs font-semibold text-[#b06000]"><span className="size-1.5 rounded-full bg-[#b06000]" /> Pending Review</span>;
      case "APPROVED":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#137333]"><span className="size-1.5 rounded-full bg-[#137333]" /> Approved</span>;
      case "REJECTED":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fce8e6] px-2.5 py-1 text-xs font-semibold text-[#c5221f]"><span className="size-1.5 rounded-full bg-[#c5221f]" /> Rejected</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f3f4] px-2.5 py-1 text-xs font-semibold text-[#5f6368]"><span className="size-1.5 rounded-full bg-[#5f6368]" /> Cancelled</span>;
      case "ACTIVE":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f0fe] px-2.5 py-1 text-xs font-semibold text-[#1a73e8]"><span className="size-1.5 rounded-full bg-[#1a73e8]" /> Active Allocation</span>;
      case "RETURNED":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#137333]"><span className="size-1.5 rounded-full bg-[#137333]" /> Returned</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{status}</span>;
    }
  };

  return (
    <AppShell title="Component Management">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17211f]">Component Inventory & Access</h1>
          <p className="mt-1 text-sm text-[#65716c]">
            Track lab equipment, microcontrollers, sensors, and manage access requests across projects.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b55] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125443]"
          >
            <span className="text-base">+</span> Add New Component
          </button>
        )}
      </div>

      {/* Notifications / Feedback Messages */}
      {successMsg && (
        <div className="mb-6 rounded-xl border border-[#b7dfd2] bg-[#eaf4f0] p-4 text-sm font-medium text-[#176b55]">
          ✓ {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-[#f5c6cb] bg-[#f8d7da] p-4 text-sm font-medium text-[#721c24]">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Total Components</p>
          <p className="mt-2 text-3xl font-extrabold text-[#17211f]">{totalComponents}</p>
          <p className="mt-1 text-xs text-[#65716c]">Registered component items</p>
        </div>

        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Available Quantity</p>
          <p className="mt-2 text-3xl font-extrabold text-[#137333]">{totalAvailableUnits}</p>
          <p className="mt-1 text-xs text-[#65716c]">Ready for allocation</p>
        </div>

        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Allocated / In Use</p>
          <p className="mt-2 text-3xl font-extrabold text-[#1a73e8]">{totalAllocatedUnits}</p>
          <p className="mt-1 text-xs text-[#65716c]">Currently deployed in projects</p>
        </div>

        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Pending Requests</p>
          <p className="mt-2 text-3xl font-extrabold text-[#b06000]">{pendingRequestsCount}</p>
          <p className="mt-1 text-xs text-[#65716c]">Awaiting admin approval</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex border-b border-[#e9eeeb]">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "catalog"
              ? "border-[#176b55] text-[#176b55]"
              : "border-transparent text-[#65716c] hover:text-[#17211f]"
          }`}
        >
          ❖ Inventory Catalog ({filteredComponents.length})
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "requests"
              ? "border-[#176b55] text-[#176b55]"
              : "border-transparent text-[#65716c] hover:text-[#17211f]"
          }`}
        >
          📋 Component Requests ({requests.length})
          {pendingRequestsCount > 0 && (
            <span className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-xs font-bold text-[#b06000]">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("allocations")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "allocations"
              ? "border-[#176b55] text-[#176b55]"
              : "border-transparent text-[#65716c] hover:text-[#17211f]"
          }`}
        >
          🔄 Allocations & Usage ({allocations.length})
        </button>
      </div>

      {/* TAB 1: INVENTORY CATALOG */}
      {activeTab === "catalog" && (
        <div>
          {/* Filters & Search Bar */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 grid w-10 place-items-center text-sm text-[#89948f]">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, name, category, brand, model..."
                className="w-full rounded-xl border border-[#e9eeeb] bg-white py-2.5 pl-10 pr-4 text-sm text-[#17211f] transition focus:border-[#176b55] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-[#e9eeeb] bg-white px-3 py-2.5 text-sm text-[#17211f] transition focus:border-[#176b55] focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-[#e9eeeb] bg-white px-3 py-2.5 text-sm text-[#17211f] transition focus:border-[#176b55] focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="PARTIALLY_AVAILABLE">Partially Available</option>
                <option value="IN_USE">In Use</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </div>
          </div>

          {/* Component Catalog Grid */}
          {loading ? (
            <div className="py-12 text-center text-sm text-[#65716c]">Loading components inventory...</div>
          ) : filteredComponents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d1dcd7] p-12 text-center">
              <p className="text-base font-semibold text-[#17211f]">No components found</p>
              <p className="mt-1 text-sm text-[#89948f]">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredComponents.map((comp) => {
                const availPercent = comp.totalQuantity > 0 ? (comp.availableQuantity / comp.totalQuantity) * 100 : 0;
                return (
                  <div
                    key={comp.id}
                    className="flex flex-col rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm transition hover:border-[#b7dfd2] hover:shadow-md"
                  >
                    {/* Component Image Banner */}
                    {comp.imageUrl ? (
                      <div className="mb-4 h-44 w-full overflow-hidden rounded-xl bg-[#f8fbf9] border border-[#e9eeeb]">
                        <img
                          src={comp.imageUrl}
                          alt={comp.name}
                          className="h-full w-full object-cover transition duration-300 hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="mb-4 grid h-44 w-full place-items-center rounded-xl bg-[#f5f8f6] border border-[#e9eeeb]">
                        <span className="text-4xl text-[#a0aaa5]">❖</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-md bg-[#f1f5f3] px-2 py-0.5 text-[11px] font-bold text-[#50615a]">
                          {comp.componentCode}
                        </span>
                        <h3 className="mt-2 text-base font-bold text-[#17211f]">{comp.name}</h3>
                        <p className="text-xs text-[#89948f]">{comp.category} {comp.brand ? `· ${comp.brand}` : ""}</p>
                      </div>
                      {renderStatusBadge(comp.status)}
                    </div>

                    {comp.description && (
                      <p className="mt-3 line-clamp-2 text-xs text-[#65716c]">{comp.description}</p>
                    )}

                    {/* Stock & Availability Bar */}
                    <div className="mt-4 rounded-xl bg-[#f8fbf9] p-3 border border-[#edf3f0]">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#65716c]">Available Stock</span>
                        <span className="text-[#17211f]">
                          <strong className="text-[#137333]">{comp.availableQuantity}</strong> / {comp.totalQuantity} units
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e2e9e5]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            availPercent > 50 ? "bg-[#137333]" : availPercent > 0 ? "bg-[#b06000]" : "bg-[#c5221f]"
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, availPercent))}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#89948f]">
                        <span>In Use: {comp.allocatedQuantity}</span>
                        {comp.location && <span>📍 {comp.location}</span>}
                      </div>
                    </div>

                    {/* Component Card Footer / Actions */}
                    <div className="mt-5 flex items-center gap-2 border-t border-[#f0f4f2] pt-4">
                      <button
                        onClick={() => setShowDetailModal(comp)}
                        className="flex-1 rounded-xl border border-[#e9eeeb] py-2 text-xs font-semibold text-[#50615a] transition hover:border-[#176b55] hover:text-[#176b55]"
                      >
                        Details
                      </button>

                      {comp.availableQuantity > 0 && (
                        <button
                          onClick={() => {
                            setShowRequestModal(comp);
                            setRequestForm((prev) => ({ ...prev, requestedQuantity: 1 }));
                          }}
                          className="flex-1 rounded-xl bg-[#176b55] py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#125443]"
                        >
                          Request Use
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(comp)}
                            title="Edit Component"
                            className="rounded-xl border border-[#e9eeeb] p-2 text-xs font-semibold text-[#50615a] transition hover:bg-[#f5f7f6]"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteComponent(comp)}
                            title="Archive Component"
                            className="rounded-xl border border-[#e9eeeb] p-2 text-xs font-semibold text-[#c5221f] transition hover:bg-[#fce8e6]"
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
        </div>
      )}

      {/* TAB 2: COMPONENT REQUESTS */}
      {activeTab === "requests" && (
        <div className="rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
          <div className="border-b border-[#e9eeeb] p-5">
            <h2 className="text-base font-bold text-[#17211f]">
              {isAdmin ? "All Component Access Requests" : "My Component Requests"}
            </h2>
            <p className="mt-0.5 text-xs text-[#65716c]">
              {isAdmin
                ? "Review and approve/reject user requests for component allocations."
                : "Track the status of your component requests."}
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#89948f]">No component requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fbf9] text-[11px] uppercase tracking-wider text-[#89948f]">
                  <tr>
                    <th className="px-5 py-3">Component</th>
                    <th className="px-5 py-3">Requester</th>
                    <th className="px-5 py-3">Qty</th>
                    <th className="px-5 py-3">Purpose / Project</th>
                    <th className="px-5 py-3">Dates</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f0]">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#fcfdfc]">
                      <td className="px-5 py-4 font-semibold text-[#17211f]">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#f1f5f3] px-1.5 py-0.5 text-[10px] font-bold text-[#50615a]">
                            {req.component.componentCode}
                          </span>
                          <span>{req.component.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="block font-medium text-[#17211f]">{req.requester.fullName}</span>
                        <span className="text-[10px] text-[#89948f]">{req.requester.memberCode}</span>
                      </td>
                      <td className="px-5 py-4 font-bold text-[#176b55]">{req.requestedQuantity}</td>
                      <td className="px-5 py-4 max-w-xs">
                        <p className="line-clamp-2 text-[#50615a]">{req.purpose}</p>
                        {req.project && (
                          <span className="mt-1 inline-block text-[10px] font-semibold text-[#176b55]">
                            Project: {req.project.projectCode}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[#89948f]">
                        {req.expectedStartDate ? new Date(req.expectedStartDate).toLocaleDateString() : "Immediate"}
                        {req.expectedEndDate ? ` → ${new Date(req.expectedEndDate).toLocaleDateString()}` : ""}
                      </td>
                      <td className="px-5 py-4">{renderStatusBadge(req.status)}</td>
                      <td className="px-5 py-4 text-right">
                        {isAdmin && req.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setReviewModal({ request: req, action: "approve" })}
                              className="rounded-lg bg-[#137333] px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-[#0f5c29]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setReviewModal({ request: req, action: "reject" })}
                              className="rounded-lg bg-[#c5221f] px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-[#9e1b18]"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {!isAdmin && req.status === "PENDING" && req.requestedBy === user?.id && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            className="rounded-lg border border-[#e9eeeb] px-3 py-1.5 font-semibold text-[#c5221f] transition hover:bg-[#fce8e6]"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALLOCATIONS & USAGE */}
      {activeTab === "allocations" && (
        <div className="rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
          <div className="border-b border-[#e9eeeb] p-5">
            <h2 className="text-base font-bold text-[#17211f]">Active Allocations & Component Usage History</h2>
            <p className="mt-0.5 text-xs text-[#65716c]">
              Track currently deployed units and released component history.
            </p>
          </div>

          {allocations.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#89948f]">No component allocations found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fbf9] text-[11px] uppercase tracking-wider text-[#89948f]">
                  <tr>
                    <th className="px-5 py-3">Component</th>
                    <th className="px-5 py-3">Allocated To</th>
                    <th className="px-5 py-3">Project / Team</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Start Date</th>
                    <th className="px-5 py-3">Return Status</th>
                    {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f0]">
                  {allocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-[#fcfdfc]">
                      <td className="px-5 py-4 font-semibold text-[#17211f]">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#f1f5f3] px-1.5 py-0.5 text-[10px] font-bold text-[#50615a]">
                            {alloc.component.componentCode}
                          </span>
                          <span>{alloc.component.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {alloc.user ? (
                          <div>
                            <span className="block font-medium text-[#17211f]">{alloc.user.fullName}</span>
                            <span className="text-[10px] text-[#89948f]">{alloc.user.memberCode}</span>
                          </div>
                        ) : (
                          <span className="text-[#89948f]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {alloc.project ? (
                          <span className="font-medium text-[#176b55]">Project: {alloc.project.title}</span>
                        ) : alloc.team ? (
                          <span className="font-medium text-[#1a73e8]">Team: {alloc.team.name}</span>
                        ) : (
                          <span className="text-[#89948f]">General Lab Use</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-bold text-[#17211f]">{alloc.quantity} units</td>
                      <td className="px-5 py-4 text-[#89948f]">
                        {new Date(alloc.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        {renderStatusBadge(alloc.status)}
                        {alloc.actualReturnDate && (
                          <span className="block text-[10px] text-[#89948f]">
                            Returned: {new Date(alloc.actualReturnDate).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          {alloc.status === "ACTIVE" && (
                            <button
                              onClick={() => setReturnModal(alloc)}
                              className="rounded-lg bg-[#176b55] px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-[#125443]"
                            >
                              Mark Returned
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD COMPONENT (ADMIN) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e9eeeb] pb-4">
              <h2 className="text-lg font-bold text-[#17211f]">Add New Component to Inventory</h2>
              <button onClick={() => setShowAddModal(false)} className="text-xl text-[#89948f] hover:text-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateComponent} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#17211f]">Component Code (Auto-generated)</label>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateCode(addComponentForm.name, addComponentForm.category)}
                      className="text-[11px] font-semibold text-[#176b55] hover:underline"
                    >
                      ✨ Auto Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={addComponentForm.componentCode}
                    onChange={(e) => setAddComponentForm({ ...addComponentForm, componentCode: e.target.value })}
                    placeholder="e.g. RAS001 (Auto-generated if left blank)"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-[#89948f]">
                    Auto-generated groupwise prefix (e.g., Raspberry Pi → RAS001, ESP32 → ESP001)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Component Name *</label>
                  <input
                    type="text"
                    required
                    value={addComponentForm.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setAddComponentForm((prev) => {
                        const updated = { ...prev, name: newName };
                        // Auto-generate code if componentCode is empty or default
                        if (!prev.componentCode || prev.componentCode.match(/^[A-Z]{3}\d{3}$/i)) {
                          handleAutoGenerateCode(newName, prev.category);
                        }
                        return updated;
                      });
                    }}
                    placeholder="e.g. Raspberry Pi 4 Model B"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              {/* IMAGEBB FILE UPLOAD FIELD */}
              <div className="rounded-xl border border-dashed border-[#b7dfd2] bg-[#f8fbf9] p-4">
                <label className="block text-xs font-semibold text-[#176b55]">
                  📷 Upload Component Photo (Converts to ImageBB Link)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageFileUpload(file, (url) =>
                        setAddComponentForm((prev) => ({ ...prev, imageUrl: url }))
                      );
                    }
                  }}
                  className="mt-2 block w-full text-xs text-[#50615a] file:mr-4 file:rounded-xl file:border-0 file:bg-[#176b55] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#125443]"
                />
                {uploadingImage && (
                  <p className="mt-2 text-xs font-medium text-[#176b55] animate-pulse">
                    ⚡ Uploading image to ImageBB...
                  </p>
                )}

                {addComponentForm.imageUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={addComponentForm.imageUrl}
                      alt="Uploaded preview"
                      className="size-14 rounded-lg border border-[#e9eeeb] object-cover bg-white"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold text-[#137333]">✓ ImageBB Link Generated:</span>
                      <span className="block truncate text-[11px] text-[#50615a] font-mono">{addComponentForm.imageUrl}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Category *</label>
                  <input
                    type="text"
                    required
                    value={addComponentForm.category}
                    onChange={(e) => setAddComponentForm({ ...addComponentForm, category: e.target.value })}
                    placeholder="e.g. Microcontrollers, Sensors, Motors"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Total Inventory Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={addComponentForm.totalQuantity}
                    onChange={(e) => setAddComponentForm({ ...addComponentForm, totalQuantity: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17211f]">Description</label>
                <textarea
                  rows={2}
                  value={addComponentForm.description}
                  onChange={(e) => setAddComponentForm({ ...addComponentForm, description: e.target.value })}
                  placeholder="Technical details, specifications..."
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Brand</label>
                  <input
                    type="text"
                    value={addComponentForm.brand}
                    onChange={(e) => setAddComponentForm({ ...addComponentForm, brand: e.target.value })}
                    placeholder="e.g. Espressif"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Model</label>
                  <input
                    type="text"
                    value={addComponentForm.model}
                    onChange={(e) => setAddComponentForm({ ...addComponentForm, model: e.target.value })}
                    placeholder="e.g. WROOM-32"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Location</label>
                  <input
                    type="text"
                    value={addComponentForm.location}
                    onChange={(e) => setAddComponentForm({ ...addComponentForm, location: e.target.value })}
                    placeholder="e.g. Cabinet B, Shelf 3"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e9eeeb] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-[#e9eeeb] px-4 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="rounded-xl bg-[#176b55] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125443] disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Component"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT COMPONENT (ADMIN) */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e9eeeb] pb-4">
              <h2 className="text-lg font-bold text-[#17211f]">Edit Component: {showEditModal.componentCode}</h2>
              <button onClick={() => setShowEditModal(null)} className="text-xl text-[#89948f] hover:text-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleEditComponent} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Component Name *</label>
                  <input
                    type="text"
                    required
                    value={editComponentForm.name}
                    onChange={(e) => setEditComponentForm({ ...editComponentForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Category *</label>
                  <input
                    type="text"
                    required
                    value={editComponentForm.category}
                    onChange={(e) => setEditComponentForm({ ...editComponentForm, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              {/* IMAGEBB FILE UPLOAD FIELD FOR EDIT */}
              <div className="rounded-xl border border-dashed border-[#b7dfd2] bg-[#f8fbf9] p-4">
                <label className="block text-xs font-semibold text-[#176b55]">
                  📷 Change Component Photo (ImageBB Upload)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageFileUpload(file, (url) =>
                        setEditComponentForm((prev) => ({ ...prev, imageUrl: url }))
                      );
                    }
                  }}
                  className="mt-2 block w-full text-xs text-[#50615a] file:mr-4 file:rounded-xl file:border-0 file:bg-[#176b55] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#125443]"
                />
                {uploadingImage && (
                  <p className="mt-2 text-xs font-medium text-[#176b55] animate-pulse">
                    ⚡ Uploading new image to ImageBB...
                  </p>
                )}

                {editComponentForm.imageUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={editComponentForm.imageUrl}
                      alt="Uploaded preview"
                      className="size-14 rounded-lg border border-[#e9eeeb] object-cover bg-white"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold text-[#137333]">✓ ImageBB Link Active:</span>
                      <span className="block truncate text-[11px] text-[#50615a] font-mono">{editComponentForm.imageUrl}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17211f]">
                  Total Quantity * (Min: {showEditModal.allocatedQuantity} currently allocated)
                </label>
                <input
                  type="number"
                  min={showEditModal.allocatedQuantity}
                  required
                  value={editComponentForm.totalQuantity}
                  onChange={(e) => setEditComponentForm({ ...editComponentForm, totalQuantity: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17211f]">Description</label>
                <textarea
                  rows={2}
                  value={editComponentForm.description}
                  onChange={(e) => setEditComponentForm({ ...editComponentForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Location</label>
                  <input
                    type="text"
                    value={editComponentForm.location}
                    onChange={(e) => setEditComponentForm({ ...editComponentForm, location: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Brand / Model</label>
                  <input
                    type="text"
                    value={editComponentForm.brand}
                    onChange={(e) => setEditComponentForm({ ...editComponentForm, brand: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e9eeeb] pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="rounded-xl border border-[#e9eeeb] px-4 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="rounded-xl bg-[#176b55] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125443] disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REQUEST COMPONENT (USER) */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e9eeeb] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#17211f]">Request Component Access</h2>
                <p className="text-xs text-[#89948f]">{showRequestModal.name} ({showRequestModal.componentCode})</p>
              </div>
              <button onClick={() => setShowRequestModal(null)} className="text-xl text-[#89948f] hover:text-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17211f]">
                  Requested Quantity * (Available: {showRequestModal.availableQuantity})
                </label>
                <input
                  type="number"
                  min="1"
                  max={showRequestModal.availableQuantity}
                  required
                  value={requestForm.requestedQuantity}
                  onChange={(e) => setRequestForm({ ...requestForm, requestedQuantity: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17211f]">Purpose / Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={requestForm.purpose}
                  onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
                  placeholder="Explain why you need this component..."
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17211f]">Associated Project (Optional)</label>
                <select
                  value={requestForm.projectId}
                  onChange={(e) => setRequestForm({ ...requestForm, projectId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] bg-white p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                >
                  <option value="">None / Independent Research</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Expected Start Date</label>
                  <input
                    type="date"
                    value={requestForm.expectedStartDate}
                    onChange={(e) => setRequestForm({ ...requestForm, expectedStartDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Expected Return Date</label>
                  <input
                    type="date"
                    value={requestForm.expectedEndDate}
                    onChange={(e) => setRequestForm({ ...requestForm, expectedEndDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e9eeeb] pt-4">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(null)}
                  className="rounded-xl border border-[#e9eeeb] px-4 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#176b55] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125443] disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REVIEW REQUEST (APPROVE/REJECT ADMIN) */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#17211f]">
              {reviewModal.action === "approve" ? "Approve" : "Reject"} Request
            </h2>
            <p className="mt-1 text-xs text-[#65716c]">
              Request for {reviewModal.request.requestedQuantity}x {reviewModal.request.component.name} by{" "}
              {reviewModal.request.requester.fullName}
            </p>

            <form onSubmit={handleReviewRequest} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17211f]">
                  Review Note / Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={
                    reviewModal.action === "approve"
                      ? "e.g. Approved for Smart Lab setup..."
                      : "e.g. Insufficient allocation justification..."
                  }
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e9eeeb] pt-4">
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  className="rounded-xl border border-[#e9eeeb] px-4 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                    reviewModal.action === "approve" ? "bg-[#137333] hover:bg-[#0f5c29]" : "bg-[#c5221f] hover:bg-[#9e1b18]"
                  }`}
                >
                  {submitting ? "Processing..." : reviewModal.action === "approve" ? "Approve Request" : "Reject Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: RETURN ALLOCATION (ADMIN) */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#17211f]">Mark Component Allocation as Returned</h2>
            <p className="mt-1 text-xs text-[#65716c]">
              Release {returnModal.quantity}x {returnModal.component.name} back to available inventory.
            </p>

            <form onSubmit={handleReturnAllocation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17211f]">Return Condition / Note</label>
                <textarea
                  rows={3}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Component returned in good working condition..."
                  className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e9eeeb] pt-4">
                <button
                  type="button"
                  onClick={() => setReturnModal(null)}
                  className="rounded-xl border border-[#e9eeeb] px-4 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#176b55] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125443] disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Confirm Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: COMPONENT DETAILS DRAWER */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-[#e9eeeb] pb-4">
              <div>
                <span className="rounded bg-[#f1f5f3] px-2 py-0.5 text-xs font-bold text-[#50615a]">
                  {showDetailModal.componentCode}
                </span>
                <h2 className="mt-1 text-xl font-bold text-[#17211f]">{showDetailModal.name}</h2>
                <p className="text-xs text-[#89948f]">{showDetailModal.category}</p>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="text-xl text-[#89948f] hover:text-black">
                ✕
              </button>
            </div>

            {showDetailModal.imageUrl && (
              <div className="mt-4 h-56 w-full overflow-hidden rounded-xl bg-[#f8fbf9] border border-[#e9eeeb]">
                <img
                  src={showDetailModal.imageUrl}
                  alt={showDetailModal.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#f8fbf9] p-4 text-center border border-[#edf3f0]">
                <div>
                  <span className="block text-[10px] text-[#89948f]">Total</span>
                  <strong className="text-base text-[#17211f]">{showDetailModal.totalQuantity}</strong>
                </div>
                <div>
                  <span className="block text-[10px] text-[#89948f]">Available</span>
                  <strong className="text-base text-[#137333]">{showDetailModal.availableQuantity}</strong>
                </div>
                <div>
                  <span className="block text-[10px] text-[#89948f]">In Use</span>
                  <strong className="text-base text-[#1a73e8]">{showDetailModal.allocatedQuantity}</strong>
                </div>
              </div>

              {showDetailModal.description && (
                <div>
                  <h4 className="font-semibold text-[#17211f]">Description</h4>
                  <p className="mt-1 text-[#65716c] leading-relaxed">{showDetailModal.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#e9eeeb] p-3">
                <div>
                  <span className="text-[#89948f]">Brand:</span>{" "}
                  <span className="font-semibold text-[#17211f]">{showDetailModal.brand || "—"}</span>
                </div>
                <div>
                  <span className="text-[#89948f]">Model:</span>{" "}
                  <span className="font-semibold text-[#17211f]">{showDetailModal.model || "—"}</span>
                </div>
                <div>
                  <span className="text-[#89948f]">Location:</span>{" "}
                  <span className="font-semibold text-[#17211f]">{showDetailModal.location || "—"}</span>
                </div>
                <div>
                  <span className="text-[#89948f]">Condition:</span>{" "}
                  <span className="font-semibold text-[#17211f]">{showDetailModal.condition || "GOOD"}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailModal(null)}
                className="rounded-xl border border-[#e9eeeb] px-5 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
