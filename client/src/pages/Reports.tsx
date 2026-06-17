import { useMemo } from "react";
import { motion } from "framer-motion";
import { useOrders } from "@/hooks/use-orders";
import { TrendingUp, Calendar, CalendarDays, CalendarRange, BarChart3, Trophy, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrencyFull(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}tr`;
  return `${Math.round(amount / 1000)}k`;
}

function startOf(unit: "day" | "week" | "month"): Date {
  const now = new Date();
  if (unit === "day") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (unit === "week") {
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function Reports() {
  const { data: orders, isLoading } = useOrders();

  const stats = useMemo(() => {
    if (!orders) return null;

    const completed = orders.filter((o) => o.status === "Complete");

    const dayStart = startOf("day");
    const weekStart = startOf("week");
    const monthStart = startOf("month");

    const revenueDay = completed
      .filter((o) => o.completedAt && new Date(o.completedAt) >= dayStart)
      .reduce((s, o) => s + o.totalAmount, 0);

    const revenueWeek = completed
      .filter((o) => o.completedAt && new Date(o.completedAt) >= weekStart)
      .reduce((s, o) => s + o.totalAmount, 0);

    const revenueMonth = completed
      .filter((o) => o.completedAt && new Date(o.completedAt) >= monthStart)
      .reduce((s, o) => s + o.totalAmount, 0);

    const revenueTotal = completed.reduce((s, o) => s + o.totalAmount, 0);

    const ordersDay = completed.filter((o) => o.completedAt && new Date(o.completedAt) >= dayStart).length;
    const ordersWeek = completed.filter((o) => o.completedAt && new Date(o.completedAt) >= weekStart).length;
    const ordersMonth = completed.filter((o) => o.completedAt && new Date(o.completedAt) >= monthStart).length;
    const ordersTotal = completed.length;

    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    completed.forEach((order) => {
      (order.items as any[]).forEach((item: any) => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        }
        itemMap[item.name].quantity += item.quantity;
        itemMap[item.name].revenue += item.price * item.quantity;
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    const maxQty = topItems[0]?.quantity || 1;

    const dailyMap: Record<string, number> = {};
    completed
      .filter((o) => o.completedAt && new Date(o.completedAt) >= weekStart)
      .forEach((o) => {
        const d = new Date(o.completedAt!).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
        dailyMap[d] = (dailyMap[d] || 0) + o.totalAmount;
      });

    const dailyChart = Object.entries(dailyMap).map(([label, amount]) => ({ label, amount }));
    const maxDaily = Math.max(...dailyChart.map((d) => d.amount), 1);

    return {
      revenueDay, revenueWeek, revenueMonth, revenueTotal,
      ordersDay, ordersWeek, ordersMonth, ordersTotal,
      topItems, maxQty, dailyChart, maxDaily,
    };
  }, [orders]);

  const revenueCards = [
    {
      label: "Hôm nay",
      icon: Calendar,
      revenue: stats?.revenueDay ?? 0,
      orders: stats?.ordersDay ?? 0,
      color: "sky",
      bg: "bg-sky-50 border-sky-200",
      text: "text-sky-600",
      iconBg: "bg-sky-100",
    },
    {
      label: "Tuần này",
      icon: CalendarDays,
      revenue: stats?.revenueWeek ?? 0,
      orders: stats?.ordersWeek ?? 0,
      color: "violet",
      bg: "bg-violet-50 border-violet-200",
      text: "text-violet-600",
      iconBg: "bg-violet-100",
    },
    {
      label: "Tháng này",
      icon: CalendarRange,
      revenue: stats?.revenueMonth ?? 0,
      orders: stats?.ordersMonth ?? 0,
      color: "amber",
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-600",
      iconBg: "bg-amber-100",
    },
    {
      label: "Tổng cộng",
      icon: TrendingUp,
      revenue: stats?.revenueTotal ?? 0,
      orders: stats?.ordersTotal ?? 0,
      color: "emerald",
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-600",
      iconBg: "bg-emerald-100",
    },
  ];

  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="mb-6">
        <h2 className="text-3xl font-sans font-bold text-foreground">Báo cáo</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Revenue Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {revenueCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={cn("rounded-2xl border p-4 flex flex-col gap-2", card.bg)}
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", card.iconBg)}>
                  <card.icon className={cn("w-5 h-5", card.text)} />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                <p className={cn("text-2xl font-bold", card.text)}>{formatCurrencyFull(card.revenue)}</p>
                <p className="text-xs text-muted-foreground">{card.orders} đơn hoàn thành</p>
              </motion.div>
            ))}
          </div>

          {/* Weekly bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-5 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">Doanh thu tuần này theo ngày</h3>
            </div>
            {stats?.dailyChart?.length ? (
              <div className="flex items-end gap-2 h-36">
                {stats.dailyChart.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-primary">
                      {d.amount > 0 ? formatCurrencyFull(d.amount) : ""}
                    </span>
                    <div className="w-full relative flex items-end" style={{ height: "80px" }}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(d.amount / stats.maxDaily) * 80}px` }}
                        transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                        className="w-full rounded-t-lg bg-primary/80"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">{d.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-36 text-muted-foreground text-sm">
                <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                Chưa có đơn hoàn thành trong tuần này
              </div>
            )}
          </motion.div>

          {/* Top items */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-foreground">Món bán chạy</h3>
            </div>
            {stats?.topItems?.length ? (
              <div className="space-y-3">
                {stats.topItems.map((item, i) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.06 }}
                    className="flex items-center gap-3"
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0",
                      i === 0 ? "bg-amber-100 text-amber-600" :
                      i === 1 ? "bg-slate-100 text-slate-500" :
                      i === 2 ? "bg-orange-100 text-orange-600" :
                      "bg-secondary text-muted-foreground"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {item.quantity} phần · {formatCurrencyFull(item.revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.quantity / stats.maxQty) * 100}%` }}
                          transition={{ delay: 0.5 + i * 0.06, duration: 0.5, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full",
                            i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-primary/60"
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
                <Package className="w-8 h-8 mb-2 opacity-30" />
                Chưa có dữ liệu bán hàng
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
