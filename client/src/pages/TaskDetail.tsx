import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Pencil, Trash2, RotateCcw, Save, X, Calendar, Clock, AlertTriangle, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500 bg-red-500/10 border-red-500/20",
  high: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  medium: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  low: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Chưa làm", icon: Circle },
  { value: "in_progress", label: "Đang làm", icon: Clock },
  { value: "completed", label: "Đã xong", icon: CheckCircle2 },
  { value: "cancelled", label: "Đã hủy", icon: X },
];

const ACTIVITY_LABELS: Record<string, string> = {
  created: "đã tạo công việc",
  updated: "đã cập nhật",
  completed: "đã hoàn thành",
  reopened: "đã mở lại",
  reminded: "đã nhắc nhở",
};

export default function TaskDetail() {
  const [, params] = useRoute("/tasks/:id");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", params?.id],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${params?.id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!params?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const updateTask = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/tasks/${params?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setEditMode(false);
    },
  });

  const completeTask = useMutation({
    mutationFn: async () => {
      await fetch(`/api/tasks/${params?.id}/complete`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      await fetch(`/api/tasks/${params?.id}`, { method: "DELETE" });
    },
    onSuccess: () => navigate("/tasks"),
  });

  const startEdit = () => {
    setEditData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      categoryId: task.categoryId,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "",
      estimatedMinutes: task.estimatedMinutes || "",
    });
    setEditMode(true);
  };

  const handleSave = () => {
    const updates: any = {};
    if (editData.title !== task.title) updates.title = editData.title;
    if (editData.priority !== task.priority) updates.priority = editData.priority;
    if (editData.status !== task.status) updates.status = editData.status;
    if (editData.categoryId !== task.categoryId) updates.categoryId = editData.categoryId || null;
    if (editData.dueDate !== (task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "")) {
      updates.dueDate = editData.dueDate || null;
    }
    if (editData.estimatedMinutes !== String(task.estimatedMinutes || "")) {
      updates.estimatedMinutes = editData.estimatedMinutes ? Number(editData.estimatedMinutes) : null;
    }
    if (editData.description !== (task.description || "")) {
      updates.description = editData.description || null;
    }
    updateTask.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <div className="text-4xl mb-2">🔍</div>
        <p className="text-sm">Không tìm thấy công việc</p>
        <button onClick={() => navigate("/tasks")} className="mt-3 text-primary text-sm font-semibold hover:underline">Quay lại</button>
      </div>
    );
  }

  const category = categories.find((c: any) => c.id === task.categoryId);
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <button onClick={() => navigate("/tasks")} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl md:text-2xl font-display font-bold flex-1">Chi tiết công việc</h2>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)} className="p-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
              <button onClick={handleSave} disabled={updateTask.isPending}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:shadow-lg transition-all">
                <Save className="w-4 h-4" /> Lưu
              </button>
            </>
          ) : (
            <>
              {isCompleted ? (
                <button
                  onClick={() => updateTask.mutate({ status: "pending" })}
                  className="p-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors" title="Mở lại">
                  <RotateCcw className="w-5 h-5" />
                </button>
              ) : !isCancelled ? (
                <button onClick={completeTask.mutate} disabled={completeTask.isPending}
                  className="flex items-center gap-1.5 bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> Hoàn thành
                </button>
              ) : null}
              <button onClick={startEdit}
                className="flex items-center gap-1.5 bg-secondary text-foreground rounded-xl px-4 py-2 text-sm font-semibold hover:shadow-sm transition-all">
                <Pencil className="w-4 h-4" /> Sửa
              </button>
              <button onClick={() => { if (confirm("Xóa công việc này?")) deleteTask.mutate(); }}
                className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Xóa">
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task Info */}
        <div className="lg:col-span-2 space-y-4">
          {editMode ? (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <input
                autoFocus
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="w-full bg-transparent text-lg font-semibold outline-none border-b border-border pb-2"
                placeholder="Tên công việc"
              />
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="w-full bg-secondary rounded-xl p-3 text-sm outline-none resize-none min-h-[80px] focus:ring-2 focus:ring-primary/20"
                placeholder="Mô tả chi tiết..."
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Mức độ</label>
                  <select value={editData.priority} onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                    className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none">
                    <option value="low">Thấp</option>
                    <option value="medium">Vừa</option>
                    <option value="high">Cao</option>
                    <option value="urgent">Khẩn cấp</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Trạng thái</label>
                  <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none">
                    <option value="pending">Chưa làm</option>
                    <option value="in_progress">Đang làm</option>
                    <option value="completed">Đã xong</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Danh mục</label>
                  <select
                    value={editData.categoryId ?? ""}
                    onChange={(e) => setEditData({ ...editData, categoryId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none">
                    <option value="">Không chọn</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Deadline</label>
                  <input type="datetime-local" value={editData.dueDate}
                    onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                    className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Thời gian dự kiến (phút)</label>
                <input type="number" value={editData.estimatedMinutes} min={1}
                  onChange={(e) => setEditData({ ...editData, estimatedMinutes: e.target.value })}
                  className="w-32 bg-secondary rounded-xl px-3 py-2 text-sm outline-none"
                  placeholder="VD: 30" />
              </div>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <button onClick={() => updateTask.mutate({ status: isCompleted ? "pending" : "completed" })}
                    className="flex-shrink-0 mt-1 text-muted-foreground hover:text-primary transition-colors">
                    {isCompleted
                      ? <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      : isCancelled
                        ? <X className="w-6 h-6 text-destructive" />
                        : <Circle className="w-6 h-6" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn("text-lg font-semibold", (isCompleted || isCancelled) && "line-through text-muted-foreground")}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{task.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <span className={cn("text-xs font-bold px-2 py-1 rounded-lg border", PRIORITY_COLORS[task.priority] || "")}>
                        <Flag className="w-3 h-3 inline mr-1" />
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </span>
                      {category && (
                        <span className="text-xs font-medium px-2 py-1 rounded-lg bg-secondary text-muted-foreground">
                          {category.icon} {category.name}
                        </span>
                      )}
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded-lg",
                        task.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                        task.status === "in_progress" ? "bg-blue-500/10 text-blue-600" :
                        task.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                        "bg-amber-500/10 text-amber-600"
                      )}>
                        {(STATUS_OPTIONS.find(s => s.value === task.status))?.label || task.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {task.dueDate && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <Calendar className="w-4 h-4 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {new Date(task.dueDate).toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(task.dueDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
                {task.estimatedMinutes && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <Clock className="w-4 h-4 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Dự kiến</p>
                    <p className="text-sm font-semibold mt-0.5">{task.estimatedMinutes} phút</p>
                  </div>
                )}
                <div className="bg-card border border-border rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Ngày tạo</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {new Date(task.createdAt).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" })}
                  </p>
                </div>
              </div>

              {/* Reminder info */}
              {task.reminderAt && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-600 font-medium">⏰ Nhắc nhở lúc: {new Date(task.reminderAt).toLocaleString("vi-VN")}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Activity Log */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h4 className="text-sm font-semibold mb-3">Lịch sử hoạt động</h4>
            {task.activities?.length > 0 ? (
              <div className="space-y-3">
                {task.activities.map((act: any) => (
                  <div key={act.id} className="flex gap-3 text-sm">
                    <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        <span className="font-medium">{ACTIVITY_LABELS[act.action] || act.action}</span>
                      </p>
                      {act.changes && Object.keys(act.changes).length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {Object.entries(act.changes).map(([k, v]) => {
                            if (k === "priority") return `ưu tiên → ${PRIORITY_LABELS[v as string] || v}`;
                            if (k === "status") return `trạng thái → ${(STATUS_OPTIONS.find(s => s.value === v))?.label || v}`;
                            if (k === "title") return `tiêu đề → "${v}"`;
                            if (k === "dueDate") return `deadline → ${v ? new Date(v as string).toLocaleDateString("vi-VN") : "đã xóa"}`;
                            if (k === "categoryId") return `danh mục đã thay đổi`;
                            if (k === "estimatedMinutes") return `thời gian → ${v} phút`;
                            return `${k} → ${v}`;
                          }).join(", ")}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(act.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        {" - "}
                        {new Date(act.createdAt).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Chưa có hoạt động nào</p>
            )}
          </div>

          {/* Quick Info */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h4 className="text-sm font-semibold mb-3">Thông tin</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>ID</span>
                <span className="font-mono font-medium text-foreground">#{task.id}</span>
              </div>
              {task.completedAt && (
                <div className="flex justify-between">
                  <span>Hoàn thành</span>
                  <span className="text-foreground">{new Date(task.completedAt).toLocaleDateString("vi-VN")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Cập nhật</span>
                <span className="text-foreground">{new Date(task.updatedAt).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
