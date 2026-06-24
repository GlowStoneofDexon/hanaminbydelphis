import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  listMaterials, upsertMaterial, deleteMaterial, recordPurchase, listSuppliers,
} from "@/lib/inventory.functions";
import { formatBDT, formatNum, fmtDate } from "@/lib/format";
import { Plus, AlertTriangle, Trash2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Hanami" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const fn = useServerFn(listMaterials);
  const { data } = useSuspenseQuery({ queryKey: ["materials"], queryFn: () => fn() });
  const [editing, setEditing] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseMaterial, setPurchaseMaterial] = useState<any | null>(null);

  return (
    <AppShell
      title="Inventory"
      subtitle="Raw materials"
      right={
        <Button size="sm" className="rounded-full" onClick={() => { setEditing(null); setEditOpen(true); }}>
          <Plus className="h-4 w-4" /> New
        </Button>
      }
    >
      {data.length === 0 ? (
        <EmptyMaterials onAdd={() => { setEditing(null); setEditOpen(true); }} />
      ) : (
        <div className="grid gap-3">
          {data.map((m: any) => {
            const low = Number(m.low_threshold) > 0 && Number(m.current_qty) <= Number(m.low_threshold);
            const pct = m.low_threshold > 0
              ? Math.min(100, Math.round((Number(m.current_qty) / (Number(m.low_threshold) * 2)) * 100))
              : 100;
            return (
              <div key={m.id} className="card-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => { setEditing(m); setEditOpen(true); }} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-display text-base font-bold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Avg cost {formatBDT(m.avg_unit_cost)}/{m.unit} · threshold {formatNum(m.low_threshold)}{m.unit}
                    </p>
                  </button>
                  <div className="text-right">
                    <p className="num text-xl font-bold">{formatNum(m.current_qty)}<span className="text-sm font-medium text-muted-foreground"> {m.unit}</span></p>
                    {low && <span className="chip bg-warn/15 text-warn"><AlertTriangle className="h-3 w-3" /> Low</span>}
                  </div>
                </div>
                <Progress value={pct} className="mt-3 h-1.5" />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" className="rounded-full"
                    onClick={() => { setPurchaseMaterial(m); setPurchaseOpen(true); }}>
                    <PackagePlus className="h-3.5 w-3.5" /> Restock
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MaterialSheet open={editOpen} onOpenChange={setEditOpen} editing={editing} />
      <PurchaseSheet open={purchaseOpen} onOpenChange={setPurchaseOpen} material={purchaseMaterial} />
    </AppShell>
  );
}

function EmptyMaterials({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card-soft mt-4 p-8 text-center">
      <h3 className="font-display text-lg font-bold">No materials yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">Add resin, hardener, flowers, hooks…</p>
      <Button className="mt-4 rounded-full" onClick={onAdd}><Plus className="h-4 w-4" /> Add material</Button>
    </div>
  );
}

function MaterialSheet({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing: any }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertMaterial);
  const del = useServerFn(deleteMaterial);
  const [name, setName] = useState(editing?.name ?? "");
  const [unit, setUnit] = useState<"g" | "ml" | "pcs">(editing?.unit ?? "g");
  const [threshold, setThreshold] = useState<number>(Number(editing?.low_threshold ?? 0));

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, name, unit, low_threshold: Number(threshold) } }),
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
          <SheetTitle className="font-display">{editing ? "Edit material" : "New material"}</SheetTitle>
          <SheetDescription>Stock and avg cost update from purchases.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Resin" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">grams</SelectItem>
                  <SelectItem value="ml">millilitres</SelectItem>
                  <SelectItem value="pcs">pieces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Low-stock threshold</Label>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </div>
          </div>
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

function PurchaseSheet({
  open, onOpenChange, material,
}: { open: boolean; onOpenChange: (o: boolean) => void; material: any }) {
  const qc = useQueryClient();
  const buy = useServerFn(recordPurchase);
  const suppliersFn = useServerFn(listSuppliers);
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => suppliersFn(), enabled: open });
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(0);
  const [supplierId, setSupplierId] = useState<string>("");
  const [logExpense, setLogExpense] = useState(true);

  const mutate = useMutation({
    mutationFn: () => buy({
      data: {
        material_id: material.id,
        qty: Number(qty), total_cost: Number(cost),
        supplier_id: supplierId || undefined,
        log_expense: logExpense,
      },
    }),
    onSuccess: () => { toast.success("Restocked"); qc.invalidateQueries(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!material) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} key={material?.id}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">Restock {material.name}</SheetTitle>
          <SheetDescription>Average cost updates automatically.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity ({material.unit})</Label>
              <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Total cost (৳)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Supplier (optional)</Label>
            <Select value={supplierId || "_none"} onValueChange={(v) => setSupplierId(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {(suppliers.data ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
            <span className="text-sm">Also log as a reinvestment expense</span>
            <Switch checked={logExpense} onCheckedChange={setLogExpense} />
          </label>
          <Button className="h-11 w-full rounded-2xl" disabled={!qty || !cost || mutate.isPending}
            onClick={() => mutate.mutate()}>
            {mutate.isPending ? "Saving…" : "Record purchase"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
