const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

export interface SessionUser {
  id: string;
  organizationId: string;
  memberCode: string;
  email: string;
  firstName?: string;
  lastName?: string | null;
  fullName: string;
  profileImageUrl: string | null;
  phone?: string | null;
  bio?: string | null;
  organization: { id: string; name: string; slug: string; logoUrl: string | null; bgImageUrl?: string | null; accentColor?: string | null; loginBgImageUrl?: string | null; loginBgOpacity?: number | null };
  roles: string[];
  permissions: string[];
  skills: Array<{ id: string; name: string; category: string | null; proficiency: string | null; yearsExperience: number | null }>;
  researchAreas: Array<{ id: string; name: string; proficiency: string | null }>;
}

export interface ProjectTeamMember {
  id: string;
  userId: string;
  membershipRole: string | null;
  user: {
    id: string;
    memberCode: string;
    fullName: string;
    email: string;
    profileImageUrl?: string | null;
  };
}

export interface ProjectTeamItem {
  id: string;
  teamCode: string;
  name: string;
  teamLeader?: {
    id: string;
    memberCode: string;
    fullName: string;
    email: string;
  } | null;
  members?: ProjectTeamMember[];
  _count?: { members: number };
}

export interface ProjectSummary {
  id: string;
  projectCode: string;
  title: string;
  description: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | "ARCHIVED";
  progressPercent: number | string;
  owner: { id: string; memberCode: string; fullName: string; email?: string } | null;
  teams: Array<{ team: ProjectTeamItem }>;
  members?: Array<{
    user: {
      id: string;
      memberCode: string;
      fullName: string;
      email: string;
      profileImageUrl?: string | null;
    };
  }>;
  _count: { members: number; papers: number; assignments: number };
}

export interface TaskSummary {
  id: string;
  taskCode: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  progressPercent: number | string;
  project: { id: string; projectCode: string; title: string } | null;
  team: { id: string; teamCode: string; name: string } | null;
}

export interface NoticeSummary {
  id: string;
  title: string;
  content: string;
  priority: "URGENT" | "IMPORTANT" | "NORMAL";
  scope: "CENTRAL" | "TEAM" | "INDIVIDUAL";
  publishAt: string;
  expiresAt: string | null;
  requiresAcknowledgement: boolean;
  acknowledgedAt: string | null;
  author: { id: string; memberCode: string; fullName: string };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardData {
  metrics: { projects: number; teams: number; papers: number; openTasks: number; notices: number };
  projects: ProjectSummary[];
  tasks: TaskSummary[];
  notices: NoticeSummary[];
}

export interface ComponentItem {
  id: string;
  organizationId: string;
  componentCode: string;
  name: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  totalQuantity: number;
  availableQuantity: number;
  allocatedQuantity: number;
  status: "AVAILABLE" | "PARTIALLY_AVAILABLE" | "IN_USE" | "UNAVAILABLE";
  brand: string | null;
  model: string | null;
  unitPrice: number | string | null;
  purchaseDate: string | null;
  location: string | null;
  condition: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; memberCode: string; fullName: string };
  allocations?: ComponentAllocationItem[];
  requests?: ComponentRequestItem[];
  _count?: { requests: number; allocations: number };
}

export interface ComponentRequestItem {
  id: string;
  organizationId: string;
  componentId: string;
  requestedBy: string;
  projectId: string | null;
  requestedQuantity: number;
  purpose: string;
  expectedStartDate: string | null;
  expectedEndDate: string | null;
  additionalNote: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "RETURNED";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
  component: { id: string; componentCode: string; name: string; category: string; imageUrl: string | null };
  requester: { id: string; memberCode: string; fullName: string; email?: string };
  reviewer?: { id: string; memberCode: string; fullName: string } | null;
  project?: { id: string; projectCode: string; title: string } | null;
  allocation?: { id: string; status: string; startDate: string; expectedEndDate: string | null; actualReturnDate: string | null } | null;
}

