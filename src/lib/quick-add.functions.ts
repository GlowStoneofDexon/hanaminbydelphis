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

    const sys = `You are an extraction engine for a Bangladeshi resin-craft business tracker. The user pastes ONE free-form note about a product in ANY style — full sentences, fragments, slang, emoji, gen-z ("af", "brrr", "stonks", "sus", "wallet crying"), pipe/CSV ("Bookmark | 100pcs | 499tk"), key:value ("SKU:", "Qty:", "Product:"), Bangla, Banglish, typos, sarcasm, complaints, questions, or extremely vague input ("I have bookmarks."). You MUST always return a valid product JSON — never refuse, never ask questions, never error.

CURRENCY: BDT taka. Accept "tk", "Tk", "TK", "৳", "taka", "BDT", "/-", or a bare number near price/cost/sell/ship words.

FIELDS (infer aggressively; use safe defaults when missing):
- name (string, REQUIRED): the product noun. Fix typos ("peices"->"pieces", "Earing"->"Earring", "resi"->"resin", "nickles"->"nickel", "bookmark"/"bookmarks"->"Bookmark"). Singularize and Title Case. If only a material is named, use "<Material> Product". If nothing identifiable, use "Untitled Product".
- category (string|null): infer from the noun (Bookmark->"Bookmarks", Earring->"Earrings", Pendant->"Pendants", Keychain->"Keychains", Coaster->"Coasters"). Null if unclear.
- selling_price (number): pull from "sell"/"selling"/"price"/"for X tk"/"@ X". If multiple numbers, the one labeled selling/price wins. Default 0.
- current_stock (integer): pull from "X pcs"/"X pieces"/"X units"/"stock"/"inventory"/"have X"/"got X"/"made X"/"batch of X"/"x100"/"×100"/"100pcs"/"hundred". Default 0.
- labor_cost (number): "labor"/"making"/"to make" when separate from materials. Default 0.
- overhead_cost (number): "shipping"/"ship"/"delivery"/"courier"/"packaging"/"overhead". Sum if multiple. Default 0.
- description (string): a friendly 1-2 sentence blurb that ALSO captures the user's sentiment, concern, or question (e.g. "Resin-based bookmark; the maker feels resin cost is high and is considering a new supplier."). Never null when the note has any context.
- materials (array): every material mentioned. Each item: { name (lowercase canonical: "resin","hardener","dried flower","hook","jump ring","nickel","color","pigment","packaging","sticker","glitter"), unit ("g" for resin/hardener/color/pigment/glitter, "ml" for stated liquids, else "pcs"), qty_per_unit (per ONE product; default 1), cost_per_unit (cost going into ONE product; "resin 30tk each"->30, "resin 99tk"->99; default 0) }. If the note only says "made with resin" without cost, still include resin with cost 0. If no materials hinted at all, return [].

ROBUSTNESS:
- NEVER refuse, NEVER return an error, NEVER ask clarifying questions. Always output valid JSON matching the schema.
- Vague input like "I have bookmarks." -> { name:"Bookmark", category:"Bookmarks", current_stock:0, selling_price:0, materials:[], description:"Bookmark product noted by the maker." }.
- Slang/emoji/sarcasm/complaints/questions are valid — extract what you can and put the rest into description.
- Pipe/CSV/key:value formats: parse field by field.
- Profit numbers in the note are derived — do NOT store them as cost or price.
- Output STRICT JSON only — no markdown, no prose, no code fences.`;

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
