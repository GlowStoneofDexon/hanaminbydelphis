import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OrderItemSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().positive(),
  unit_price: z.number().min(0),
});

const OrderCreateSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().optional().nullable(), // create on the fly
  status: z.enum(["new", "processing", "shipped", "delivered", "cancelled"]).default("new"),
  platform: z.enum(["facebook", "instagram", "website", "whatsapp", "in_person", "other"]).default("facebook"),
  payment_method: z.enum(["cash", "bkash", "nagad", "bank", "other"]).default("cash"),
  shipping_cost: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(OrderItemSchema).min(1),
});

const StatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "processing", "shipped", "delivered", "cancelled"]),
});

async function computeUnitCost(supabase: any, productId: string): Promise<number> {
  const { data: prod } = await supabase
    .from("products").select("labor_cost, overhead_cost").eq("id", productId).single();
  const { data: items } = await supabase
    .from("product_recipe_items")
    .select("qty_per_unit, materials(avg_unit_cost)")
    .eq("product_id", productId);
  const matCost = (items ?? []).reduce(
    (s: number, it: any) => s + Number(it.qty_per_unit) * Number(it.materials?.avg_unit_cost ?? 0),
    0,
  );
  return matCost + Number(prod?.labor_cost ?? 0) + Number(prod?.overhead_cost ?? 0);
}

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("orders")
      .select("id, status, platform, payment_method, shipping_cost, notes, ordered_at, customers(id, name), order_items(id, qty, unit_price, unit_cost_snapshot, products(id, name, photo_url))")
      .order("ordered_at", { ascending: false });
    return (data ?? []).map((o: any) => {
      const subtotal = (o.order_items ?? []).reduce(
        (s: number, it: any) => s + Number(it.unit_price) * Number(it.qty), 0);
      const cost = (o.order_items ?? []).reduce(
        (s: number, it: any) => s + Number(it.unit_cost_snapshot) * Number(it.qty), 0);
      return {
        ...o,
        subtotal,
        total: subtotal + Number(o.shipping_cost),
        profit: subtotal - cost,
      };
    });
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrderCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    let customerId = data.customer_id ?? null;
    if (!customerId && data.customer_name?.trim()) {
      const { data: c } = await supabase
        .from("customers")
        .insert({ user_id: userId, name: data.customer_name.trim() })
        .select("id").single();
      customerId = c?.id ?? null;
    }

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        customer_id: customerId,
        status: data.status,
        platform: data.platform,
        payment_method: data.payment_method,
        shipping_cost: data.shipping_cost,
        notes: data.notes ?? null,
      })
      .select("id").single();
    if (oErr) throw new Error(oErr.message);

    const itemsRows = await Promise.all(
      data.items.map(async (it) => ({
        user_id: userId,
        order_id: order!.id,
        product_id: it.product_id,
        qty: it.qty,
        unit_price: it.unit_price,
        unit_cost_snapshot: await computeUnitCost(supabase, it.product_id),
      })),
    );
    const { error: iErr } = await supabase.from("order_items").insert(itemsRows);
    if (iErr) throw new Error(iErr.message);

    // If created as shipped/delivered, deduct stock & materials
    if (data.status === "shipped" || data.status === "delivered") {
      await applyShipment(supabase, order!.id);
    }

    // Update wallet
    const subtotal = data.items.reduce((s, it) => s + it.unit_price * it.qty, 0);
    const total = subtotal + data.shipping_cost;
    await bumpWallet(supabase, userId, data.payment_method, total);

    return { id: order!.id };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: existing } = await supabase
      .from("orders").select("status").eq("id", data.id).maybeSingle();
    const wasShipped = existing?.status === "shipped" || existing?.status === "delivered";
    const willBeShipped = data.status === "shipped" || data.status === "delivered";
    await supabase.from("orders").update({ status: data.status }).eq("id", data.id);
    if (!wasShipped && willBeShipped) {
      await applyShipment(supabase, data.id);
    }
    return { ok: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("orders").delete().eq("id", data.id);
    return { ok: true };
  });

async function applyShipment(supabase: any, orderId: string) {
  const { data: items } = await supabase
    .from("order_items")
    .select("qty, product_id")
    .eq("order_id", orderId);
  for (const it of (items ?? []) as any[]) {
    // decrement product stock
    const { data: p } = await supabase
      .from("products").select("current_stock").eq("id", it.product_id).single();
    const newStock = Math.max(0, Number(p?.current_stock ?? 0) - Number(it.qty));
    await supabase.from("products").update({ current_stock: newStock }).eq("id", it.product_id);
    // decrement materials per recipe
    const { data: recipe } = await supabase
      .from("product_recipe_items")
      .select("material_id, qty_per_unit")
      .eq("product_id", it.product_id);
    for (const r of (recipe ?? []) as any[]) {
      const need = Number(r.qty_per_unit) * Number(it.qty);
      const { data: m } = await supabase
        .from("materials").select("current_qty").eq("id", r.material_id).single();
      await supabase.from("materials")
        .update({ current_qty: Math.max(0, Number(m?.current_qty ?? 0) - need) })
        .eq("id", r.material_id);
    }
  }
}

async function bumpWallet(supabase: any, userId: string, kind: string, delta: number) {
  if (!["cash", "bkash", "nagad", "bank"].includes(kind)) return;
  const { data: w } = await supabase
    .from("wallets").select("balance").eq("user_id", userId).eq("kind", kind).maybeSingle();
  await supabase.from("wallets")
    .update({ balance: Number(w?.balance ?? 0) + delta })
    .eq("user_id", userId).eq("kind", kind);
}
