import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, Circle, Trash2, Calendar, Clock, Pause } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500 bg-red-500/10",
  high: "text-orange-500 bg-orange-500/10",
  medium: "text-blue-500 bg-blue-500/10",
  low: "text-gray-400 bg-gray-500/10",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Khẩn",
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
};

const STATUS_BG: Record<string, string> = {
  pending: "bg-amber-50 border-amber-200/50",
  in_progress: "bg-blue-50 border-blue-200/50",
  completed: "bg-emerald-50 border-emerald-200/50",
  cancelled: "bg-red-50 border-red-200/50",
};

const STATUS_TABS = [
  { key: "", label: "Tất cả" },
  { key: "pending", label: "Chưa làm" },
  { key: "in_progress", label: "Đang làm" },
  { key: "completed", label: "Đã xong" },
];

export default function Tasks() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/tasks${params}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const createTask = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTitle("");
      setShowInput(false);
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createTask.mutate(newTitle.trim());
  };

  const getCategory = (catId: number | null) => categories.find((c: any) => c.id === catId);

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-full">
      <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
        <h2 className="text-xl md:text-2xl font-display font-bold">Công việc</h2>
        <button
          onClick={() => setShowInput(!showInput)}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Thêm
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleCreate} className="mb-4 shrink-0">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nhập tên công việc..."
              className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button type="submit" disabled={!newTitle.trim()}
              className="bg-primary text-primary-foreground rounded-xl px-5 py-3 text-base font-semibold disabled:opacity-50">
              Tạo
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto shrink-0">
        {STATUS_TABS.map((tab) => (
          <button key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all",
              statusFilter === tab.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Đang tải...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-base">Chưa có công việc nào</p>
            <p className="text-sm mt-1">Dùng chat AI để tạo nhanh bằng giọng nói</p>
          </div>
        ) : (
          tasks.map((task: any) => {
            const cat = getCategory(task.categoryId);
            const isDone = task.status === "completed";
            const isCancelled = task.status === "cancelled";
            const isInProgress = task.status === "in_progress";
            const statusBg = STATUS_BG[task.status] || "";

            return (
              <div key={task.id}
                className={cn(
                  "flex items-start gap-3 border rounded-xl p-3 md:p-4 transition-all group hover:shadow-md",
                  statusBg,
                  (isDone || isCancelled) && "opacity-60"
                )}>
                <button onClick={() => completeTask.mutate(task.id)}
                  disabled={isCancelled}
                  className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30">
                  {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> 
                    : isInProgress ? <Clock className="w-5 h-5 text-blue-500" />
                    : isCancelled ? <Pause className="w-5 h-5 text-red-400" />
                    : <Circle className="w-5 h-5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <Link href={`/tasks/${task.id}`}
                    className={cn("text-[15px] font-semibold hover:text-primary transition-colors cursor-pointer block",
                      isDone && "line-through text-muted-foreground",
                      isCancelled && "line-through text-muted-foreground"
                    )}>
                    {task.title}
                  </Link>
                  {task.description && (
                    <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md uppercase", PRIORITY_COLORS[task.priority] || "")}>
                      {PRIORITY_LABELS[task.priority] || task.priority}
                    </span>
                    {cat && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
                        {cat.icon} {cat.name}
                      </span>
                    )}
                    {task.startDate && task.dueDate && (() => {
                      const days = Math.round((new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) / 86400000) + 1;
                      if (days > 1) return <span className="text-[11px] text-pink-500 font-medium">📆 {days} ngày</span>;
                      return null;
                    })()}
                    {task.dueDate && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.dueDate).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                    {isInProgress && !isDone && (
                      <span className="text-[11px] text-blue-500 font-medium">Đang thực hiện</span>
                    )}
                  </div>
                </div>

                <button onClick={() => deleteTask.mutate(task.id)}
                  className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
