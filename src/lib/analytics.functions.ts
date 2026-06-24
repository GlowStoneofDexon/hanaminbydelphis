import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnalyticsSnapshot = {
  revenue_this_month: number;
  revenue_last_month: number;
  growth_pct: number;
  margin_pct: number;
  avg_order_value: number;
  returning_customers_pct: number;
  best_month: { month: string; revenue: number } | null;
  top_product: { name: string; revenue: number; margin: number } | null;
  worst_product: { name: string; revenue: number; margin: number } | null;
  most_expensive_material: { name: string; spent: number } | null;
  monthly_revenue: { month: string; revenue: number; profit: number }[];
  platform_breakdown: { platform: string; revenue: number }[];
  weekday_heatmap: { weekday: number; revenue: number }[]; // 0=Sun
  product_profit: { name: string; profit: number }[];
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }): Promise<AnalyticsSnapshot> => {
    const supabase = context.supabase;
    const now = new Date();
    const start = new Date(now); start.setMonth(start.getMonth() - 11); start.setDate(1); start.setHours(0,0,0,0);

    const [ordersRes, purchasesRes] = await Promise.all([
      supabase.from("orders")
        .select("ordered_at, platform, shipping_cost, customer_id, order_items(qty, unit_price, unit_cost_snapshot, products(name))")
        .gte("ordered_at", start.toISOString()),
      supabase.from("material_purchases")
        .select("total_cost, materials(name)")
        .gte("purchased_at", start.toISOString()),
    ]);

    const orders = (ordersRes.data ?? []) as any[];
    const purchases = (purchasesRes.data ?? []) as any[];

    // monthly
    const monthAgg = new Map<string, { revenue: number; profit: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i); d.setDate(1);
      monthAgg.set(monthKey(d), { revenue: 0, profit: 0 });
    }
    const platformAgg = new Map<string, number>();
    const weekdayAgg = new Map<number, number>();
    const productAgg = new Map<string, { revenue: number; profit: number }>();
    const customerOrders = new Map<string, number>();
    let totalRevenue = 0, totalProfit = 0, orderCount = 0;
    const thisMonth = monthKey(now);
    const lastMonthDate = new Date(now); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = monthKey(lastMonthDate);

    for (const o of orders) {
      const d = new Date(o.ordered_at);
      const mk = monthKey(d);
      const items = o.order_items ?? [];
      const rev = items.reduce((s: number, it: any) => s + Number(it.unit_price) * Number(it.qty), 0)
        + Number(o.shipping_cost);
      const cost = items.reduce((s: number, it: any) => s + Number(it.unit_cost_snapshot) * Number(it.qty), 0);
      const prof = rev - Number(o.shipping_cost) - cost; // shipping not profit
      totalRevenue += rev; totalProfit += prof; orderCount++;
      const m = monthAgg.get(mk); if (m) { m.revenue += rev; m.profit += prof; }
      platformAgg.set(o.platform, (platformAgg.get(o.platform) ?? 0) + rev);
      weekdayAgg.set(d.getDay(), (weekdayAgg.get(d.getDay()) ?? 0) + rev);
      for (const it of items) {
        const name = it.products?.name ?? "Unknown";
        const cur = productAgg.get(name) ?? { revenue: 0, profit: 0 };
        cur.revenue += Number(it.unit_price) * Number(it.qty);
        cur.profit += (Number(it.unit_price) - Number(it.unit_cost_snapshot)) * Number(it.qty);
        productAgg.set(name, cur);
      }
      if (o.customer_id) customerOrders.set(o.customer_id, (customerOrders.get(o.customer_id) ?? 0) + 1);
    }

    const revenue_this_month = monthAgg.get(thisMonth)?.revenue ?? 0;
    const revenue_last_month = monthAgg.get(lastMonth)?.revenue ?? 0;
    const growth_pct = revenue_last_month > 0
      ? ((revenue_this_month - revenue_last_month) / revenue_last_month) * 100
      : (revenue_this_month > 0 ? 100 : 0);

    let best_month: AnalyticsSnapshot["best_month"] = null;
    for (const [k, v] of monthAgg) {
      if (!best_month || v.revenue > best_month.revenue) best_month = { month: k, revenue: v.revenue };
    }

    const productEntries = Array.from(productAgg.entries()).map(([name, v]) => ({
      name,
      revenue: v.revenue,
      profit: v.profit,
      margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0,
    }));
    productEntries.sort((a, b) => b.revenue - a.revenue);
    const top_product = productEntries[0] ?? null;
    const worst_product = productEntries.length > 1 ? productEntries[productEntries.length - 1] : null;

    const materialSpend = new Map<string, number>();
    for (const p of purchases) {
      const n = p.materials?.name ?? "Unknown";
      materialSpend.set(n, (materialSpend.get(n) ?? 0) + Number(p.total_cost));
    }
    let most_expensive_material: AnalyticsSnapshot["most_expensive_material"] = null;
    for (const [name, spent] of materialSpend) {
      if (!most_expensive_material || spent > most_expensive_material.spent) {
        most_expensive_material = { name, spent };
      }
    }

    const repeatCustomers = Array.from(customerOrders.values()).filter(c => c > 1).length;
    const totalCustomers = customerOrders.size;

    return {
      revenue_this_month,
      revenue_last_month,
      growth_pct,
      margin_pct: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      avg_order_value: orderCount > 0 ? totalRevenue / orderCount : 0,
      returning_customers_pct: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
      best_month,
      top_product: top_product ? { name: top_product.name, revenue: top_product.revenue, margin: top_product.margin } : null,
      worst_product: worst_product ? { name: worst_product.name, revenue: worst_product.revenue, margin: worst_product.margin } : null,
      most_expensive_material,
      monthly_revenue: Array.from(monthAgg.entries()).map(([month, v]) => ({ month, revenue: v.revenue, profit: v.profit })),
      platform_breakdown: Array.from(platformAgg.entries()).map(([platform, revenue]) => ({ platform, revenue })),
      weekday_heatmap: Array.from({ length: 7 }, (_, i) => ({ weekday: i, revenue: weekdayAgg.get(i) ?? 0 })),
      product_profit: productEntries.slice(0, 8).map(p => ({ name: p.name, profit: p.profit })),
    };
  });
