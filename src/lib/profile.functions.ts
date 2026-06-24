import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProfileUpdateSchema = z.object({
  display_name: z.string().optional().nullable(),
  business_name: z.string().optional().nullable(),
  currency: z.string().min(1).optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles").select("*").eq("id", context.userId).maybeSingle();
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("profiles").update({
      display_name: data.display_name ?? null,
      business_name: data.business_name ?? null,
      currency: data.currency ?? "৳",
    }).eq("id", context.userId);
    return { ok: true };
  });

export const getWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wallets").select("kind, balance").order("kind");
    return data ?? [];
  });

export const setWalletBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "cash" | "bkash" | "nagad" | "bank"; balance: number }) =>
    z.object({
      kind: z.enum(["cash", "bkash", "nagad", "bank"]),
      balance: z.number().min(0),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("wallets")
      .update({ balance: data.balance })
      .eq("user_id", context.userId).eq("kind", data.kind);
    return { ok: true };
  });
