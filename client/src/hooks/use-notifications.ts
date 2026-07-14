import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type NotificationEvent =
  | { type: "reminder"; taskId: number; title: string; dueDate: string }
  | { type: "overdue"; taskId: number; title: string; dueDate: string }
  | { type: "completed"; taskId: number; title: string }
  | { type: "created"; taskId: number; title: string }
  | { type: "status_change"; taskId: number; title: string; newStatus: string };

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotified = useRef<Map<string, number>>(new Map());
  const queryClient = useQueryClient();

  // Request permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      setPermission(Notification.permission as NotificationPermission);
    } else if ("Notification" in window) {
      setPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Show browser notification
  const notify = useCallback((event: NotificationEvent) => {
    if (permission !== "granted") return;

    const key = `${event.type}-${event.taskId}-${Date.now()}`;
    const lastKey = `${event.type}-${event.taskId}`;
    const last = lastNotified.current.get(lastKey);
    // Don't spam same notification within 5 minutes
    if (last && Date.now() - last < 5 * 60 * 1000) return;
    lastNotified.current.set(lastKey, Date.now());

    let title = "";
    let body = "";
    let icon = "/icon-512.png";

    switch (event.type) {
      case "reminder":
        title = "⏰ Nhắc nhở";
        body = `${event.title} - Hạn: ${new Date(event.dueDate).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" })}`;
        break;
      case "overdue":
        title = "⚠️ Quá hạn";
        body = `${event.title} - Đã quá hạn từ ${new Date(event.dueDate).toLocaleDateString("vi-VN")}`;
        break;
      case "completed":
        title = "✅ Hoàn thành";
        body = `${event.title}`;
        icon = "/icon-512.png";
        break;
      case "created":
        title = "📋 Công việc mới";
        body = event.title;
        break;
      case "status_change":
        const statusLabels: Record<string, string> = {
          pending: "Chưa làm",
          in_progress: "Đang làm",
          completed: "Đã xong",
          cancelled: "Đã hủy",
        };
        title = "🔄 Cập nhật";
        body = `${event.title} → ${statusLabels[event.newStatus] || event.newStatus}`;
        break;
    }

    setUnreadCount(c => c + 1);

    try {
      const n = new Notification(title, {
        body,
        icon,
        badge: "/icon-192.png",
        tag: key,
        data: { taskId: event.taskId },
        vibrate: [200, 100, 200],
        requireInteraction: true,
      });

      n.onclick = () => {
        n.close();
        setUnreadCount(c => Math.max(0, c - 1));
        window.focus();
        window.history.pushState({}, "", `/tasks/${event.taskId}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      };

      n.onclose = () => setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  }, [permission]);

  // Periodic reminder check
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000, // Check every 30s
  });

  // Check for reminders and overdue tasks
  useEffect(() => {
    if (permission !== "granted" || tasks.length === 0) return;

    const now = new Date();
    tasks.forEach((task: any) => {
      if (task.status === "completed" || task.status === "cancelled") return;

      // Check reminder
      if (task.reminderAt) {
        const remindTime = new Date(task.reminderAt);
        const diff = now.getTime() - remindTime.getTime();
        if (diff >= 0 && diff < 35 * 1000) { // Within 35s window
          notify({ type: "reminder", taskId: task.id, title: task.title, dueDate: task.dueDate });
        }
      }

      // Check overdue
      if (task.dueDate) {
        const dueTime = new Date(task.dueDate);
        const diff = now.getTime() - dueTime.getTime();
        if (diff >= 0 && diff < 35 * 1000) { // Just became overdue
          notify({ type: "overdue", taskId: task.id, title: task.title, dueDate: task.dueDate });
        }
      }
    });
  }, [tasks, permission, notify]);

  // Listen for task mutation success to show status change notifications
  const trackMutation = useCallback((event: NotificationEvent) => {
    notify(event);
  }, [notify]);

  return {
    permission,
    requestPermission,
    unreadCount,
    setUnreadCount,
    notify,
    trackMutation,
  };
}
