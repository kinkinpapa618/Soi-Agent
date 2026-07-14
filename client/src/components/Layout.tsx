import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, CheckSquare, Calendar, Menu, Volume2, VolumeX, Settings, LogOut, Bell, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationContext } from "@/hooks/notification-context";
import MiniCalendar from "@/components/MiniCalendar";

const NAV_ITEMS = [
  { href: "/", label: "Trợ Lý AI", icon: MessageSquare },
  { href: "/tasks", label: "Công việc", icon: CheckSquare },
  { href: "/calendar", label: "Lịch", icon: Calendar },
  { href: "/categories", label: "Danh mục", icon: Tags },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem("soi_autospeak") !== "false");
  const { user, logout } = useAuth();
  const { permission, requestPermission, unreadCount } = useNotificationContext();

  useEffect(() => {
    const handler = () => setAutoSpeak(localStorage.getItem("soi_autospeak") !== "false");
    window.addEventListener("soi_autospeak_change", handler);
    return () => window.removeEventListener("soi_autospeak_change", handler);
  }, []);

  const toggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    localStorage.setItem("soi_autospeak", String(next));
    window.dispatchEvent(new Event("soi_autospeak_change"));
  };

  return (
    <div className="h-dvh min-h-dvh overflow-hidden bg-background flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 flex-col border-r border-white/[0.06] bg-[#0f1729] h-screen p-6">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg shadow-sky-500/30">
            <img src="/icon-512.png" alt="SÓI Task" className="w-full h-full object-cover" />
          </div>
          <div className="flex items-baseline gap-1">
            <h1 className="font-display text-3xl leading-none text-sky-500">SÓI</h1>
            <h1 className="font-display text-3xl leading-none text-white">Task</h1>
          </div>
        </div>

        {/* Notification Bell */}
        <div className="px-2 mb-4">
          {permission !== "granted" ? (
            <button
              onClick={requestPermission}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <Bell className="w-4 h-4" />
              Bật thông báo
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-white/40">
              <Bell className="w-4 h-4" />
              Thông báo
              {unreadCount > 0 && (
                <span className="ml-auto bg-pink-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href === "/calendar" && location.startsWith("/calendar"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
                <span className="font-sans font-semibold text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mini Calendar - below nav */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <MiniCalendar />
        </div>

        {/* User section - at bottom */}
        <div className="mt-auto pt-4 border-t border-white/[0.06] space-y-3">
          <button
            onClick={toggleAutoSpeak}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all",
              autoSpeak ? "bg-sky-500/20 text-sky-400" : "bg-white/[0.04] text-white/40"
            )}>
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {autoSpeak ? "Tự động đọc: BẬT" : "Tự động đọc: TẮT"}
          </button>

          {user && (
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 text-sm font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white truncate max-w-[120px]">{user.name}</p>
                  <p className="text-white/30 truncate max-w-[120px]">{user.email}</p>
                </div>
              </div>
              <button onClick={logout} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Đăng xuất">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-background/80 backdrop-blur-md sticky top-0 z-40 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow-md">
              <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-baseline gap-1">
                <h1 className="font-display text-xl leading-none text-sky-500">SÓI</h1>
                <h1 className="font-display text-xl leading-none text-foreground">Task</h1>
              </div>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-20 py-2">
                  {NAV_ITEMS.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                        className={cn("flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                          isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground")}>
                        <item.icon className="w-5 h-5" /><span>{item.label}</span>
                      </Link>
                    );
                  })}
                  <div className="border-t border-border mt-1 pt-1">
                    <button onClick={logout}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:text-destructive w-full transition-colors">
                      <LogOut className="w-5 h-5" /><span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full" style={{ maxHeight: "100%" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
