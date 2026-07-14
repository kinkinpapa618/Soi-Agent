import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, ChevronDown, Search, Menu, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = "Tháng 1,Tháng 2,Tháng 3,Tháng 4,Tháng 5,Tháng 6,Tháng 7,Tháng 8,Tháng 9,Tháng 10,Tháng 11,Tháng 12".split(",");
const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const COLORS = [
  "#e91e63", "#ff9800", "#4caf50", "#2196f3", "#9c27b0", "#00bcd4",
  "#ff5722", "#3f51b5", "#009688", "#8bc34a", "#ff6347", "#607d8b",
];

function colorForId(id: number) {
  return COLORS[(id * 7 + 3) % COLORS.length];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getStartDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isBetweenDays(day: Date, start: Date, end: Date) {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= s && d <= e;
}
function daysBetween(a: Date, b: Date) {
  const diff = b.getTime() - a.getTime();
  return Math.round(diff / (86400000)) + 1;
}

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [, navigate] = useLocation();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDay(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1 < 0 ? 11 : month - 1);

  const selectedTasks = useMemo(() => {
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
    }).sort((a: any, b: any) => (a.priority === "urgent" ? -1 : 1));
  }, [selectedDate, tasks]);

  const multiDayTasks = useMemo(() => {
    return tasks.filter((t: any) => t.startDate && t.dueDate && daysBetween(new Date(t.startDate), new Date(t.dueDate)) > 1);
  }, [tasks]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const cells: Array<{ day: number; date: Date; faded: boolean; isToday: boolean; isSelected: boolean; taskColors: string[]; taskIds: number[] }> = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    cells.push({ day: d, date: new Date(year, month - 1, d), faded: true, isToday: false, isSelected: false, taskColors: [], taskIds: [] });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = isSameDay(date, now);
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
    const dayTasks = tasks.filter((t: any) => {
      const tStart = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : null;
      const tEnd = t.dueDate ? new Date(t.dueDate) : t.startDate ? new Date(t.startDate) : null;
      if (!tEnd && !tStart) return false;
      if (tStart && tEnd) return isBetweenDays(date, tStart, tEnd);
      if (tStart) return isSameDay(date, tStart);
      return isBetweenDays(date, tStart!, tEnd!);
    });
    cells.push({ day: d, date, faded: false, isToday, isSelected, taskColors: dayTasks.map((t: any) => colorForId(t.id)), taskIds: dayTasks.map((t: any) => t.id) });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, date: new Date(year, month + 1, d), faded: true, isToday: false, isSelected: false, taskColors: [], taskIds: [] });
    }
  }

  // Build connecting line paths for multi-day tasks
  const linePaths: Array<{ path: string; color: string; taskId: number }> = [];
  const rowCount = Math.ceil(cells.length / 7);
  const cellW = 100 / 7;

  multiDayTasks.forEach((task: any) => {
    const tStart = new Date(task.startDate);
    const tEnd = new Date(task.dueDate);
    let startCol = -1, endCol = -1, startRow = -1, endRow = -1;
    let prevRow = -1;
    let segments: Array<{ row: number; day: number; date: Date }> = [];

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const row = Math.floor(i / 7);
      if (c.faded) continue;
      if (isBetweenDays(c.date, tStart, tEnd)) {
        if (startCol === -1) { startCol = i % 7; startRow = row; }
        endCol = i % 7; endRow = row;
        segments.push({ row, day: i % 7, date: c.date });
      }
    }

    if (segments.length < 2) return;

    const color = colorForId(task.id);

    segments.forEach((seg, idx) => {
      if (idx < segments.length - 1) {
        const next = segments[idx + 1];
        const x1 = (seg.day + 0.5) * cellW;
        const y1 = seg.row * 56 + 28;
        const x2 = (next.day + 0.5) * cellW;
        let y2 = next.row * 56 + 28;

        if (seg.row !== next.row) {
          // Connect end of row to start of next row
          y2 = y1 + 28;
          const d = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2} L ${x2} ${y2 - 28}`;
          linePaths.push({ path: d, color, taskId: task.id });
        } else {
          const d = `M ${x1} ${y1} L ${x2} ${y2}`;
          linePaths.push({ path: d, color, taskId: task.id });
        }
      }
    });
  });

  const calendarContent = (
    <>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: "white", fontSize: 16, fontWeight: 500 }}>{year} <ChevronDown style={{ fontSize: 11, display: "inline" }} /></span>
          <div style={{ display: "flex", gap: 12 }}>
            <Search style={{ color: "white", opacity: 0.6, width: 16, cursor: "pointer" }} />
            <Menu style={{ color: "white", opacity: 0.6, width: 16, cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", color: "white", opacity: 0.6, cursor: "pointer", padding: 4 }}>
            <ChevronLeft style={{ width: 18 }} />
          </button>
          <span style={{ color: "white", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
            {MONTHS[month].toUpperCase()}
          </span>
          <button onClick={nextMonth} style={{ background: "none", border: "none", color: "white", opacity: 0.6, cursor: "pointer", padding: 4 }}>
            <ChevronRight style={{ width: 18 }} />
          </button>
        </div>
      </div>

      {/* Day grid with SVG overlay for lines */}
      <div style={{ position: "relative", padding: "0 20px" }}>
        <svg style={{ position: "absolute", top: 0, left: 20, width: "calc(100% - 40px)", height: rowCount * 56, pointerEvents: "none", overflow: "visible" }}>
          {linePaths.map((lp, i) => (
            <path key={`${lp.taskId}-${i}`} d={lp.path} stroke={lp.color} strokeWidth={2.5} fill="none" opacity={0.6} strokeLinecap="round" />
          ))}
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", rowGap: 0, position: "relative", zIndex: 1 }}>
          {DAYS.map(d => (
            <div key={d} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, paddingTop: 2 }}>
              {d}
            </div>
          ))}
          {cells.map((c, i) => (
            <div key={i} style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", paddingBottom: c.faded ? 8 : 0 }}>
              {!c.faded ? (
                <button
                  onClick={() => {
                    setSelectedDate((prev: Date | null) => prev && isSameDay(c.date, prev) ? null : c.date);
                  }}
                  style={{
                    width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 500, cursor: "pointer", border: "none", transition: "0.2s",
                    background: c.isSelected ? "#e91e63" : "transparent",
                    color: c.isSelected ? "white" : c.isToday ? "#ffb74d" : c.faded ? "rgba(255,255,255,0.3)" : "white",
                    position: "relative",
                  }}
                >
                  {c.day}
                  {c.taskColors.length > 0 && !c.isSelected && (
                    <div style={{ position: "absolute", bottom: 3, display: "flex", gap: 2 }}>
                      {c.taskColors.slice(0, 3).map((tc, ti) => (
                        <div key={ti} style={{ width: 4, height: 4, borderRadius: "50%", background: tc }} />
                      ))}
                    </div>
                  )}
                </button>
              ) : (
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", padding: "8px 0" }}>{c.day}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const eventsContent = (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
        <span>
          {selectedDate
            ? `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`
            : "Chọn một ngày"}
        </span>
        <button onClick={goToday} style={{ color: "#e91e63", fontSize: 13, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
          Hôm nay
        </button>
      </div>

      {selectedTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
          <p style={{ fontSize: 13 }}>{selectedDate ? "Không có công việc nào trong ngày này" : "Chọn một ngày để xem công việc"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedTasks.map((task: any) => {
            const color = colorForId(task.id);
            const span = task.startDate && task.dueDate ? daysBetween(new Date(task.startDate), new Date(task.dueDate)) : 1;
            return (
              <Link key={task.id} href={`/tasks/${task.id}`} style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit" }}>
                <div style={{
                  width: 4, height: 44, borderRadius: 4, flexShrink: 0, marginRight: 14,
                  background: color,
                }} />
                <div style={{ minWidth: 70, marginRight: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                    {task.dueDate ? new Date(task.dueDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {span > 1 ? `${span} ngày` : task.estimatedMinutes ? `${task.estimatedMinutes}ph` : ""}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {task.priority === "urgent" ? "⚡ Khẩn cấp" : task.priority === "high" ? "🔴 Cao" : task.priority === "medium" ? "🔵 Vừa" : "⚪ Thấp"}
                    {span > 1 && task.startDate && task.dueDate && (
                      <> • {new Date(task.startDate).getDate()}/{new Date(task.startDate).getMonth()+1} → {new Date(task.dueDate).getDate()}/{new Date(task.dueDate).getMonth()+1}</>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-full">
      <h2 className="text-xl md:text-2xl font-display font-bold mb-4 shrink-0 md:hidden">Lịch</h2>

      {/* Mobile Layout */}
      <div className="flex-1 md:hidden overflow-y-auto min-h-0 rounded-2xl">
        <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1b3665)", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, padding: "20px 0 24px 0" }}>
          {calendarContent}
        </div>
        <div style={{ marginTop: -4, background: "#fff", borderRadius: "24px 24px 0 0", minHeight: 200 }}>
          {eventsContent}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 min-h-0 rounded-2xl overflow-hidden shadow-lg">
        <div style={{ width: "45%", background: "linear-gradient(135deg, #1e3a5f, #1b3665)", padding: "30px 20px", overflowY: "auto" }}>
          <h2 className="text-xl font-display font-bold text-white mb-6">Lịch</h2>
          {calendarContent}
        </div>
        <div style={{ width: "55%", background: "#fff", overflowY: "auto", paddingTop: 10 }}>
          {eventsContent}
        </div>
      </div>
    </div>
  );
}
