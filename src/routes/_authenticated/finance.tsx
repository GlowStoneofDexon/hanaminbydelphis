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

      <section className="mt-3 card-soft p-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold">Reinvestment timeline</h2>
          <p className="text-xs text-muted-foreground">See how profit is being reinvested.</p>
        </div>
        <Link to="/finance/reinvestment" className="chip text-primary">
          Open <ArrowRight className="h-3 w-3" />
        </Link>
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
  const mutate = useMutation({
    mutationFn: () => create({
      data: {
        amount: Number(amount || 0),
        description: description || null,
        category_id: categoryId || undefined,
        is_reinvestment: isReinvest,
      },
    }),
    onSuccess: () => {
      toast.success("Expense added"); qc.invalidateQueries(); onOpenChange(false);
      setAmount(""); setDescription(""); setCategoryId(""); setIsReinvest(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">New expense</SheetTitle>
          <SheetDescription>Log a business expense.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Amount (৳)</Label>
            <Input inputMode="decimal" value={amount} placeholder="500" onChange={(e) => setAmount(e.target.value)} />
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
          <Button className="h-11 w-full rounded-2xl" disabled={!Number(amount) || mutate.isPending} onClick={() => mutate.mutate()}>
            {mutate.isPending ? "Saving…" : "Add expense"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

