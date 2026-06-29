import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DashboardInput = z.object({}).optional();

type RecentOrder = {
  id: string;
  status: string;
  total: number;
  customer: string | null;
  product_summary: string;
  ordered_at: string;
};

type RecentExpense = {
  id: string;
  amount: number;
  description: string | null;
  category: string | null;
  spent_at: string;
};

type RecentFeedback = {
  id: string;
  rating: number;
  comment: string | null;
  product: string | null;
  customer: string | null;
  created_at: string;
};

export type DashboardSnapshot = {
  display_name: string | null;
  currency: string;
  today_sales: number;
  today_profit: number;
  pending_orders: number;
  revenue_7d: { day: string; revenue: number; profit: number }[];
  revenue_6m: { month: string; revenue: number; profit: number }[];
  top_product: { id: string; name: string; margin: number; revenue: number; photo_url: string | null } | null;
  reinvestment: { profit_30d: number; reinvested_30d: number; remaining: number };
  recent_orders: RecentOrder[];
  recent_expenses: RecentExpense[];
  recent_feedback: RecentFeedback[];
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

export const getDashboardSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }): Promise<DashboardSnapshot> => {
    const supabase = context.supabase;
    const userId = context.userId;

    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const sixMonthsAgo = new Date(today); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); sixMonthsAgo.setDate(1);

    const [profileRes, ordersRes, productsRes, expensesRes, feedbackRes] = await Promise.all([
      supabase.from("profiles").select("display_name, currency").eq("id", userId).maybeSingle(),
      supabase.from("orders")
        .select("id, status, ordered_at, customer_id, customers(name), order_items(qty, unit_price, unit_cost_snapshot, products(name))")
        .gte("ordered_at", sixMonthsAgo.toISOString())
        .order("ordered_at", { ascending: false }),
      supabase.from("products").select("id, name, photo_url, selling_price"),
      supabase.from("expenses")
        .select("id, amount, description, spent_at, is_reinvestment, expense_categories(name)")
        .gte("spent_at", thirtyDaysAgo.toISOString())
        .order("spent_at", { ascending: false }),
      supabase.from("feedback")
        .select("id, rating, comment, created_at, products(name), customers(name)")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const orders = (ordersRes.data ?? []) as any[];
    const expenses = (expensesRes.data ?? []) as any[];

    // 7-day daily series + 6-month monthly series
    let today_sales = 0, today_profit = 0;
    const days: { day: string; revenue: number; profit: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo); d.setDate(d.getDate() + i);
      days.push({ day: d.toISOString().slice(0, 10), revenue: 0, profit: 0 });
    }
    const months: { month: string; revenue: number; profit: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo); d.setMonth(d.getMonth() + i);
      months.push({ month: d.toISOString().slice(0, 7), revenue: 0, profit: 0 });
    }
    const productAgg = new Map<string, { name: string; photo_url: string | null; revenue: number; profit: number }>();
    let pending_orders = 0;

    for (const o of orders) {
      if (o.status === "new" || o.status === "processing") pending_orders++;
      const day = String(o.ordered_at).slice(0, 10);
      const month = String(o.ordered_at).slice(0, 7);
      const items = (o.order_items ?? []) as any[];
      let orderRev = 0, orderProfit = 0;
      for (const it of items) {
        const rev = Number(it.unit_price) * Number(it.qty);
        const prof = rev - Number(it.unit_cost_snapshot) * Number(it.qty);
        orderRev += rev; orderProfit += prof;
        const pname = it.products?.name ?? "Unknown";
        const agg = productAgg.get(pname) ?? { name: pname, photo_url: null, revenue: 0, profit: 0 };
        agg.revenue += rev; agg.profit += prof;
        productAgg.set(pname, agg);
      }
      const dSlot = days.find((x) => x.day === day);
      if (dSlot) { dSlot.revenue += orderRev; dSlot.profit += orderProfit; }
      const mSlot = months.find((x) => x.month === month);
      if (mSlot) { mSlot.revenue += orderRev; mSlot.profit += orderProfit; }
      if (day === today.toISOString().slice(0, 10)) {
        today_sales += orderRev;
        today_profit += orderProfit;
      }
    }

    // Top product
    let top_product: DashboardSnapshot["top_product"] = null;
    let topRev = -1;
    for (const [, v] of productAgg) {
      if (v.revenue > topRev) {
        topRev = v.revenue;
        const margin = v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0;
        top_product = {
          id: v.name, name: v.name,
          margin: Math.round(margin),
          revenue: v.revenue,
          photo_url: v.photo_url,
        };
      }
    }
    if (top_product) {
      const prod = (productsRes.data ?? []).find((p: any) => p.name === top_product!.name);
      if (prod) { top_product.id = prod.id; top_product.photo_url = prod.photo_url; }
    }


    const profit_30d = days.reduce((s, d) => s + d.profit, 0);
    const reinvested_30d = expenses.filter(e => e.is_reinvestment).reduce((s, e) => s + Number(e.amount), 0);

    const recent_orders: RecentOrder[] = orders.slice(0, 3).map(o => {
      const items = (o.order_items ?? []) as any[];
      const total = items.reduce((s, it) => s + Number(it.unit_price) * Number(it.qty), 0);
      const summary = items.map(it => `${it.qty}× ${it.products?.name ?? "item"}`).join(", ") || "—";
      return {
        id: o.id, status: o.status, total,
        customer: o.customers?.name ?? null,
        product_summary: summary,
        ordered_at: o.ordered_at,
      };
    });

    const recent_expenses: RecentExpense[] = expenses.slice(0, 3).map(e => ({
      id: e.id, amount: Number(e.amount),
      description: e.description,
      category: e.expense_categories?.name ?? null,
      spent_at: e.spent_at,
    }));

    const recent_feedback: RecentFeedback[] = (feedbackRes.data ?? []).map((f: any) => ({
      id: f.id, rating: f.rating, comment: f.comment,
      product: f.products?.name ?? null, customer: f.customers?.name ?? null,
      created_at: f.created_at,
    }));

    return {
      display_name: profileRes.data?.display_name ?? null,
      currency: profileRes.data?.currency ?? "৳",
      today_sales, today_profit,
      pending_orders,
      revenue_7d: days,
      revenue_6m: months,
      top_product,
      reinvestment: {
        profit_30d,
        reinvested_30d,
        remaining: profit_30d - reinvested_30d,
      },
      recent_orders, recent_expenses, recent_feedback,
    };
  });
