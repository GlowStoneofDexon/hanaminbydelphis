import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Insight = {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  tone: "good" | "warn" | "info";
};

export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }): Promise<Insight[]> => {
    const supabase = context.supabase;
    const now = new Date();
    const start60 = new Date(now); start60.setDate(start60.getDate() - 59);

    const [ordersRes, materialsRes, purchasesRes] = await Promise.all([
      supabase.from("orders")
        .select("ordered_at, order_items(qty, unit_price, unit_cost_snapshot, product_id, products(name))")
        .gte("ordered_at", start60.toISOString()),
      supabase.from("materials").select("id, name, current_qty, low_threshold, avg_unit_cost"),
      supabase.from("material_purchases")
        .select("purchased_at, qty, total_cost, materials(name)")
        .gte("purchased_at", start60.toISOString())
        .order("purchased_at", { ascending: false }),
    ]);

    const out: Insight[] = [];

    // Top profit product (last 30d)
    const last30 = new Date(now); last30.setDate(last30.getDate() - 29);
    const productAgg = new Map<string, { name: string; revenue: number; profit: number; lastSale: Date | null }>();
    for (const o of (ordersRes.data ?? []) as any[]) {
      const d = new Date(o.ordered_at);
      for (const it of o.order_items ?? []) {
        const name = it.products?.name ?? "Unknown";
        const cur = productAgg.get(name) ?? { name, revenue: 0, profit: 0, lastSale: null };
        if (d >= last30) {
          cur.revenue += Number(it.unit_price) * Number(it.qty);
          cur.profit += (Number(it.unit_price) - Number(it.unit_cost_snapshot)) * Number(it.qty);
        }
        if (!cur.lastSale || d > cur.lastSale) cur.lastSale = d;
        productAgg.set(name, cur);
      }
    }
    const ranked = Array.from(productAgg.values()).filter(p => p.revenue > 0)
      .sort((a, b) => b.profit - a.profit);
    if (ranked[0]) {
      const top = ranked[0];
      const totalProfit = ranked.reduce((s, p) => s + p.profit, 0);
      const share = totalProfit > 0 ? Math.round((top.profit / totalProfit) * 100) : 0;
      out.push({
        id: "top-margin",
        emoji: "💎",
        title: `${top.name} made ${share}% of profit`,
        detail: `Your highest-earning product in the last 30 days.`,
        tone: "good",
      });
    }

    // Slow movers — no sales in 21 days
    const slowCutoff = new Date(now); slowCutoff.setDate(slowCutoff.getDate() - 21);
    const slow = Array.from(productAgg.values()).filter(p => p.lastSale && p.lastSale < slowCutoff);
    if (slow[0]) {
      const days = Math.floor((now.getTime() - slow[0].lastSale!.getTime()) / 86400000);
      out.push({
        id: "slow-mover",
        emoji: "🐢",
        title: `${slow[0].name} hasn't sold in ${days} days`,
        detail: `Consider a discount or promo to move stock.`,
        tone: "warn",
      });
    }

    // Material runout prediction
    for (const m of (materialsRes.data ?? []) as any[]) {
      // estimate burn from purchases? Better: from order_items via recipe — skip and use threshold heuristic
      if (Number(m.current_qty) <= Number(m.low_threshold) && Number(m.low_threshold) > 0) {
        out.push({
          id: `low-${m.id}`,
          emoji: "⚠️",
          title: `Only ${Number(m.current_qty)}${m.unit ?? ""} ${m.name} left`,
          detail: `Below your low-stock threshold. Time to restock.`,
          tone: "warn",
        });
      }
    }

    // Cost trend on resin/main material
    const purchases = (purchasesRes.data ?? []) as any[];
    if (purchases.length >= 2) {
      // group by material, compare last to previous unit cost
      const seen = new Set<string>();
      for (const p of purchases) {
        const name = p.materials?.name ?? "";
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const same = purchases.filter(x => x.materials?.name === name);
        if (same.length < 2) continue;
        const newestUnit = Number(same[0].total_cost) / Number(same[0].qty);
        const prevUnit = Number(same[1].total_cost) / Number(same[1].qty);
        if (prevUnit > 0) {
          const change = ((newestUnit - prevUnit) / prevUnit) * 100;
          if (Math.abs(change) >= 8) {
            out.push({
              id: `cost-${name}`,
              emoji: change > 0 ? "📈" : "📉",
              title: `${name} cost ${change > 0 ? "increased" : "decreased"} ${Math.abs(Math.round(change))}%`,
              detail: change > 0 ? "Consider adjusting your prices." : "Margins just improved.",
              tone: change > 0 ? "warn" : "good",
            });
          }
        }
      }
    }

    // Best weekday
    const weekday = new Map<number, number>();
    for (const o of (ordersRes.data ?? []) as any[]) {
      const d = new Date(o.ordered_at).getDay();
      const rev = (o.order_items ?? []).reduce(
        (s: number, it: any) => s + Number(it.unit_price) * Number(it.qty), 0);
      weekday.set(d, (weekday.get(d) ?? 0) + rev);
    }
    if (weekday.size) {
      let bestDay = 0, bestRev = -1;
      for (const [d, r] of weekday) if (r > bestRev) { bestDay = d; bestRev = r; }
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      out.push({
        id: "best-day",
        emoji: "📅",
        title: `${days[bestDay]} is your best sales day`,
        detail: `Plan launches and promos around this day.`,
        tone: "info",
      });
    }

    if (out.length === 0) {
      out.push({
        id: "empty",
        emoji: "✨",
        title: "Insights will appear here",
        detail: "Add a few products, materials, and record some sales to unlock insights.",
        tone: "info",
      });
    }
    return out.slice(0, 8);
  });
