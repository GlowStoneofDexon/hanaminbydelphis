import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecipeItemSchema = z.object({
  material_id: z.string().uuid().optional().nullable(),
  material_name: z.string().optional().nullable(),
  unit_cost_override: z.number().min(0).optional().nullable(),
  qty_per_unit: z.number().min(0),
});

const ProductUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  selling_price: z.number().min(0),
  current_stock: z.number().int().min(0),
  labor_cost: z.number().min(0).default(0),
  overhead_cost: z.number().min(0).default(0),
  recipe: z.array(RecipeItemSchema).default([]),
  overhead_expense_ids: z.array(z.string().uuid()).default([]),
});

export type ProductWithCost = {
  id: string;
  name: string;
  category: string | null;
  photo_url: string | null;
  selling_price: number;
  current_stock: number;
  labor_cost: number;
  overhead_cost: number;
  unit_cost: number;
  profit: number;
  margin: number;
  units_sold: number;
  revenue: number;
};

function recipeRowCost(row: any): number {
  const fromMaterial = Number(row.materials?.avg_unit_cost ?? 0);
  const fromOverride = Number(row.unit_cost_override ?? 0);
  const per = fromMaterial > 0 ? fromMaterial : fromOverride;
  return Number(row.qty_per_unit) * per;
}

async function computeAmortizedOverhead(
  supabase: any,
  productId: string,
): Promise<number> {
  const { data } = await supabase
    .from("product_overheads")
    .select("expenses(amount, uses_total)")
    .eq("product_id", productId);
  return (data ?? []).reduce((s: number, r: any) => {
    const amt = Number(r.expenses?.amount ?? 0);
    const uses = Math.max(1, Number(r.expenses?.uses_total ?? 50));
    return s + amt / uses;
  }, 0);
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }): Promise<ProductWithCost[]> => {
    const supabase = context.supabase;
    const { data: products } = await supabase
      .from("products")
      .select("id, name, category, photo_url, selling_price, current_stock, labor_cost, overhead_cost")
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (!products) return [];

    const { data: recipe } = await supabase
      .from("product_recipe_items")
      .select("product_id, qty_per_unit, unit_cost_override, materials(avg_unit_cost)");
    const costByProduct = new Map<string, number>();
    for (const r of (recipe ?? []) as any[]) {
      costByProduct.set(r.product_id, (costByProduct.get(r.product_id) ?? 0) + recipeRowCost(r));
    }

    const { data: overheads } = await supabase
      .from("product_overheads")
      .select("product_id, expenses(amount, uses_total)");
    const ohByProduct = new Map<string, number>();
    for (const r of (overheads ?? []) as any[]) {
      const amt = Number(r.expenses?.amount ?? 0);
      const uses = Math.max(1, Number(r.expenses?.uses_total ?? 50));
      ohByProduct.set(r.product_id, (ohByProduct.get(r.product_id) ?? 0) + amt / uses);
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, qty, unit_price");
    const soldByProduct = new Map<string, { units: number; revenue: number }>();
    for (const it of (items ?? []) as any[]) {
      const cur = soldByProduct.get(it.product_id) ?? { units: 0, revenue: 0 };
      cur.units += Number(it.qty);
      cur.revenue += Number(it.unit_price) * Number(it.qty);
      soldByProduct.set(it.product_id, cur);
    }

    return products.map((p: any) => {
      const unit_cost =
        (costByProduct.get(p.id) ?? 0) +
        Number(p.labor_cost) +
        Number(p.overhead_cost) +
        (ohByProduct.get(p.id) ?? 0);
      const profit = Number(p.selling_price) - unit_cost;
      const margin = p.selling_price > 0 ? (profit / Number(p.selling_price)) * 100 : 0;
      const sold = soldByProduct.get(p.id) ?? { units: 0, revenue: 0 };
      return { ...p, unit_cost, profit, margin, units_sold: sold.units, revenue: sold.revenue };
    });
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: product } = await supabase
      .from("products").select("*").eq("id", data.id).maybeSingle();
    if (!product) return null;
    const { data: items } = await supabase
      .from("product_recipe_items")
      .select("id, qty_per_unit, material_id, material_name, unit_cost_override, materials(name, unit, avg_unit_cost)")
      .eq("product_id", data.id);
    const { data: ohRows } = await supabase
      .from("product_overheads")
      .select("expense_id")
      .eq("product_id", data.id);

    const materialsCost = (items ?? []).reduce((s, r: any) => s + recipeRowCost(r), 0);
    const amortizedOverhead = await computeAmortizedOverhead(supabase, data.id);
    const unit_cost =
      materialsCost +
      Number(product.labor_cost ?? 0) +
      Number(product.overhead_cost ?? 0) +
      amortizedOverhead;
    const profit = Number(product.selling_price) - unit_cost;
    const margin = product.selling_price > 0 ? (profit / Number(product.selling_price)) * 100 : 0;
    return {
      ...product,
      unit_cost,
      profit,
      margin,
      amortized_overhead: amortizedOverhead,
      recipe: items ?? [],
      overhead_expense_ids: (ohRows ?? []).map((r: any) => r.expense_id),
    };
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProductUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const productRow = {
      user_id: userId,
      name: data.name,
      category: data.category ?? null,
      photo_url: data.photo_url ?? null,
      selling_price: data.selling_price,
      current_stock: data.current_stock,
      labor_cost: data.labor_cost,
      overhead_cost: data.overhead_cost,
    };

    let productId = data.id;
    if (productId) {
      await supabase.from("products").update(productRow).eq("id", productId);
    } else {
      const { data: inserted, error } = await supabase
        .from("products").insert(productRow).select("id").single();
      if (error) throw new Error(error.message);
      productId = inserted!.id;
    }

    await supabase.from("product_recipe_items").delete().eq("product_id", productId);
    if (data.recipe.length) {
      const rows = data.recipe.map((r) => ({
        user_id: userId,
        product_id: productId!,
        material_id: r.material_id ?? null,
        material_name: r.material_id ? null : r.material_name ?? null,
        unit_cost_override: r.material_id ? null : r.unit_cost_override ?? 0,
        qty_per_unit: r.qty_per_unit,
      }));
      const { error } = await supabase.from("product_recipe_items").insert(rows);
      if (error) throw new Error(error.message);
    }

    await supabase.from("product_overheads").delete().eq("product_id", productId);
    if (data.overhead_expense_ids.length) {
      const rows = data.overhead_expense_ids.map((expense_id) => ({
        user_id: userId,
        product_id: productId!,
        expense_id,
      }));
      const { error } = await supabase.from("product_overheads").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { id: productId };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("products").delete().eq("id", data.id);
    return { ok: true };
  });