export interface ComponentAllocationItem {
  id: string;
  organizationId: string;
  componentId: string;
  requestId: string | null;
  projectId: string | null;
  userId: string | null;
  teamId: string | null;
  quantity: number;
  startDate: string;
  expectedEndDate: string | null;
  actualReturnDate: string | null;
  status: "ACTIVE" | "RETURNED" | "CANCELLED";
  allocatedBy: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  component: { id: string; componentCode: string; name: string; category: string; imageUrl: string | null };
  user?: { id: string; memberCode: string; fullName: string; email?: string } | null;
  team?: { id: string; teamCode: string; name: string } | null;
  project?: { id: string; projectCode: string; title: string } | null;
  allocator?: { id: string; memberCode: string; fullName: string } | null;
}

export interface FinancialSummaryData {
  totalFund: number;
  totalExpense: number;
  currentBalance: number;
  fundCount: number;
  expenseCount: number;
  categoryBreakdown: Array<{ category: string; totalSpent: number; count: number }>;
  projectExpenses: Array<{ projectId: string | null; project?: { id: string; projectCode: string; title: string } | null; totalSpent: number; count: number }>;
}

export interface FundItem {
  id: string;
  organizationId: string;
  fundCode: string;
  contributorName: string;
  contributorUserId: string | null;
  amount: number | string;
  date: string;
  purpose: string;
  paymentMethod: string;
  receiptUrl: string | null;
  notes: string | null;
  status: "VALID" | "VOIDED";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  contributorUser?: { id: string; memberCode: string; fullName: string } | null;
  creator?: { id: string; memberCode: string; fullName: string };
}

export interface ExpenseItem {
  id: string;
  organizationId: string;
  expenseCode: string;
  title: string;
  category: string;
  amount: number | string;
  date: string;
  projectId: string | null;
  vendor: string | null;
  receiptUrl: string | null;
  description: string | null;
  status: "VALID" | "VOIDED";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; projectCode: string; title: string } | null;
  creator?: { id: string; memberCode: string; fullName: string };
}

export interface TransactionItem {
  id: string;
  code: string;
  type: "FUND" | "EXPENSE";
  title: string;
  category: string;
  amount: number;
  date: string;
  status: "VALID" | "VOIDED";
  receiptUrl: string | null;
  notes: string | null;
  projectTitle?: string;
  creatorName: string;
}

export class ApiError extends Error {
  constructor(
    public override message: string,
    public code?: string,
    public details?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string; details?: any };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("session_token") : null;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("API server-এ সংযোগ করা যাচ্ছে না। API চালু আছে কি না দেখুন।");
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    if (response.status === 503) {
      throw new ApiError("Database এখনো প্রস্তুত নয়। PostgreSQL DATABASE_URL configure করুন।");
    }
    if (response.status === 401) {
      if (typeof window !== "undefined" && path === "/auth/me") {
        localStorage.removeItem("session_token");
      }
      throw new ApiError(path === "/auth/me" ? "আপনার session শেষ হয়েছে। আবার sign in করুন।" : "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।");
    }
    const apiBody = body as any;
    const errorMessage =
      apiBody?.error?.message ??
      (Array.isArray(apiBody?.message) ? apiBody.message[0] : apiBody?.message) ??
      "অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।";

    throw new ApiError(
      errorMessage,
      apiBody?.error?.code ?? apiBody?.code,
      apiBody?.error?.details ?? apiBody?.details,
    );
  }
  if (!body?.success && body !== null) throw new ApiError("সার্ভার থেকে সঠিক response পাওয়া যায়নি।");
  return (body as any)?.data ?? body;
}

export const authApi = {
  me: () => apiRequest<{ user: SessionUser }>("/auth/me"),
  login: async (identifier: string, password: string) => {
    const data = await apiRequest<{ token?: string; user: SessionUser; expiresAt: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    if (data?.token && typeof window !== "undefined") {
      localStorage.setItem("session_token", data.token);
    }
    return data;
  },
  logout: async () => {
    try {
      return await apiRequest<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("session_token");
      }
    }
  },
};

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, payload: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(payload) });
}

export function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(payload) });
}

export function apiDelete<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "DELETE",
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
}

export function apiRequestMultipart<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("image", file);
  return apiRequest<T>(path, { method: "POST", body: form });
}
