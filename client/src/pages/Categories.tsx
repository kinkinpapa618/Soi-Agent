import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_PALETTE = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#e91e63", "#4caf50", "#ff9800", "#2196f3", "#9c27b0",
  "#00bcd4", "#ff5722", "#607d8b", "#795548", "#009688",
];

const ICON_OPTIONS = [
  "📋", "💼", "🏠", "🛒", "📚", "🎯", "🏃", "🍽️",
  "✈️", "💻", "📱", "🎨", "🎵", "⚽", "🏥", "📝",
  "💰", "🔧", "🎓", "🤝", "❤️", "🚗", "📅", "⭐",
  "🔥", "💡", "🎉", "☕", "📧", "🌱",
];

export default function Categories() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [newIcon, setNewIcon] = useState("📋");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<number | "new" | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; color: string; icon: string }) => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewName("");
      setNewColor("#3b82f6");
      setNewIcon("📋");
      setShowForm(false);
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; color?: string; icon?: string }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createCategory.mutate({ name: newName.trim(), color: newColor, icon: newIcon });
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditIcon(cat.icon);
  };

  const handleUpdate = (id: number) => {
    if (!editName.trim()) return;
    updateCategory.mutate({ id, name: editName.trim(), color: editColor, icon: editIcon });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-full">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold">Danh mục</h2>
          <p className="text-sm text-muted-foreground mt-1">Phân loại công việc theo danh mục riêng</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Thêm
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-5 shrink-0 bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold">Tạo danh mục mới</h3>
          <div className="flex gap-3">
            <div className="relative">
              <button type="button"
                onClick={() => setShowColorPicker(showColorPicker === "new" ? null : "new")}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-lg border-2 border-border hover:border-primary transition-colors"
                style={{ backgroundColor: newColor + "20", borderColor: newColor }}
              >
                {newIcon}
              </button>
              {showColorPicker === "new" && (
                <div className="absolute top-full mt-2 left-0 bg-card border border-border rounded-xl p-3 shadow-xl z-30 w-52">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Icon</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {ICON_OPTIONS.map(ico => (
                      <button key={ico} type="button"
                        onClick={() => { setNewIcon(ico); setShowColorPicker(null); }}
                        className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-secondary transition-colors",
                          newIcon === ico && "bg-secondary ring-2 ring-primary")}
                      >{ico}</button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Màu sắc</p>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map(c => (
                      <button key={c} type="button"
                        onClick={() => { setNewColor(c); setShowColorPicker(null); }}
                        className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                        style={{ backgroundColor: c, borderColor: newColor === c ? "#fff" : "transparent", boxShadow: newColor === c ? "0 0 0 2px " + c : "none" }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên danh mục (VD: Công việc, Cá nhân...)"
              className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button type="submit" disabled={!newName.trim() || createCategory.isPending}
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-all">
              Tạo
            </button>
          </div>
        </form>
      )}

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Đang tải...</div>
        ) : categories.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-3">🏷️</div>
            <p className="font-semibold">Chưa có danh mục nào</p>
            <p className="text-sm mt-1">Tạo danh mục để phân loại công việc</p>
          </div>
        ) : (
          categories.map((cat: any) => (
            <div key={cat.id}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 md:p-4 transition-all hover:shadow-sm group">
              {editingId === cat.id ? (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(showColorPicker === cat.id ? null : cat.id)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-lg border-2 transition-colors"
                      style={{ backgroundColor: editColor + "20", borderColor: editColor }}
                    >{editIcon}</button>
                    {showColorPicker === cat.id && (
                      <div className="absolute top-full mt-2 left-0 bg-card border border-border rounded-xl p-3 shadow-xl z-30 w-52">
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {ICON_OPTIONS.map(ico => (
                            <button key={ico} type="button"
                              onClick={() => setEditIcon(ico)}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-secondary transition-colors",
                                editIcon === ico && "bg-secondary ring-2 ring-primary")}
                            >{ico}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {COLOR_PALETTE.map(c => (
                            <button key={c} type="button"
                              onClick={() => setEditColor(c)}
                              className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                              style={{ backgroundColor: c, borderColor: editColor === c ? "#fff" : "transparent", boxShadow: editColor === c ? "0 0 0 2px " + c : "none" }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(cat.id)}
                    className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button onClick={() => handleUpdate(cat.id)}
                    className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: (cat.color || "#3b82f6") + "20" }}
                  >
                    {cat.icon || "📋"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cat.isDefault ? "Mặc định" : "Tùy chỉnh"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(cat)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm(`Xóa danh mục "${cat.name}"?`)) deleteCategory.mutate(cat.id); }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
