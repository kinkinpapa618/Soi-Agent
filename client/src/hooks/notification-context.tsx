import { createContext, useContext, useCallback } from "react";
import { useNotifications, type NotificationEvent } from "@/hooks/use-notifications";

interface NotificationContextType {
  permission: NotificationPermission;
  requestPermission: () => Promise<boolean>;
  unreadCount: number;
  setUnreadCount: (n: number | ((c: number) => number)) => void;
  notify: (event: NotificationEvent) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const notifications = useNotifications();
  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotificationContext must be inside NotificationProvider");
  return ctx;
}
