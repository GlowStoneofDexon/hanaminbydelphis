import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { listOrders, updateOrderStatus, deleteOrder } from "@/lib/orders.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBDT, fmtDateTime } from "@/lib/format";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "Orders — Hanami" }] }),
  component: OrdersPage,
});

const STATUSES = ["new", "processing", "shipped", "delivered", "cancelled"] as const;

function OrdersPage() {
  const fn = useServerFn(listOrders);
  const { data } = useSuspenseQuery({ queryKey: ["orders"], queryFn: () => fn() });
  const qc = useQueryClient();
  const updateFn = useServerFn(updateOrderStatus);
  const delFn = useServerFn(deleteOrder);
  const update = useMutation({
    mutationFn: (v: { id: string; status: typeof STATUSES[number] }) => updateFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Order updated"); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Order deleted"); },
  });

  const grouped: Record<string, typeof data> = { new: [], processing: [], shipped: [], delivered: [], cancelled: [] };
  for (const o of data as any[]) {
    (grouped[o.status as string] ??= []).push(o);
  }

  return (
    <AppShell hideNav title="Orders" subtitle="Manage shipments">
      {data.length === 0 ? (
        <div className="card-soft mt-4 p-8 text-center text-sm text-muted-foreground">
          No orders yet. Tap the + button to record your first sale.
        </div>
      ) : (
        <div className="space-y-4">
          {STATUSES.map((s) => (
            <section key={s}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold capitalize">{s}</h2>
                <span className="chip">{grouped[s]?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(grouped[s] ?? []).map((o: any) => (
                  <div key={o.id} className="card-soft p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {(o.order_items ?? []).map((it: any) => `${it.qty}× ${it.products?.name}`).join(", ")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.customers?.name ?? "Walk-in"} · {fmtDateTime(o.ordered_at)} · {o.platform}
                        </p>
                      </div>
                      <span className="num text-sm font-bold">{formatBDT(o.total)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Select value={o.status} onValueChange={(v) => update.mutate({ id: o.id, status: v as typeof STATUSES[number] })}>
                        <SelectTrigger className="h-8 w-36 rounded-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(st => <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="chip bg-profit/15 text-profit">{formatBDT(o.profit)} profit</span>
                      <button onClick={() => remove.mutate(o.id)}
                        className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {(grouped[s] ?? []).length === 0 && (
                  <p className="rounded-2xl bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">empty</p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
