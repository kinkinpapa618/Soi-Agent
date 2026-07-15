import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const DAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTHS = "Tháng 1,Tháng 2,Tháng 3,Tháng 4,Tháng 5,Tháng 6,Tháng 7,Tháng 8,Tháng 9,Tháng 10,Tháng 11,Tháng 12".split(",");
const COLORS = ["#e91e63", "#ff9800", "#4caf50", "#2196f3", "#9c27b0", "#00bcd4", "#ff5722", "#3f51b5", "#009688", "#8bc34a", "#ff6347", "#607d8b"];

const STATUS_BG: Record<string, string> = {
  pending: "bg-amber-100 border-amber-300/60",
  in_progress: "bg-blue-100 border-blue-300/60",
  completed: "bg-emerald-100 border-emerald-300/60",
  cancelled: "bg-red-100 border-red-300/60",
};

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
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getStartDay(year: number, month: number) { return new Date(year, month, 1).getDay(); }

function MobileCalendar({ selectedDate, onSelect, tasks }: { selectedDate: Date | null; onSelect: (d: Date) => void; tasks: any[] }) {
  const now = new Date();
  const initialYear = selectedDate ? selectedDate.getFullYear() : now.getFullYear();
  const initialMonth = selectedDate ? selectedDate.getMonth() : now.getMonth();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDay(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1 < 0 ? 11 : month - 1);

  const cells: Array<{ day: number; date: Date; faded: boolean; isToday: boolean; isSelected: boolean; hasTask: boolean }> = [];
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, date: new Date(year, month - 1, prevMonthDays - i), faded: true, isToday: false, isSelected: false, hasTask: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = isSameDay(date, now);
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
    const hasTask = tasks.some((t: any) => {
      const ts = t.startDate ? new Date(t.startDate) : null;
      const te = t.dueDate ? new Date(t.dueDate) : null;
      if (ts && te) return isBetweenDays(date, ts, te);
      if (te) return isSameDay(date, te);
      return false;
    });
    cells.push({ day: d, date, faded: false, isToday, isSelected, hasTask });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, date: new Date(year, month + 1, d), faded: true, isToday: false, isSelected: false, hasTask: false });
    }
  }

  const rowCount = Math.ceil(cells.length / 7);

  // Build multi-day task line paths
  const multiDayTasks = tasks.filter((t: any) => t.startDate && t.dueDate && daysBetween(new Date(t.startDate), new Date(t.dueDate)) > 1);
  const cellW = 100 / 7;
  const linePaths: Array<{ path: string; color: string }> = [];
  multiDayTasks.forEach((task: any) => {
    const tStart = new Date(task.startDate);
    const tEnd = new Date(task.dueDate);
    let segments: Array<{ row: number; col: number }> = [];
    cells.forEach((c, i) => {
      if (c.faded) return;
      if (isBetweenDays(c.date, tStart, tEnd)) {
        segments.push({ row: Math.floor(i / 7), col: i % 7 });
      }
    });
    const color = colorForId(task.id);
    for (let s = 0; s < segments.length - 1; s++) {
      const cur = segments[s], nxt = segments[s + 1];
      const x1 = (cur.col + 0.5) * cellW, y1 = cur.row * 48 + 24;
      const x2 = (nxt.col + 0.5) * cellW, y2 = nxt.row * 48 + 24;
      if (cur.row !== nxt.row) {
        linePaths.push({ path: `M ${x1} ${y1} L ${x1} ${y2 - 4} Q ${x2} ${y2 - 4} ${x2} ${y2}`, color });
      } else {
        linePaths.push({ path: `M ${x1} ${y1} L ${x2} ${y2}`, color });
      }
    }
  });

  function prevMonth() { month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1); }
  function nextMonth() { month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1); }

  return (
    <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1b3665)", borderRadius: "0 0 30px 30px", padding: "16px 16px 28px 16px", marginBottom: -4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", color: "white", opacity: 0.6, cursor: "pointer", padding: 6 }}>
          <ChevronLeft style={{ width: 18 }} />
        </button>
        <span style={{ color: "white", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{MONTHS[month].toUpperCase()} {year}</span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", color: "white", opacity: 0.6, cursor: "pointer", padding: 6 }}>
          <ChevronRight style={{ width: 18 }} />
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: rowCount * 48, pointerEvents: "none", overflow: "visible" }}>
          {linePaths.map((lp, i) => (
            <path key={i} d={lp.path} stroke={lp.color} strokeWidth={2.5} fill="none" opacity={0.5} strokeLinecap="round" />
          ))}
        </svg>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", gap: "4px 0", position: "relative", zIndex: 1 }}>
          {DAYS_SHORT.map(d => <div key={d} style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600, paddingBottom: 4 }}>{d}</div>)}
          {cells.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => !c.faded && onSelect(c.date)}
                disabled={c.faded}
                style={{
                  width: 36, height: 36, fontSize: 14, fontWeight: c.isToday ? 700 : 500,
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: c.faded ? "default" : "pointer", border: "none",
                  background: c.isSelected ? "#e91e63" : "transparent",
                  color: c.faded ? "rgba(255,255,255,0.15)" : c.isSelected ? "#fff" : c.isToday ? "#ffb74d" : "rgba(255,255,255,0.75)",
                  position: "relative", transition: "0.15s", opacity: c.faded ? 0.3 : 1,
                }}
              >
                {c.day}
                {c.hasTask && !c.isSelected && (
                  <div style={{ position: "absolute", bottom: 4, display: "flex", gap: 2 }}>
                    {Array.from({ length: Math.min(tasks.filter((t: any) => {
                      const ts = t.startDate ? new Date(t.startDate) : null;
                      const te = t.dueDate ? new Date(t.dueDate) : null;
                      if (ts && te) return isBetweenDays(c.date, ts, te);
                      if (te) return isSameDay(c.date, te);
                      return false;
                    }).length, 3) }).map((_, ti) => (
                      <div key={ti} style={{ width: 4, height: 4, borderRadius: "50%", background: "#e91e63" }} />
                    ))}
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const searchString = useSearch();
  const dateParam = new URLSearchParams(searchString).get("date");
  const selectedDate = dateParam ? new Date(dateParam) : null;
  const [, navigate] = useLocation();

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
      map.set(t.id, { task: t, span, position: pos });
    });
    return map;
  }, [selectedDate, tasks]);

  function handleMobileSelect(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    navigate(`/calendar?date=${y}-${m}-${d}`);
  }

  // Desktop: no date selected yet
  if (!selectedDate) {
    return (
      <div className="flex-1 flex flex-col min-h-0 max-h-full">
        {/* Mobile calendar */}
        <div className="md:hidden shrink-0">
          <MobileCalendar selectedDate={null} onSelect={handleMobileSelect} tasks={tasks} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-4">
          <div className="text-center text-muted-foreground">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-lg font-semibold mb-1 hidden md:block">Chọn một ngày</p>
            <p className="text-sm hidden md:block">Sử dụng lịch bên trái để xem công việc</p>
            <p className="text-sm md:hidden">Chọn một ngày phía trên để xem chi tiết</p>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  const eventsContent = (
    <>
      <div className="mb-5 shrink-0">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl md:text-3xl font-display font-bold">{DAYS[selectedDate.getDay()]}</h2>
          <span className="text-muted-foreground text-lg">
            {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </span>
          {isToday && <span className="bg-pink-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Hôm nay</span>}
        </div>
      </div>

      <div className="flex gap-3 md:gap-4 mb-5 shrink-0">
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

      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto">
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
                className={`block ${STATUS_BG[task.status] || "bg-card border-border"} rounded-xl p-4 transition-all hover:shadow-md hover:border-primary/20 group`}>
                <div className="flex items-start gap-3">
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
                      }`}>{task.priority === "urgent" ? "Khẩn" : task.priority === "high" ? "Cao" : task.priority === "medium" ? "Vừa" : "Thấp"}</span>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      {task.dueDate && <span>⏰ {new Date(task.dueDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>}
                      {task.estimatedMinutes && <span>📋 {task.estimatedMinutes} phút</span>}
                      {md && md.span > 1 && <span className="text-pink-500 font-medium">📆 {md.span} ngày</span>}
                      {isCompleted && <span className="text-emerald-500 font-medium">Đã xong</span>}
                      {isCancelled && <span className="text-destructive font-medium">Đã hủy</span>}
                    </div>
                  </div>
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
    </>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-full">
      {/* Mobile: Calendar at top */}
      <div className="md:hidden shrink-0">
        <MobileCalendar selectedDate={selectedDate} onSelect={handleMobileSelect} tasks={tasks} />
      </div>

      {/* Desktop: empty spacer for padding */}
      <div className="hidden md:flex flex-1 flex-col min-h-0 max-h-full overflow-y-auto">
        {eventsContent}
      </div>

      {/* Mobile: events below calendar */}
      <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-y-auto pt-4">
        {eventsContent}
      </div>
    </div>
  );
}
