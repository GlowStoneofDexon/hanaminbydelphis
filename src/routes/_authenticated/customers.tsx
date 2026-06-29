import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { listCustomers, upsertCustomer, deleteCustomer } from "@/lib/customers.functions";
import { formatBDT, fmtDate } from "@/lib/format";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — Hanami" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const fn = useServerFn(listCustomers);
  const { data } = useSuspenseQuery({ queryKey: ["customers"], queryFn: () => fn() });
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      hideNav
      title="Customers"
      subtitle="Your buyers"
      right={
        <Button size="sm" className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> New
        </Button>
      }
    >
      {data.length === 0 ? (
        <div className="card-soft mt-4 p-8 text-center text-sm text-muted-foreground">
          No customers yet. Add a sale with a name and they'll appear here.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((c: any) => (
            <button key={c.id} onClick={() => { setEditing(c); setOpen(true); }} className="card-soft p-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.orders_count} order{c.orders_count === 1 ? "" : "s"} · last {c.last_order_at ? fmtDate(c.last_order_at) : "never"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-base font-bold">{formatBDT(c.total_spent)}</p>
                  {c.avg_rating ? (
                    <span className="flex items-center justify-end gap-0.5 text-warn">
                      <Star className="h-3 w-3 fill-current" />
                      <span className="text-xs">{c.avg_rating.toFixed(1)}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <CustomerSheet open={open} onOpenChange={setOpen} editing={editing} />
    </AppShell>
  );
}

function CustomerSheet({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing: any }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertCustomer);
  const del = useServerFn(deleteCustomer);
  const [name, setName] = useState(editing?.name ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, name, phone, address, notes } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries(); onOpenChange(false); },
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: editing.id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries(); onOpenChange(false); },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} key={editing?.id ?? "new"}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">{editing ? "Edit customer" : "New customer"}</SheetTitle>
          <SheetDescription>{editing ? `${editing.orders_count} orders · ${formatBDT(editing.total_spent ?? 0)} lifetime` : "Add a customer to track lifetime value."}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex gap-2 pt-2">
            {editing && (
              <Button variant="outline" className="rounded-2xl" onClick={() => remove.mutate()}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button className="ml-auto h-11 rounded-2xl px-6" disabled={!name || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
