import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CustomerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data: customers } = await context.supabase
      .from("customers").select("*").order("created_at", { ascending: false });

    const { data: orders } = await context.supabase
      .from("orders")
      .select("id, customer_id, ordered_at, shipping_cost, order_items(qty, unit_price)");

    const { data: feedbacks } = await context.supabase
      .from("feedback").select("customer_id, rating");

    const aggByCust = new Map<string, { orders: number; spent: number; last: string | null }>();
    for (const o of (orders ?? []) as any[]) {
      if (!o.customer_id) continue;
      const cur = aggByCust.get(o.customer_id) ?? { orders: 0, spent: 0, last: null };
      cur.orders += 1;
      cur.spent += (o.order_items ?? []).reduce(
        (s: number, it: any) => s + Number(it.unit_price) * Number(it.qty), 0,
      ) + Number(o.shipping_cost);
      if (!cur.last || cur.last < o.ordered_at) cur.last = o.ordered_at;
      aggByCust.set(o.customer_id, cur);
    }

    const ratingByCust = new Map<string, { sum: number; n: number }>();
    for (const f of (feedbacks ?? []) as any[]) {
      if (!f.customer_id) continue;
      const cur = ratingByCust.get(f.customer_id) ?? { sum: 0, n: 0 };
      cur.sum += Number(f.rating); cur.n += 1;
      ratingByCust.set(f.customer_id, cur);
    }

    return (customers ?? []).map((c: any) => {
      const agg = aggByCust.get(c.id) ?? { orders: 0, spent: 0, last: null };
      const r = ratingByCust.get(c.id);
      return {
        ...c,
        orders_count: agg.orders,
        total_spent: agg.spent,
        last_order_at: agg.last,
        avg_rating: r ? r.sum / r.n : null,
      };
    });
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CustomerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId, name: data.name,
      phone: data.phone ?? null, address: data.address ?? null, notes: data.notes ?? null,
    };
    if (data.id) {
      await context.supabase.from("customers").update(row).eq("id", data.id);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("customers").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("customers").delete().eq("id", data.id);
    return { ok: true };
  });
