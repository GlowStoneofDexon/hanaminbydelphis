import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getFinanceOverview, listExpenseCategories, createExpense, deleteExpense,
} from "@/lib/finance.functions";
import { formatBDT, fmtDate } from "@/lib/format";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — Hanami" }] }),
  component: FinancePage,
});

function FinancePage() {
  const fn = useServerFn(getFinanceOverview);
  const { data } = useSuspenseQuery({ queryKey: ["finance"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      title="Finance"
      subtitle="Last 90 days"
      right={
        <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Expense
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Card label="Revenue" value={formatBDT(data.revenue)} />
        <Card label="Expenses" value={formatBDT(data.expenses)} tone="expense" />
        <Card label="Gross profit" value={formatBDT(data.gross_profit)} tone="profit" />
        <Card label="Reinvested" value={formatBDT(data.reinvested)} />
      </div>

      <section className="mt-3 card-soft p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Cash flow</h2>
          <Link to="/finance/reinvestment" className="chip text-primary">
            Reinvestment <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-3 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series}>
              <defs>
                <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <Tooltip formatter={(v: number) => formatBDT(v)} labelFormatter={(d) => fmtDate(d as string)}
                contentStyle={{ borderRadius: 14, border: "1px solid var(--color-border)" }} />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} fill="url(#rev2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-3 card-soft p-4">
        <h2 className="mb-2 font-display text-base font-bold">Wallets</h2>
        <div className="grid grid-cols-2 gap-2">
          {data.wallets.map((w) => (
            <div key={w.kind} className="rounded-2xl bg-secondary/60 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{w.kind}</p>
              <p className="num text-lg font-bold">{formatBDT(w.balance)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-3 card-soft p-4">
        <h2 className="mb-2 font-display text-base font-bold">Recent transactions</h2>
        {data.recent_expenses.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">No expenses yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recent_expenses.map((e) => (
              <ExpenseRow key={e.id} e={e} />
            ))}
          </div>
        )}
      </section>

      <ExpenseSheet open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "profit" | "expense" }) {
  const cls = tone === "profit" ? "text-profit" : tone === "expense" ? "text-expense" : "";
  return (
    <div className="card-soft p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}

function ExpenseRow({ e }: { e: any }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteExpense);
  const remove = useMutation({
    mutationFn: () => del({ data: { id: e.id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Deleted"); },
  });
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.description ?? e.category ?? "Expense"}</p>
        <p className="text-xs text-muted-foreground">
          {e.category ?? "—"} · {fmtDate(e.spent_at)}
          {e.is_reinvestment ? " · reinvestment" : ""}
        </p>
      </div>
      <span className="num text-sm font-semibold text-expense">-{formatBDT(e.amount)}</span>
      <button onClick={() => remove.mutate()} className="text-muted-foreground hover:text-foreground">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ExpenseSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createExpense);
  const catsFn = useServerFn(listExpenseCategories);
  const cats = useQuery({ queryKey: ["expense-categories"], queryFn: () => catsFn(), enabled: open });
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isReinvest, setIsReinvest] = useState(false);
  const [isOverhead, setIsOverhead] = useState(false);
  const [usesTotal, setUsesTotal] = useState("50");
  const mutate = useMutation({
    mutationFn: () => create({
      data: {
        amount: Number(amount || 0),
        description: description || null,
        category_id: categoryId || undefined,
        is_reinvestment: isReinvest,
        is_overhead: isOverhead,
        uses_total: Math.max(1, Number(usesTotal || 50)),
      },
    }),
    onSuccess: () => {
      toast.success("Expense added"); qc.invalidateQueries(); onOpenChange(false);
      setAmount(""); setDescription(""); setCategoryId(""); setIsReinvest(false);
      setIsOverhead(false); setUsesTotal("50");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">New expense</SheetTitle>
          <SheetDescription>Mark as overhead to auto-spread across products.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Amount (৳)</Label>
            <Input type="number" inputMode="decimal" value={amount} placeholder="500" onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="UV lamp" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId || "_none"} onValueChange={(v) => setCategoryId(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {(cats.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
            <span className="text-sm">Reinvestment (counts toward growth)</span>
            <Switch checked={isReinvest} onCheckedChange={setIsReinvest} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
            <span className="text-sm">Use as product overhead</span>
            <Switch checked={isOverhead} onCheckedChange={setIsOverhead} />
          </label>
          {isOverhead && (
            <div className="space-y-1.5">
              <Label>Spread over how many uses?</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={usesTotal}
                placeholder="50"
                onChange={(e) => setUsesTotal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Per-unit cost ≈ {Number(amount || 0) > 0 && Number(usesTotal || 0) > 0
                  ? formatBDT(Number(amount) / Number(usesTotal))
                  : "—"}
              </p>
            </div>
          )}
          <Button className="h-11 w-full rounded-2xl" disabled={!Number(amount) || mutate.isPending} onClick={() => mutate.mutate()}>
            {mutate.isPending ? "Saving…" : "Add expense"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
