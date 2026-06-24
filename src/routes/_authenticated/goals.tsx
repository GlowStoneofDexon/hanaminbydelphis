import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listGoals, upsertGoal, bumpGoal, deleteGoal } from "@/lib/goals.functions";
import { formatBDT } from "@/lib/format";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — Hanami" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const fn = useServerFn(listGoals);
  const { data } = useSuspenseQuery({ queryKey: ["goals"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const bumpFn = useServerFn(bumpGoal);
  const delFn = useServerFn(deleteGoal);
  const bump = useMutation({
    mutationFn: (v: { id: string; delta: number }) => bumpFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Deleted"); },
  });

  return (
    <AppShell title="Goals" subtitle="What you're chasing"
      right={<Button size="sm" className="rounded-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New</Button>}
    >
      {data.length === 0 ? (
        <div className="card-soft mt-4 p-8 text-center text-sm text-muted-foreground">
          No goals yet. Add one like "Sell 100 earrings" or "Earn ৳50,000".
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((g: any) => {
            const pct = g.target_amount > 0 ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)) : 0;
            const isMoney = g.kind === "revenue" || g.kind === "savings";
            return (
              <div key={g.id} className="card-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-bold">{g.title}</h3>
                  {g.completed && <CheckCircle2 className="h-5 w-5 text-profit" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize">{g.kind}</p>
                <Progress value={pct} className="mt-3 h-2" />
                <div className="mt-2 flex items-center justify-between">
                  <p className="num text-sm">
                    {isMoney ? formatBDT(g.current_amount) : g.current_amount} / {isMoney ? formatBDT(g.target_amount) : g.target_amount}
                  </p>
                  <p className="num text-sm font-bold">{pct}%</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" className="rounded-full"
                    onClick={() => bump.mutate({ id: g.id, delta: isMoney ? 100 : 1 })}>
                    +{isMoney ? "৳100" : "1"}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-full"
                    onClick={() => bump.mutate({ id: g.id, delta: isMoney ? -100 : -1 })}>
                    −{isMoney ? "৳100" : "1"}
                  </Button>
                  <button onClick={() => remove.mutate(g.id)}
                    className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <GoalSheet open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function GoalSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertGoal);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"revenue" | "units_sold" | "savings" | "custom">("revenue");
  const [target, setTarget] = useState(0);
  const create = useMutation({
    mutationFn: () => upsert({ data: { title, kind, target_amount: Number(target), current_amount: 0 } }),
    onSuccess: () => { toast.success("Goal added"); qc.invalidateQueries(); onOpenChange(false); setTitle(""); setTarget(0); },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">New goal</SheetTitle>
          <SheetDescription>Track milestones with a progress bar.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Earn ৳50,000" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue (৳)</SelectItem>
                  <SelectItem value="units_sold">Units sold</SelectItem>
                  <SelectItem value="savings">Savings (৳)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Target</Label><Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></div>
          </div>
          <Button className="h-11 w-full rounded-2xl" disabled={!title || !target || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Saving…" : "Add goal"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
