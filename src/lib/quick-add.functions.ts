import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ text: z.string().min(3).max(1000) });

const AiSchema = z.object({
  name: z.string(),
  category: z.string().nullable().optional(),
  selling_price: z.number().min(0),
  current_stock: z.number().int().min(0).default(0),
  labor_cost: z.number().min(0).default(0),
  overhead_cost: z.number().min(0).default(0),
  description: z.string().nullable().optional(),
  materials: z
    .array(
      z.object({
        name: z.string(),
        unit: z.enum(["g", "ml", "pcs"]).default("pcs"),
        qty_per_unit: z.number().min(0).default(1),
        cost_per_unit: z.number().min(0).default(0),
      }),
    )
    .default([]),
});

export type QuickAddResult = {
  product_id: string;
  parsed: z.infer<typeof AiSchema>;
};

export const quickCreateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<QuickAddResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const sys = `You convert short Bangla/English shop notes into a product JSON for a resin-craft business in Bangladesh. Currency is BDT (taka). Extract:
- name (string, infer something readable; fix typos like "Earing"->"Earring", "resi"->"resin", "nickles"->"nickel")
- category (string|null) — e.g. Earrings, Pendant, Keychain
- selling_price (number, taka)
- current_stock (integer)
- labor_cost, overhead_cost (numbers, default 0)
- description (1-2 sentence helpful blurb generated from the note, mentioning materials used)
- materials: array of { name, unit (g|ml|pcs), qty_per_unit, cost_per_unit }. Each material's cost_per_unit is total cost / qty_per_unit when the note says "X tk of Y" (assume that cost is what goes INTO ONE unit unless clearly otherwise). Unit defaults to "pcs" if unclear; resin/color/hardener use "g" or "ml".
Return STRICT JSON only matching the schema, no prose.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: data.text },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — please retry shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
      throw new Error(`AI error: ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsedRaw: unknown;
    try { parsedRaw = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
    const parsed = AiSchema.parse(parsedRaw);

    const supabase = context.supabase;
    const userId = context.userId;

    // create product
    const { data: product, error: pErr } = await supabase
      .from("products")
      .insert({
        user_id: userId,
        name: parsed.name,
        category: parsed.category ?? null,
        selling_price: parsed.selling_price,
        current_stock: parsed.current_stock,
        labor_cost: parsed.labor_cost,
        overhead_cost: parsed.overhead_cost,
        description: parsed.description ?? null,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    const productId = product!.id;

    // upsert materials by case-insensitive name; seed a purchase to set avg cost
    for (const m of parsed.materials) {
      const { data: existing } = await supabase
        .from("materials")
        .select("id, avg_unit_cost")
        .ilike("name", m.name)
        .maybeSingle();
      let materialId = existing?.id as string | undefined;
      if (!materialId) {
        const { data: ins, error } = await supabase
          .from("materials")
          .insert({ user_id: userId, name: m.name, unit: m.unit })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        materialId = ins!.id;
      }
      // Seed cost basis via a tiny purchase row if cost provided & no avg yet
      if (m.cost_per_unit > 0 && (!existing || Number(existing.avg_unit_cost ?? 0) === 0)) {
        const qty = m.qty_per_unit > 0 ? m.qty_per_unit : 1;
        await supabase.from("material_purchases").insert({
          user_id: userId,
          material_id: materialId,
          qty,
          total_cost: m.cost_per_unit * qty,
          notes: "Auto-created via quick add",
        });
      }
      await supabase.from("product_recipe_items").insert({
        user_id: userId,
        product_id: productId,
        material_id: materialId,
        qty_per_unit: m.qty_per_unit > 0 ? m.qty_per_unit : 1,
      });
    }

    return { product_id: productId, parsed };
  });
