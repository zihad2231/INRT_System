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
  organization: { id: string; name: string; slug: string; logoUrl: string | null };
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
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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
  login: (identifier: string, password: string) =>
    apiRequest<{ user: SessionUser; expiresAt: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  logout: () =>
    apiRequest<{ loggedOut: boolean }>("/auth/logout", { method: "POST" }),
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
