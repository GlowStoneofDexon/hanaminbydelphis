import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GoalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  kind: z.enum(["revenue", "units_sold", "savings", "custom"]).default("custom"),
  target_amount: z.number().min(0),
  current_amount: z.number().min(0).default(0),
  deadline: z.string().optional().nullable(),
});

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("goals").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GoalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      title: data.title, kind: data.kind,
      target_amount: data.target_amount, current_amount: data.current_amount,
      deadline: data.deadline ?? null,
      completed: data.current_amount >= data.target_amount && data.target_amount > 0,
    };
    if (data.id) {
      await context.supabase.from("goals").update(row).eq("id", data.id);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("goals").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const bumpGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; delta: number }) =>
    z.object({ id: z.string().uuid(), delta: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: g } = await context.supabase
      .from("goals").select("current_amount, target_amount").eq("id", data.id).single();
    const next = Math.max(0, Number(g?.current_amount ?? 0) + data.delta);
    const target = Number(g?.target_amount ?? 0);
    await context.supabase.from("goals").update({
      current_amount: next,
      completed: target > 0 && next >= target,
    }).eq("id", data.id);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("goals").delete().eq("id", data.id);
    return { ok: true };
  });
