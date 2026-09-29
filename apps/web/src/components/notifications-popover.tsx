"use client";

import { useEffect, useState, useRef } from "react";
import { apiGet, apiPatch } from "@/lib/api-client";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  referenceId: string | null;
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const fetchNotifs = () => {
      apiGet<Notification[]>("/notifications").then((res) => {
        if (active) setNotifications(res || []);
      }).catch(console.error);
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // poll every 30s
    return () => { active = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await apiPatch(`/notifications/${id}/read`, {});
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllRead = async () => {
    try {
      await apiPatch("/notifications/read-all", {});
      setNotifications([]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative grid size-9 place-items-center rounded-full bg-[#f4f7f5] text-lg hover:bg-[#ebf0ee] transition-colors"
        title="Notifications"
      >
        <span>🔔</span>
        {notifications.length > 0 && (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 shadow-sm" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[#e9eeeb] bg-white shadow-xl shadow-black/5 z-50">
          <div className="flex items-center justify-between border-b border-[#edf0ee] p-4">
            <h3 className="text-sm font-semibold text-[#17211f]">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-medium text-[#4a9279] hover:text-[#176b55]"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#89948f]">
                You have no new notifications.
              </div>
            ) : (
              <ul className="divide-y divide-[#edf0ee]">
                {notifications.map((n) => (
                  <li key={n.id} className="p-4 hover:bg-[#f9fafa] transition-colors">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4a9279]">
                      {n.type.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#17211f]">{n.title}</p>
                    <p className="mt-1 text-xs text-[#65716c] line-clamp-2">{n.content}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-[#a0aaa5]">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-[11px] font-medium text-[#176b55]"
                      >
                        Mark as read
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
