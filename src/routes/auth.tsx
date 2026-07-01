import { useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58v2.98h3.85c2.25-2.08 3.58-5.15 3.58-8.8z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.93l-3.85-2.98c-1.07.72-2.44 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.28v3.09C3.25 21.3 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.26 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.63H1.28C.46 8.24 0 10.06 0 12s.46 3.76 1.28 5.37l3.98-3.09z"/>
      <path fill="#EA4335" d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.63l3.98 3.09C6.21 6.87 8.87 4.76 12 4.76z"/>
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || undefined },
          },
        });
        if (error) throw error;
      }
      navigate({ to: redirect || "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function signInGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: redirect || "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-dust/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-lavender/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-4">
        <div className="mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Hanami</span>
          </div>
          <h1 className="mt-3 font-display text-[22px] font-black leading-tight">
            Run your handmade business like a real one.
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Track sales, costs, stock and profit — for resin makers and small shops.
          </p>
        </div>

        <div className="card-soft p-4">
          <Button
            type="button"
            onClick={signInGoogle}
            disabled={googleLoading || loading}
            variant="outline"
            className="h-11 w-full rounded-2xl border-input bg-background text-sm font-medium shadow-sm hover:bg-muted"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                <span className="ml-2">Continue with Google</span>
              </>
            )}
          </Button>

          <div className="my-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or {mode === "in" ? "sign in" : "sign up"} with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-2">
            {mode === "up" && (
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Itsumi" className="h-10" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
            </div>
            <Button type="submit" className="mt-2 h-11 w-full rounded-2xl text-sm" disabled={loading || googleLoading}>
              {loading ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Your business numbers stay private to your account.
        </p>
      </div>
    </div>
  );
}
