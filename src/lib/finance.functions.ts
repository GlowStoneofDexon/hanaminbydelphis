import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional().nullable(),
  amount: z.number().min(0),
  description: z.string().optional().nullable(),
  is_reinvestment: z.boolean().default(false),
  is_overhead: z.boolean().default(false),
  uses_total: z.number().int().min(1).default(50),
});

const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
});

export const getFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const now = new Date();
    const start90 = new Date(now); start90.setDate(start90.getDate() - 89);

    const [ordersRes, expensesRes, walletsRes] = await Promise.all([
      supabase.from("orders")
        .select("ordered_at, shipping_cost, order_items(qty, unit_price, unit_cost_snapshot)")
        .gte("ordered_at", start90.toISOString())
        .order("ordered_at", { ascending: false }),
      supabase.from("expenses")
        .select("id, amount, description, spent_at, is_reinvestment, expense_categories(id, name)")
        .gte("spent_at", start90.toISOString())
        .order("spent_at", { ascending: false }),
      supabase.from("wallets").select("kind, balance"),
    ]);

    let revenue = 0, cost = 0, expensesTotal = 0, reinvested = 0;
    const dayMap = new Map<string, { day: string; revenue: number; expense: number }>();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      dayMap.set(k, { day: k, revenue: 0, expense: 0 });
    }

    for (const o of (ordersRes.data ?? []) as any[]) {
      const day = String(o.ordered_at).slice(0, 10);
      const items = o.order_items ?? [];
      const orderRev = items.reduce(
        (s: number, it: any) => s + Number(it.unit_price) * Number(it.qty), 0);
      const orderCost = items.reduce(
        (s: number, it: any) => s + Number(it.unit_cost_snapshot) * Number(it.qty), 0);
      revenue += orderRev + Number(o.shipping_cost);
      cost += orderCost;
      const slot = dayMap.get(day);
      if (slot) slot.revenue += orderRev + Number(o.shipping_cost);
    }
    for (const e of (expensesRes.data ?? []) as any[]) {
      expensesTotal += Number(e.amount);
      if (e.is_reinvestment) reinvested += Number(e.amount);
      const day = String(e.spent_at).slice(0, 10);
      const slot = dayMap.get(day);
      if (slot) slot.expense += Number(e.amount);
    }

    const grossProfit = revenue - cost;
    const netProfit = grossProfit - expensesTotal;

    return {
      revenue, cost, expenses: expensesTotal, reinvested,
      gross_profit: grossProfit, net_profit: netProfit,
      remaining_cash: grossProfit - reinvested,
      series: Array.from(dayMap.values()),
      wallets: (walletsRes.data ?? []) as { kind: string; balance: number }[],
      recent_expenses: (expensesRes.data ?? []).slice(0, 20).map((e: any) => ({
        id: e.id,
        amount: Number(e.amount),
        description: e.description,
        is_reinvestment: e.is_reinvestment,
        category: e.expense_categories?.name ?? null,
        spent_at: e.spent_at,
      })),
    };
  });

export const listExpenseCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("expense_categories").select("*").order("name");
    return data ?? [];
  });

export const upsertExpenseCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CategorySchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = { user_id: context.userId, name: data.name };
    if (data.id) {
      await context.supabase.from("expense_categories").update(row).eq("id", data.id);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("expense_categories").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExpenseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ins, error } = await context.supabase
      .from("expenses")
      .insert({
        user_id: context.userId,
        category_id: data.category_id ?? null,
        amount: data.amount,
        description: data.description ?? null,
        is_reinvestment: data.is_reinvestment,
        is_overhead: data.is_overhead,
        uses_total: data.uses_total,
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const listOverheadExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("expenses")
      .select("id, description, amount, uses_total, expense_categories(name)")
      .eq("is_overhead", true)
      .order("spent_at", { ascending: false });
    return (data ?? []).map((e: any) => ({
      id: e.id,
      label: e.description ?? e.expense_categories?.name ?? "Expense",
      amount: Number(e.amount),
      uses_total: Number(e.uses_total),
      per_unit: Number(e.amount) / Math.max(1, Number(e.uses_total)),
    }));
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("expenses").delete().eq("id", data.id);
    return { ok: true };
  });

export const getReinvestmentTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 89);
    const { data } = await context.supabase
      .from("expenses")
      .select("id, amount, description, spent_at, expense_categories(name)")
      .eq("is_reinvestment", true)
      .gte("spent_at", start.toISOString())
      .order("spent_at", { ascending: false });
    return (data ?? []).map((e: any) => ({
      id: e.id, amount: Number(e.amount),
      description: e.description,
      category: e.expense_categories?.name ?? null,
      spent_at: e.spent_at,
    }));
  });
