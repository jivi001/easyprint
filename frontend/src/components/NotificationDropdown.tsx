import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { api } from "../services/api";
import { NotificationItem } from "../types";

export const NotificationDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch (_) {
      // Ignore background notification fetch errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 text-pe-text-secondary hover:text-pe-text rounded-full hover:bg-pe-surface-secondary transition-colors"
        title="In-app Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex min-h-4 min-w-4 px-1 items-center justify-center rounded-full bg-pe-danger text-xs font-bold text-white ring-2 ring-white tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-pe-md bg-pe-surface shadow-pe-popover border border-pe-border z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-pe-border-subtle bg-pe-surface-secondary">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-pe-text">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#EBF5FF] px-2 py-0.5 text-xs font-medium text-pe-accent tabular-nums">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-pe-accent hover:underline font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-pe-border-subtle">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-pe-text-secondary">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 text-xs transition-colors flex items-start justify-between gap-3 ${
                    notif.is_read ? "bg-pe-surface text-pe-text-secondary" : "bg-[#EBF5FF]/30 text-pe-text font-medium"
                  }`}
                >
                  <div className="flex-1">
                    <p className="leading-snug">{notif.message}</p>
                    <span className="text-xs text-pe-text-secondary/70 mt-1 block tabular-nums">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-pe-text-secondary hover:text-pe-accent p-1"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
