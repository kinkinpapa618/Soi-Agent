import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const DAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const MONTHS = "Tháng 1,Tháng 2,Tháng 3,Tháng 4,Tháng 5,Tháng 6,Tháng 7,Tháng 8,Tháng 9,Tháng 10,Tháng 11,Tháng 12".split(",");
const COLORS = ["#e91e63", "#ff9800", "#4caf50", "#2196f3", "#9c27b0", "#00bcd4", "#ff5722", "#3f51b5", "#009688", "#8bc34a", "#ff6347", "#607d8b"];
function colorForId(id: number) { return COLORS[(id * 7 + 3) % COLORS.length]; }

function isBetweenDays(day: Date, start: Date, end: Date) {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= s && d <= e;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000) + 1; }

export default function Calendar() {
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get("date");
  const selectedDate = dateParam ? new Date(dateParam) : null;

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const todayTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter((t: any) => {
      const tStart = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : null;
      const tEnd = t.dueDate ? new Date(t.dueDate) : t.startDate ? new Date(t.startDate) : null;
      if (!tEnd && !tStart) return false;
      if (tStart && tEnd && isBetweenDays(selectedDate, tStart, tEnd)) return true;
      if (!tStart && tEnd && isSameDay(selectedDate, tEnd)) return true;
      if (tStart && !tEnd && isSameDay(selectedDate, tStart)) return true;
      if (tStart && tEnd) return isBetweenDays(selectedDate, tStart, tEnd);
      return false;
    }).sort((a: any, b: any) => {
      const p = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (p[a.priority as keyof typeof p] || 2) - (p[b.priority as keyof typeof p] || 2);
    });
  }, [selectedDate, tasks]);

  const overdueTasks = useMemo(() => {
    if (!selectedDate) return [];
    const now = new Date();
    return tasks.filter((t: any) => {
      if (t.status === "completed" || t.status === "cancelled") return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due < selectedDate && due < now;
    }).slice(0, 5);
  }, [selectedDate, tasks]);

  // Group multi-day tasks to show them with connecting visual
  const multiDay = useMemo(() => {
    if (!selectedDate) return new Map();
    const map = new Map<number, { task: any; span: number; position: "start" | "middle" | "end" | "single" }>();
    tasks.forEach((t: any) => {
      const tStart = t.startDate ? new Date(t.startDate) : null;
      const tEnd = t.dueDate ? new Date(t.dueDate) : null;
      if (!tStart || !tEnd) return;
      if (!isBetweenDays(selectedDate, tStart, tEnd)) return;
      const span = daysBetween(tStart, tEnd);
      if (span <= 1) return;
      let pos: "start" | "middle" | "end" | "single" = "middle";
      if (isSameDay(selectedDate, tStart)) pos = "start";
      if (isSameDay(selectedDate, tEnd)) pos = "end";
      if (span === 1) pos = "single";
      map.set(t.id, { task: t, span, position: pos });
    });
    return map;
  }, [selectedDate, tasks]);

  if (!selectedDate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="text-center text-muted-foreground">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-lg font-semibold mb-1">Chọn một ngày</p>
          <p className="text-sm">Sử dụng lịch bên trái để xem công việc</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-full overflow-y-auto">
      {/* Date Header */}
      <div className="mb-6 shrink-0">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            {DAYS[selectedDate.getDay()]}
          </h2>
          <span className="text-muted-foreground text-lg">
            {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </span>
          {isToday && (
            <span className="bg-pink-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Hôm nay</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-6 shrink-0">
        <div className="bg-card border border-border rounded-xl px-4 py-3 min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Công việc</p>
          <p className="text-xl font-bold">{todayTasks.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Đã xong</p>
          <p className="text-xl font-bold text-emerald-500">{todayTasks.filter((t: any) => t.status === "completed").length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Còn lại</p>
          <p className="text-xl font-bold text-amber-500">{todayTasks.filter((t: any) => t.status !== "completed" && t.status !== "cancelled").length}</p>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 min-h-0 space-y-3">
        {todayTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-semibold">Không có công việc nào</p>
            <p className="text-sm mt-1">Dùng chat AI để thêm công việc mới</p>
          </div>
        ) : (
          todayTasks.map((task: any) => {
            const color = colorForId(task.id);
            const isCompleted = task.status === "completed";
            const isCancelled = task.status === "cancelled";
            const md = multiDay.get(task.id);

            return (
              <Link key={task.id} href={`/tasks/${task.id}`}
                className="block bg-card border border-border rounded-xl p-4 transition-all hover:shadow-md hover:border-primary/20 group">
                <div className="flex items-start gap-3">
                  {/* Color bar with multi-day indicator */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-0">
                    <div style={{
                      width: 3, height: md ? (md.position === "start" ? 20 : md.position === "end" ? 12 : 20) : 36,
                      borderRadius: 3, background: color,
                      borderTopLeftRadius: md?.position === "middle" ? 0 : 3,
                      borderTopRightRadius: md?.position === "middle" ? 0 : 3,
                      borderBottomLeftRadius: md?.position === "middle" ? 0 : 3,
                      borderBottomRightRadius: md?.position === "middle" ? 0 : 3,
                    }} />
                    {md && md.position !== "end" && (
                      <div style={{ width: 2, height: 8, background: color, opacity: 0.4 }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold ${(isCompleted || isCancelled) ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                        task.priority === "urgent" ? "text-red-500 bg-red-500/10" :
                        task.priority === "high" ? "text-orange-500 bg-orange-500/10" :
                        task.priority === "medium" ? "text-blue-500 bg-blue-500/10" :
                        "text-gray-400 bg-gray-500/10"
                      }`}>
                        {task.priority === "urgent" ? "Khẩn" : task.priority === "high" ? "Cao" : task.priority === "medium" ? "Vừa" : "Thấp"}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      {task.dueDate && (
                        <span>⏰ {new Date(task.dueDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                      {task.estimatedMinutes && (
                        <span>📋 {task.estimatedMinutes} phút</span>
                      )}
                      {md && md.span > 1 && (
                        <span className="text-pink-500 font-medium">📆 {md.span} ngày</span>
                      )}
                      {isCompleted && <span className="text-emerald-500 font-medium">Đã xong</span>}
                      {isCancelled && <span className="text-destructive font-medium">Đã hủy</span>}
                    </div>
                  </div>

                  {/* Arrow on hover */}
                  <div className="flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M8 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
