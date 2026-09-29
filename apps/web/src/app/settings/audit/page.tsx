"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { apiGet, authApi } from "@/lib/api-client";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  actor: { id: string; memberCode: string; fullName: string } | null;
}

interface AuditPageData {
  data: AuditLog[];
  meta: { total: number; page: number; totalPages: number };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditPageData | null>(null);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let active = true;
    authApi.me().then(({ user }) => {
      if (!active) return;
      const isAdmin = user.roles.some((role) => ["SUPER_ADMIN", "ADMIN"].includes(role));
      setCanManage(isAdmin);
      if (!isAdmin) {
        setError("You do not have permission to view audit logs.");
      }
    }).catch(() => setError("Session not found."));
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await apiGet<AuditPageData>("/audit?page=1&limit=100");
      setLogs(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit logs");
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      void load();
    }
  }, [canManage, load]);

  return (
    <AppShell title="Audit Logs">
      <Link href="/settings" className="text-xs font-medium text-[#4a9279] hover:text-[#176b55]">← Back to settings</Link>
      
      <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4a9279]">ORGANIZATION SECURITY</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">Audit Logs<span className="text-[#4a9279]">.</span></h1>
          <p className="mt-2 text-sm text-[#7c8782]">Monitor activity and security events across your organization.</p>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs text-[#a3493a]">{error}</p>}

      <section className="mt-8 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0ee] p-5">
          <div>
            <h2 className="text-sm font-semibold">Activity logs</h2>
            <p className="mt-1 text-[11px] text-[#89948f]">
              {logs ? `${logs.meta.total} total events` : "Loading logs…"}
            </p>
          </div>
        </div>

        {!canManage ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold">Access restricted</p>
            <p className="mt-2 text-xs text-[#89948f]">Only administrators can view the organization audit logs.</p>
          </div>
        ) : !logs ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((x) => <div key={x} className="h-16 animate-pulse rounded-xl bg-[#f7f9f8]" />)}
          </div>
        ) : logs.data.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold">No activity found</p>
            <p className="mt-2 text-xs text-[#89948f]">There are no recorded audit logs in the system yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#edf0ee]">
            {logs.data.map((log) => (
              <article key={log.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f4f7f5] px-2.5 py-1 text-[10px] font-semibold text-[#4a9279]">
                      {log.action}
                    </span>
                    <span className="text-[10px] font-semibold text-[#89948f]">{log.entity}</span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-[#17211f]">{log.entityId}</h3>
                  <p className="mt-1.5 text-[11px] text-[#65716c]">
                    Actor: <span className="font-semibold">{log.actor ? log.actor.fullName : "System"}</span> {log.actor ? `(${log.actor.memberCode})` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#89948f]">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
