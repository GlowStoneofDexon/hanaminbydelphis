import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FeedbackSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
});

export const listFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("feedback")
      .select("id, rating, comment, photo_url, created_at, customers(id, name), products(id, name, photo_url)")
      .order("created_at", { ascending: false });
    const list = data ?? [];
    const avg = list.length ? list.reduce((s: number, f: any) => s + Number(f.rating), 0) / list.length : 0;
    return { list, avg };
  });

export const createFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FeedbackSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("feedback").insert({
      user_id: context.userId,
      customer_id: data.customer_id ?? null,
      product_id: data.product_id ?? null,
      rating: data.rating,
      comment: data.comment ?? null,
      photo_url: data.photo_url ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("feedback").delete().eq("id", data.id);
    return { ok: true };
  });
