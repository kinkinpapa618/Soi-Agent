import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = "Thg 1,Thg 2,Thg 3,Thg 4,Thg 5,Thg 6,Thg 7,Thg 8,Thg 9,Thg 10,Thg 11,Thg 12".split(",");
const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isBetweenDays(day: Date, start: Date, end: Date) {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= s && d <= e;
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getStartDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function MiniCalendar() {
  const now = new Date();
  const [location, navigate] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get("date");

  const selectedDate = dateParam ? new Date(dateParam) : null;
  const initialYear = selectedDate ? selectedDate.getFullYear() : now.getFullYear();
  const initialMonth = selectedDate ? selectedDate.getMonth() : now.getMonth();

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30000,
  });

  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDay(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1 < 0 ? 11 : month - 1);

  const cells: Array<{ day: number; date: Date; faded: boolean; isToday: boolean; isSelected: boolean; hasTask: boolean }> = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    cells.push({ day: d, date: new Date(year, month - 1, d), faded: true, isToday: false, isSelected: false, hasTask: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = isSameDay(date, now);
    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
    const hasTask = tasks.some((t: any) => {
      const tStart = t.startDate ? new Date(t.startDate) : null;
      const tEnd = t.dueDate ? new Date(t.dueDate) : null;
      if (tStart && tEnd) return isBetweenDays(date, tStart, tEnd);
      if (tEnd) return isSameDay(date, tEnd);
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

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  function selectDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    navigate(`/calendar?date=${y}-${m}-${d}`);
  }

  function goToday() {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    setYear(y); setMonth(now.getMonth());
    navigate(`/calendar?date=${y}-${m}-${d}`);
  }

  return (
    <div className="px-1 py-2">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-0.5 hover:bg-white/10 rounded transition-colors">
          <ChevronLeft className="w-3.5 h-3.5 text-white/50" />
        </button>
        <span className="text-xs font-semibold text-white/80">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="p-0.5 hover:bg-white/10 rounded transition-colors">
          <ChevronRight className="w-3.5 h-3.5 text-white/50" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-[9px] text-white/30 font-medium py-0.5">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 text-center gap-y-0.5">
        {cells.map((c, i) => (
          <div key={i} className="flex justify-center">
            <button
              onClick={() => !c.faded && selectDate(c.date)}
              disabled={c.faded}
              style={{
                width: 26, height: 26, fontSize: 11, fontWeight: c.isToday ? 600 : 400,
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: c.faded ? "default" : "pointer", border: "none",
                background: c.isSelected ? "#e91e63" : "transparent",
                color: c.faded ? "rgba(255,255,255,0.15)" : c.isSelected ? "#fff" : c.isToday ? "#ffb74d" : "rgba(255,255,255,0.7)",
                position: "relative",
                transition: "0.15s",
                opacity: c.faded ? 0.3 : 1,
              }}
            >
              {c.day}
              {c.hasTask && !c.isSelected && (
                <div style={{ position: "absolute", bottom: 2, width: 3, height: 3, borderRadius: "50%", background: "#e91e63" }} />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Today button */}
      <button
        onClick={goToday}
        className="w-full mt-2 text-[10px] text-white/50 hover:text-white transition-colors py-1 rounded-lg hover:bg-white/5"
      >
        Hôm nay
      </button>
    </div>
  );
}
