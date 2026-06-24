import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MaterialSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  unit: z.enum(["g", "ml", "pcs"]),
  low_threshold: z.number().min(0).default(0),
});

const PurchaseSchema = z.object({
  material_id: z.string().uuid(),
  supplier_id: z.string().uuid().optional().nullable(),
  qty: z.number().positive(),
  total_cost: z.number().min(0),
  notes: z.string().optional().nullable(),
  log_expense: z.boolean().default(true),
});

const SupplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  contact: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const listMaterials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("materials").select("*").order("name");
    return data ?? [];
  });

export const upsertMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MaterialSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      name: data.name, unit: data.unit, low_threshold: data.low_threshold,
    };
    if (data.id) {
      await context.supabase.from("materials").update(row).eq("id", data.id);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("materials").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const deleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("materials").delete().eq("id", data.id);
    return { ok: true };
  });

export const recordPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PurchaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: purchase, error } = await context.supabase
      .from("material_purchases")
      .insert({
        user_id: context.userId,
        material_id: data.material_id,
        supplier_id: data.supplier_id ?? null,
        qty: data.qty,
        total_cost: data.total_cost,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.log_expense) {
      // find or default expense category
      const { data: mat } = await context.supabase
        .from("materials").select("name").eq("id", data.material_id).single();
      const { data: cat } = await context.supabase
        .from("expense_categories")
        .select("id")
        .eq("user_id", context.userId)
        .ilike("name", "Resin")
        .maybeSingle();
      await context.supabase.from("expenses").insert({
        user_id: context.userId,
        category_id: cat?.id ?? null,
        amount: data.total_cost,
        description: `Restock: ${mat?.name ?? "material"} (${data.qty})`,
        is_reinvestment: true,
        related_material_purchase_id: purchase!.id,
      });
    }
    return { id: purchase!.id };
  });

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { material_id?: string }) =>
    z.object({ material_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("material_purchases")
      .select("id, qty, total_cost, purchased_at, notes, materials(name, unit), suppliers(name)")
      .order("purchased_at", { ascending: false });
    if (data.material_id) q = q.eq("material_id", data.material_id);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("suppliers").select("*").order("name");
    return data ?? [];
  });

export const upsertSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SupplierSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = { user_id: context.userId, name: data.name, contact: data.contact ?? null, notes: data.notes ?? null };
    if (data.id) {
      await context.supabase.from("suppliers").update(row).eq("id", data.id);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("suppliers").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });
