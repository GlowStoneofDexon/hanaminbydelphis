import { useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Hanami" },
      { name: "description", content: "Sign in to your Hanami business tracker." },
    ],
  }),
  validateSearch: z.object({ redirect: z.string().optional() }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || undefined },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      }
      navigate({ to: redirect || "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-dust/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-lavender/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-10">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">Hanami</span>
          </div>
          <h1 className="mt-10 font-display text-4xl font-black leading-tight">
            Run your handmade business like a real one.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Track sales, costs, stock and profit — designed for resin makers and small shops.
          </p>
        </div>

        <form onSubmit={submit} className="mt-10 card-soft p-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "in" | "up")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Sign in</TabsTrigger>
              <TabsTrigger value="up">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="up" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Itsumi" />
              </div>
            </TabsContent>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={loading}>
                {loading ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
              </Button>
            </div>
          </Tabs>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to keep your business numbers private to your account.
        </p>
      </div>
    </div>
  );
}
