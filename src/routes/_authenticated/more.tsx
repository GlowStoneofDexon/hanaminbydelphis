import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getProfile, updateProfile, getWallets, setWalletBalance } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronRight, LogOut, Package, ShoppingBag, Users, Truck, Sparkles, Target, Star,
} from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({ meta: [{ title: "More — Hanami" }] }),
  component: MorePage,
});

function MorePage() {
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profFn = useServerFn(getProfile);
  const walletFn = useServerFn(getWallets);
  const { data: profile } = useSuspenseQuery({ queryKey: ["profile"], queryFn: () => profFn() });
  const { data: wallets } = useSuspenseQuery({ queryKey: ["wallets"], queryFn: () => walletFn() });
  const [editOpen, setEditOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell title="More" subtitle="Settings & extras">
      <section className="card-soft p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground font-display font-bold text-lg">
            {(profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold">{profile?.display_name ?? "Your name"}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.business_name ?? "Your business"}</p>
          </div>
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setEditOpen(true)}>Edit</Button>
        </div>
      </section>

      <section className="mt-3 card-soft p-4">
        <h2 className="mb-2 font-display text-base font-bold">Wallets</h2>
        <div className="grid grid-cols-2 gap-2">
          {wallets.map((w) => (
            <WalletEditor key={w.kind} kind={w.kind} balance={Number(w.balance)} />
          ))}
        </div>
      </section>

      <section className="mt-3 card-soft divide-y divide-border">
        <NavRow to="/orders" icon={<ShoppingBag className="h-5 w-5" />} label="Orders" />
        <NavRow to="/customers" icon={<Users className="h-5 w-5" />} label="Customers" />
        <NavRow to="/feedback" icon={<Star className="h-5 w-5" />} label="Feedback" />
        <NavRow to="/goals" icon={<Target className="h-5 w-5" />} label="Goals" />
        <NavRow to="/insights" icon={<Sparkles className="h-5 w-5" />} label="AI Insights" />
        <NavRow to="/inventory" icon={<Package className="h-5 w-5" />} label="Inventory" />
        <NavRow to="/finance/reinvestment" icon={<Truck className="h-5 w-5" />} label="Reinvestment timeline" />
      </section>

      <Button variant="outline" className="mt-4 h-12 w-full rounded-2xl" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Hanami · made with care for handmade businesses
      </p>

      <ProfileEditSheet open={editOpen} onOpenChange={setEditOpen}
        defaults={{ display_name: profile?.display_name ?? "", business_name: profile?.business_name ?? "" }} />
    </AppShell>
  );
}

function NavRow({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function WalletEditor({ kind, balance }: { kind: string; balance: number }) {
  const qc = useQueryClient();
  const fn = useServerFn(setWalletBalance);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(balance);
  const save = useMutation({
    mutationFn: () => fn({ data: { kind: kind as any, balance: Number(val) } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Wallet updated"); setEditing(false); },
  });
  return (
    <button onClick={() => { setVal(balance); setEditing(true); }} className="rounded-2xl bg-secondary/60 p-3 text-left">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{kind}</p>
      {editing ? (
        <div className="mt-1 flex gap-1">
          <Input type="number" autoFocus value={val} onChange={(e) => setVal(Number(e.target.value))} onBlur={() => save.mutate()} className="h-8 w-24 text-base" />
        </div>
      ) : (
        <p className="num text-lg font-bold">{formatBDT(balance)}</p>
      )}
    </button>
  );
}

function ProfileEditSheet({
  open, onOpenChange, defaults,
}: { open: boolean; onOpenChange: (o: boolean) => void; defaults: { display_name: string; business_name: string } }) {
  const qc = useQueryClient();
  const fn = useServerFn(updateProfile);
  const [name, setName] = useState(defaults.display_name);
  const [biz, setBiz] = useState(defaults.business_name);
  const save = useMutation({
    mutationFn: () => fn({ data: { display_name: name, business_name: biz, currency: "৳" } }),
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries(); onOpenChange(false); },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} key={defaults.display_name + defaults.business_name}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">Edit profile</SheetTitle>
          <SheetDescription>Shown across your dashboard.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5"><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Business name</Label><Input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder="Hanami Resin" /></div>
          <Button className="h-11 w-full rounded-2xl" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
